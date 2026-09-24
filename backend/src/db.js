import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.DB_PATH ?? './data.db');

// WAL keeps HTTP reads running while MQTT messages are being written.
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS measurements (
    device      TEXT    NOT NULL,
    ts          INTEGER NOT NULL,
    t           REAL,
    h           REAL,
    seq         INTEGER,
    received_at INTEGER NOT NULL
  );

  -- Equality column first: the query is \`device = ? AND ts BETWEEN ? AND ?\`.
  CREATE INDEX IF NOT EXISTS idx_measurements_device_ts
    ON measurements (device, ts);

  CREATE TABLE IF NOT EXISTS devices (
    id         TEXT PRIMARY KEY,
    group_name TEXT    NOT NULL,
    status     TEXT    NOT NULL DEFAULT 'offline',
    last_seen  INTEGER
  );

  CREATE TABLE IF NOT EXISTS thresholds (
    device       TEXT PRIMARY KEY,
    t_min        REAL,
    t_max        REAL,
    h_min        REAL,
    h_max        REAL,
    hold_minutes INTEGER NOT NULL DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS events (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    device  TEXT    NOT NULL,
    ts      INTEGER NOT NULL,
    type    TEXT    NOT NULL,
    payload TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_events_device_ts ON events (device, ts);
`);

export default db;
