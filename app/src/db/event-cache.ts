import type { JournalEvent } from '@/api/types';
import { getDatabase } from '@/db/database';

/** Rows kept per device: one backend page, which is more than a screen shows. */
export const EventLimit = 200;

type EventRow = { event_id: number; device: string; ts: number; type: string; payload: string };

const toEvent = (row: EventRow): JournalEvent => ({
  ...JSON.parse(row.payload || '{}'),
  eventId: row.event_id,
  device: row.device,
  ts: row.ts,
  type: row.type as JournalEvent['type'],
});

/** Keyed by the backend's eventId, so a re-fetched page overwrites rather than duplicates. */
export async function saveEvents(events: JournalEvent[]) {
  if (events.length === 0) return;

  const db = await getDatabase();
  const statement = await db.prepareAsync(
    'INSERT OR REPLACE INTO events (event_id, device, ts, type, payload) VALUES (?, ?, ?, ?, ?)'
  );

  try {
    await db.withTransactionAsync(async () => {
      for (const event of events) {
        const { eventId, device, ts, type, ...payload } = event;
        await statement.executeAsync([eventId, device, ts, type, JSON.stringify(payload)]);
      }
    });
  } finally {
    await statement.finalizeAsync();
  }
}

/** Newest first. */
export async function readEvents(device: string): Promise<JournalEvent[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EventRow>(
    'SELECT * FROM events WHERE device = ? ORDER BY ts DESC, event_id DESC LIMIT ?',
    [device, EventLimit]
  );

  return rows.map(toEvent);
}

/** Where the next catch-up starts from. */
export async function lastEventTs(device: string): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ ts: number }>(
    'SELECT MAX(ts) AS ts FROM events WHERE device = ?',
    [device]
  );

  return row?.ts ?? null;
}

export async function pruneEvents(device: string) {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM events
     WHERE device = ?
       AND event_id NOT IN (
         SELECT event_id FROM events WHERE device = ? ORDER BY ts DESC, event_id DESC LIMIT ?
       )`,
    [device, device, EventLimit]
  );
}
