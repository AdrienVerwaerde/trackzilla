import db from './db.js';

/** Epoch seconds, from the backend clock. */
export const nowSeconds = () => Math.floor(Date.now() / 1000);

const statements = {
  insertMeasurement: db.prepare(`
    INSERT INTO measurements (device, ts, t, h, seq, received_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  // One row per device: the first message creates it, the next ones refresh it.
  // last_seen never moves backwards, so a late message cannot rewrite history.
  upsertDevice: db.prepare(`
    INSERT INTO devices (id, group_name, status, last_seen)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status    = excluded.status,
      last_seen = MAX(excluded.last_seen, COALESCE(devices.last_seen, 0))
  `),

  insertEvent: db.prepare(`
    INSERT INTO events (device, ts, type, payload) VALUES (?, ?, ?, ?)
  `),
};

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

  const hasTemperature = Number.isFinite(t);
  const hasHumidity = Number.isFinite(h);
  return hasTemperature || hasHumidity;
}

/** Returns the stored row, or null when the payload was rejected. */
export function recordMeasurement(device, group, data) {
  if (!isValidMeasurement(data)) return null;

  const { ts, t = null, h = null, seq = null } = data;
  statements.insertMeasurement.run(device, ts, t, h, seq, nowSeconds());

  // A reading proves the device is alive, whatever the last `status` said:
  // the retained `offline` the broker replays on connect is stale by design.
  statements.upsertDevice.run(device, group, 'online', nowSeconds());

  return { device, ts, t, h };
}

export function recordStatus(device, group, status) {
  const normalized = String(status).trim().toLowerCase();
  if (normalized !== 'online' && normalized !== 'offline') return null;

  const ts = nowSeconds();
  statements.upsertDevice.run(device, group, normalized, ts);
  recordEvent(device, ts, 'status', { status: normalized });

  return { device, ts, status: normalized };
}

export function recordEvent(device, ts, type, payload) {
  statements.insertEvent.run(device, ts, type, JSON.stringify(payload));
}
