import { getEvents, nowSeconds } from '@/api/client';
import type { SocketEvent } from '@/api/types';
import {
  insertConnection,
  pruneConnections,
  readConnections,
  type ConnectionState,
} from '@/db/connection-log';
import { lastEventTs, pruneEvents, readEvents, saveEvents } from '@/db/event-cache';
import { useJournalStore } from '@/stores/journal-store';
import type { BackendConnection } from '@/stores/telemetry-store';

/** Socket events that mean the backend wrote a journal row we do not have. */
const JournalWorthy: SocketEvent['type'][] = ['alert', 'alert_cleared', 'device_status'];

let syncing = false;

/**
 * Restore and connection writes run one after the other. A change recorded
 * before the log is read back would be compared to an empty list and logged
 * twice.
 */
let chain: Promise<void> = Promise.resolve();

const enqueue = (task: () => Promise<void>) => {
  chain = chain.then(task).catch((error) => console.warn('[journal]', error));
  return chain;
};

export function restoreJournal(device: string) {
  return enqueue(async () => {
    const [events, connections] = await Promise.all([readEvents(device), readConnections()]);
    const store = useJournalStore.getState();
    store.setEvents(events);
    store.setConnections(connections);
  });
}

/**
 * Logs the app going offline or coming back. Background (`idle`) and the
 * retries in between (`connecting`) are not changes of state, and a repeated
 * state is not news: a flaky link is one « hors ligne », not one per retry.
 */
export function recordConnection(connection: BackendConnection) {
  const states: Partial<Record<BackendConnection, ConnectionState>> = {
    open: 'online',
    lost: 'offline',
  };
  const state = states[connection];
  if (!state) return;

  return enqueue(async () => {
    if (useJournalStore.getState().connections[0]?.state === state) return;

    const entry = await insertConnection(state, nowSeconds());
    await pruneConnections();
    useJournalStore.getState().addConnection(entry);
  });
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
