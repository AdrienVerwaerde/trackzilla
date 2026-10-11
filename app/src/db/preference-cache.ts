import { getDatabase } from '@/db/database';

export async function readPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM preferences WHERE key = ?',
    [key]
  );

  return row?.value ?? null;
}

export async function savePreference(key: string, value: string) {
  const db = await getDatabase();

  await db.runAsync('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [key, value]);
}
