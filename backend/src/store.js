import db from './db.js';

/** Epoch seconds, from the backend clock. */
export const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Three missed readings: the box publishes every 5 s. */
const OfflineAfterSeconds = 15;

/**
 * Greenhouse, tomato. Below 12 C growth stops, above 30 C pollination fails;
 * above 85 % humidity mildew sets in. Twenty minutes of hold because the pump
 * costs more to run for nothing than an alert costs to miss by a few minutes.
 */
const DefaultThresholds = { tMin: 12, tMax: 30, hMin: 60, hMax: 85, holdMinutes: 20 };

const statements = {
  insertMeasurement: db.prepare(`
    INSERT INTO measurements (device, ts, t, h, seq, received_at)
    VALUES (:device, :ts, :t, :h, :seq, :receivedAt)
  `),

  // One row per device: the first message creates it, the next ones refresh it.
  // A null last_seen leaves the stored one alone — a retained message is the
  // broker talking, not the box, and must not pass for a sign of life.
  upsertDevice: db.prepare(`
    INSERT INTO devices (id, group_name, status, last_seen)
    VALUES (:id, :group, :status, :lastSeen)
    ON CONFLICT(id) DO UPDATE SET
      status    = excluded.status,
      last_seen = CASE
                    WHEN excluded.last_seen IS NULL THEN devices.last_seen
                    ELSE MAX(excluded.last_seen, COALESCE(devices.last_seen, 0))
                  END
  `),

  insertEvent: db.prepare(`
    INSERT INTO events (device, ts, type, payload)
    VALUES (:device, :ts, :type, :payload)
  `),

  // A box unplugged without warning never publishes `offline`, so the stored
  // status alone would keep it online forever. Silence is the real signal.
  listDevices: db.prepare(`
    SELECT id,
           group_name AS "group",
           CASE WHEN :now - COALESCE(last_seen, 0) > :offlineAfter
                THEN 'offline' ELSE status END AS status,
           last_seen AS "lastSeen",
           led
    FROM devices
    ORDER BY id
  `),

  getDevice: db.prepare(`SELECT id, status FROM devices WHERE id = :id`),

  rawMeasurements: db.prepare(`
    SELECT ts, t, h
    FROM measurements
    WHERE device = :device AND ts BETWEEN :from AND :to
    ORDER BY ts
  `),

  // Integer division buckets the rows; multiplying back gives the bucket start,
  // as the contract requires. Grouping in SQL keeps 120k rows out of Node.
  //
  // The CAST is not decoration: node:sqlite binds every JS number as REAL, so
  // `ts / :step` would divide in floating point and hand back the original
  // timestamp instead of the start of its bucket.
  bucketedMeasurements: db.prepare(`
    SELECT CAST(ts / :step AS INTEGER) * :step AS ts,
           ROUND(AVG(t), 2)                   AS t,
           ROUND(AVG(h), 2)                   AS h
    FROM measurements
    WHERE device = :device AND ts BETWEEN :from AND :to
    GROUP BY CAST(ts / :step AS INTEGER)
    ORDER BY ts
  `),

  getThresholds: db.prepare(`
    SELECT t_min        AS "tMin",
           t_max        AS "tMax",
           h_min        AS "hMin",
           h_max        AS "hMax",
           hold_minutes AS "holdMinutes"
    FROM thresholds
    WHERE device = :device
  `),

  saveThresholds: db.prepare(`
    INSERT INTO thresholds (device, t_min, t_max, h_min, h_max, hold_minutes)
    VALUES (:device, :tMin, :tMax, :hMin, :hMax, :holdMinutes)
    ON CONFLICT(device) DO UPDATE SET
      t_min        = excluded.t_min,
      t_max        = excluded.t_max,
      h_min        = excluded.h_min,
      h_max        = excluded.h_max,
      hold_minutes = excluded.hold_minutes
  `),

  // DO NOTHING rather than an error: a second delivery of the same id is the
  // normal case of a replay, not a fault.
  insertCommand: db.prepare(`
    INSERT INTO commands (id, device, led, created_at)
    VALUES (:id, :device, :led, :createdAt)
    ON CONFLICT(id) DO NOTHING
  `),

  saveLed: db.prepare(`UPDATE devices SET led = :led WHERE id = :id`),

  // Newest first: an older command still waiting was overtaken by this one,
  // and the box only ever reports where it ended up.
  latestPendingCommand: db.prepare(`
    SELECT id, led
    FROM commands
    WHERE device = :device AND status = 'sent'
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `),

  setCommandStatus: db.prepare(`UPDATE commands SET status = :status WHERE id = :id`),

  getCommand: db.prepare(`
    SELECT id, device, led, status, created_at AS "createdAt"
    FROM commands
    WHERE id = :id
  `),
};

/** Rows come back with a null prototype, which `res.json` serialises oddly. */
const plain = (row) => (row ? { ...row } : row);

/**
 * A reading the device sent in milliseconds, or with no usable value, is
 * dropped rather than stored: a single bad row poisons every average built
 * on top of it.
 */
function isValidMeasurement(data) {
  if (!data || typeof data !== 'object') return false;

  const { ts, t, h } = data;
  // Epoch seconds live in [2001, 2286]; a millisecond timestamp lands far above.
  if (!Number.isFinite(ts) || ts < 1e9 || ts > 1e10) return false;

  return Number.isFinite(t) || Number.isFinite(h);
}

/** Returns the stored row, or null when the payload was rejected. */
export function recordMeasurement(device, group, data) {
  if (!isValidMeasurement(data)) return null;

  const { ts, t = null, h = null, seq = null } = data;
  const receivedAt = nowSeconds();

  statements.insertMeasurement.run({ device, ts, t, h, seq, receivedAt });

  // A reading proves the device is alive, whatever the last `status` said:
  // the retained `offline` the broker replays on connect is stale by design.
  statements.upsertDevice.run({ id: device, group, status: 'online', lastSeen: receivedAt });

  return { device, ts, t, h };
}

export function recordStatus(device, group, status, { retained = false } = {}) {
  const normalized = String(status).trim().toLowerCase();
  if (normalized !== 'online' && normalized !== 'offline') return null;

  const previous = statements.getDevice.get({ id: device })?.status;
  const ts = nowSeconds();

  statements.upsertDevice.run({
    id: device,
    group,
    status: normalized,
    // A replayed message says nothing about now.
    lastSeen: retained ? null : ts,
  });

  // A repeated status is not news: the broker replays its retained message on
  // every reconnect. Only a transition belongs in the journal.
  const changed = previous !== normalized;
  if (changed) recordEvent(device, ts, 'status', { status: normalized });

  return { device, ts, status: normalized, changed };
}

export function recordEvent(device, ts, type, payload) {
  statements.insertEvent.run({ device, ts, type, payload: JSON.stringify(payload) });
}

export function listDevices() {
  return statements.listDevices
    .all({ now: nowSeconds(), offlineAfter: OfflineAfterSeconds })
    .map((row) => ({ ...row, led: row.led === null ? null : row.led === 1 }));
}

/**
 * Stores the LED state the box reports, and returns the command it confirms,
 * or null when there is nothing to confirm.
 *
 * Only the latest pending command is acked, and only if the box landed on the
 * state it asked for: the boot message (LED off) must not confirm a pending
 * `led: true`. A retained state is the broker replaying the last known LED on
 * reconnect: worth storing, but it is not the box answering a command.
 */
export function recordLedState(device, led, { retained = false } = {}) {
  statements.saveLed.run({ id: device, led: led ? 1 : 0 });
  if (retained) return null;

  const pending = statements.latestPendingCommand.get({ device });
  if (!pending || (pending.led === 1) !== led) return null;

  statements.setCommandStatus.run({ id: pending.id, status: 'acked' });
  recordEvent(device, nowSeconds(), 'command_status', { id: pending.id, status: 'acked' });

  return { id: pending.id, device, status: 'acked' };
}

export const deviceExists = (id) => statements.getDevice.get({ id }) !== undefined;

/** `step` in seconds, or null for the raw rows. */
export function getMeasurements({ device, from, to, step }) {
  const rows = step
    ? statements.bucketedMeasurements.all({ device, from, to, step })
    : statements.rawMeasurements.all({ device, from, to });

  return rows.map(plain);
}

export function getThresholds(device) {
  return plain(statements.getThresholds.get({ device })) ?? { ...DefaultThresholds };
}

export function saveThresholds(device, thresholds) {
  statements.saveThresholds.run({ device, ...thresholds });
  return getThresholds(device);
}

/**
 * Remembers a command by its id. `created` is false when the id was already
 * known: the caller must then not publish it again. The insert and the check
 * are one statement, so two requests racing on the same id cannot both win.
 */
export function recordCommand({ id, device, led }) {
  const { changes } = statements.insertCommand.run({
    id,
    device,
    // node:sqlite has no boolean: SQLite stores it as 0 or 1.
    led: led ? 1 : 0,
    createdAt: nowSeconds(),
  });

  const row = statements.getCommand.get({ id });
  return { created: changes > 0, command: { ...row, led: row.led === 1 } };
}
