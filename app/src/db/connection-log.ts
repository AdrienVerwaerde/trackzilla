import { getDatabase } from '@/db/database';

export type ConnectionState = 'online' | 'offline';

export type ConnectionEntry = { id: number; ts: number; state: ConnectionState };

/** Rows kept: enough for a day of a flaky connection. */
const ConnectionLimit = 50;

/** Newest first. */
export async function readConnections(): Promise<ConnectionEntry[]> {
  const db = await getDatabase();

  return db.getAllAsync<ConnectionEntry>(
    'SELECT id, ts, state FROM connection_log ORDER BY id DESC LIMIT ?',
    [ConnectionLimit]
  );
}

export async function insertConnection(state: ConnectionState, ts: number): Promise<ConnectionEntry> {
  const db = await getDatabase();
  const { lastInsertRowId } = await db.runAsync(
    'INSERT INTO connection_log (ts, state) VALUES (?, ?)',
    [ts, state]
  );

  return { id: lastInsertRowId, ts, state };
}

export async function pruneConnections() {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM connection_log
     WHERE id NOT IN (SELECT id FROM connection_log ORDER BY id DESC LIMIT ?)`,
    [ConnectionLimit]
  );
}
