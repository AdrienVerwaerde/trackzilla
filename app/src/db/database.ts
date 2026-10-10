import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DatabaseName = 'potageek.db';

/** 2: the queue carries threshold edits as well as LED orders. */
const SchemaVersion = 2;

let connection: Promise<SQLiteDatabase> | null = null;

/**
 * The app's one database handle, opened on first use. Callers share a single
 * promise so two of them cannot race to create the schema.
 */
export function getDatabase() {
  connection ??= open();
  return connection;
}

async function open() {
  const db = await openDatabaseAsync(DatabaseName);
  await db.execAsync('PRAGMA journal_mode = WAL');

  await migrate(db);
  await createTables(db);

  return db;
}

/**
 * Drops tables whose shape changed so the CREATE below rebuilds them. Gated on
 * user_version: ungated, the drop would run on every launch.
 */
async function migrate(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) >= SchemaVersion) return;

  // v2 generalised the queue. Old rows have a `led` column and no kind, so
  // anything still waiting is lost on upgrade — one button press.
  await db.execAsync('DROP TABLE IF EXISTS commands');
  await db.execAsync(`PRAGMA user_version = ${SchemaVersion}`);
}

async function createTables(db: SQLiteDatabase) {
  // The cache is not a copy of the backend: it is what the user needs while
  // cut off.
  await db.execAsync(`
    -- (device, ts) as the key is the deduplication: the same reading arriving
    -- by REST and again over the socket lands on one row instead of two.
    CREATE TABLE IF NOT EXISTS measurements (
      device TEXT    NOT NULL,
      ts     INTEGER NOT NULL,
      t      REAL,
      h      REAL,
      PRIMARY KEY (device, ts)
    );

    CREATE INDEX IF NOT EXISTS idx_measurements_device_ts
      ON measurements (device, ts);

    CREATE TABLE IF NOT EXISTS devices (
      id         TEXT PRIMARY KEY,
      group_name TEXT    NOT NULL,
      status     TEXT    NOT NULL,
      last_seen  INTEGER,
      led        INTEGER
    );

    -- Lets the Réglages screen open without the network.
    CREATE TABLE IF NOT EXISTS thresholds (
      device       TEXT PRIMARY KEY,
      t_min        REAL,
      t_max        REAL,
      h_min        REAL,
      h_max        REAL,
      hold_minutes INTEGER NOT NULL
    );

    -- Keyed by the backend's own eventId, which is what it asks us to dedupe on.
    CREATE TABLE IF NOT EXISTS events (
      event_id INTEGER PRIMARY KEY,
      device   TEXT    NOT NULL,
      ts       INTEGER NOT NULL,
      type     TEXT    NOT NULL,
      payload  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_device_ts ON events (device, ts);

    -- The queue. LED orders and threshold edits share it, so one drain loop
    -- and one lock serve both. The id is chosen here and the backend refuses
    -- to publish the same one twice: that is what makes a replay safe.
    CREATE TABLE IF NOT EXISTS commands (
      id         TEXT PRIMARY KEY,
      device     TEXT    NOT NULL,
      kind       TEXT    NOT NULL,
      payload    TEXT    NOT NULL,
      status     TEXT    NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      reason     TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_commands_status ON commands (status, created_at);
  `);
}
