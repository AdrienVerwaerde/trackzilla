import { getEvents } from '@/api/client';
import type { SocketEvent } from '@/api/types';
import { lastEventTs, pruneEvents, readEvents, saveEvents } from '@/db/event-cache';
import { useJournalStore } from '@/stores/journal-store';

/** Socket events that mean the backend wrote a journal row we do not have. */
const JournalWorthy: SocketEvent['type'][] = ['alert', 'alert_cleared', 'device_status'];

let syncing = false;

export async function restoreJournal(device: string) {
  useJournalStore.getState().setEvents(await readEvents(device));
}

/**
 * Pulls the journal rows the app is missing. `from` is the newest ts held and
 * is inclusive, so a second holding several events is never half-read; the
 * eventId key drops what is already there.
 */
export async function syncJournal(device: string) {
  if (syncing) return;
  syncing = true;

  try {
    const from = await lastEventTs(device);
    const events = await getEvents(device, from === null ? {} : { from });

    await saveEvents(events);
    await pruneEvents(device);
    useJournalStore.getState().mergeEvents(events);
  } catch (error) {
    console.warn('[journal] sync failed', error);
  } finally {
    syncing = false;
  }
}

/** The socket only signals that something happened; the row itself comes by REST. */
export function handleJournalEvent(event: SocketEvent, device: string) {
  if (event.device !== device || !JournalWorthy.includes(event.type)) return;

  syncJournal(device);
}
