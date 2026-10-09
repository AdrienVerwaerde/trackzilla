import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const DatabaseName = 'potageek.db';

let connection: Promise<SQLiteDatabase> | null = null;

/**
 * The app's one database handle, opened on first use.
 *
 * Callers share a single promise rather than each opening their own: the
 * hydration hook and the socket both reach for it as the app starts, and two
 * connections racing to create the schema is a crash waiting for the slow
 * phone in the room.
 */
export function getDatabase() {
  connection ??= open();
  return connection;
}

async function open() {
  const db = await openDatabaseAsync(DatabaseName);

  // The cache is not a copy of the backend: it is what the user needs while
  // cut off. Four tables, each earning its place from the brief — what we saw
  // (measurements, devices), what the settings screen must open without the
  // network (thresholds), and what happened (events).
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    -- (device, ts) as the key is the deduplication: the same reading arriving
    -- by REST and again over the socket lands on one row instead of two.
    CREATE TABLE IF NOT EXISTS measurements (
      device TEXT    NOT NULL,
      ts     INTEGER NOT NULL,
      t      REAL,
      h      REAL,
      PRIMARY KEY (device, ts)
    );

    -- The pruning and the window query are both "this device, these seconds".
    CREATE INDEX IF NOT EXISTS idx_measurements_device_ts
      ON measurements (device, ts);

    -- One row per device: its last known status, and when it was last heard
    -- from, so the dashboard can say how old that verdict is.
    CREATE TABLE IF NOT EXISTS devices (
      id         TEXT PRIMARY KEY,
      group_name TEXT    NOT NULL,
      status     TEXT    NOT NULL,
      last_seen  INTEGER
    );

    -- Not read yet: the Réglages screen is what opens these offline.
    CREATE TABLE IF NOT EXISTS thresholds (
      device       TEXT PRIMARY KEY,
      t_min        REAL,
      t_max        REAL,
      h_min        REAL,
      h_max        REAL,
      hold_minutes INTEGER NOT NULL
    );

    -- Not read yet: the Journal screen merges these with the command queue.
    -- Keyed by the backend's own eventId, which is what it asks us to dedupe on.
    CREATE TABLE IF NOT EXISTS events (
      event_id INTEGER PRIMARY KEY,
      device   TEXT    NOT NULL,
      ts       INTEGER NOT NULL,
      type     TEXT    NOT NULL,
      payload  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_device_ts ON events (device, ts);
  `);

  return db;
}
