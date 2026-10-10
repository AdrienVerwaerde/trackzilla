import { ApiError, putThresholds, sendCommand } from '@/api/client';
import type { SocketEvent, Thresholds } from '@/api/types';
import {
  dropPending,
  insertCommand,
  pruneCommands,
  readRecent,
  readUnsent,
  resetInFlight,
  updateCommand,
  type CommandStatus,
  type QueuedCommand,
} from '@/db/command-cache';
import { useCommandStore } from '@/stores/command-store';
import { useSensorStore } from '@/stores/sensor-store';
import { backoffDelay } from '@/utils/backoff';

/** Given up on after this many network failures. */
const MaxAttempts = 5;

// One drainer at a time: the socket opening and NetInfo returning fire together,
// and two passes would send the same order twice.
let draining = false;
let retry: ReturnType<typeof setTimeout> | null = null;

const newId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isForeground = () => useSensorStore.getState().appState === 'active';

function clearRetry() {
  if (retry) clearTimeout(retry);
  retry = null;
}

/** Reads the queue back after a restart; commands left mid-flight are retried. */
export async function restoreQueue(device: string, led: boolean | null) {
  await resetInFlight(device);
  await pruneCommands(device);
  useCommandStore.getState().hydrate(await readRecent(device), led);
}

export const enqueueLed = (device: string, led: boolean) =>
  enqueue({ device, kind: 'led', payload: { led } });

export const enqueueThresholds = (device: string, thresholds: Thresholds) =>
  enqueue({ device, kind: 'thresholds', payload: thresholds });

type NewCommand = Pick<QueuedCommand, 'device' | 'kind' | 'payload'>;

async function enqueue({ device, kind, payload }: NewCommand) {
  const command = {
    id: newId(),
    device,
    kind,
    payload,
    status: 'pending',
    attempts: 0,
    reason: null,
    createdAt: Math.floor(Date.now() / 1000),
  } as QueuedCommand;

  // Only the latest order of a kind survives — see the README on conflicts.
  await dropPending(device, kind);
  useCommandStore.getState().dropPending(device, kind);

  await insertCommand(command);
  const store = useCommandStore.getState();
  store.upsert(command);
  store.setError(null);

  await drainQueue(device);
}

/** Empties the queue in order, in one pass. Nothing happens in the background. */
export async function drainQueue(device: string) {
  if (draining || !isForeground()) return;

  draining = true;
  clearRetry();

  try {
    for (const command of await readUnsent(device)) {
      const keepGoing = await attempt(command);
      if (!keepGoing) break;
    }
  } finally {
    draining = false;
  }
}

/** Called when NetInfo reports the network back: no point waiting out the delay. */
export function drainNow(device: string) {
  clearRetry();
  drainQueue(device);
}

/**
 * A LED order is only `sent` until the box reports back. A threshold PUT has
 * nothing to confirm it: the 200 is the confirmation.
 */
async function send(command: QueuedCommand): Promise<CommandStatus> {
  if (command.kind === 'thresholds') {
    await putThresholds(command.device, command.payload);
    return 'acked';
  }

  const ack = await sendCommand(command.device, { id: command.id, led: command.payload.led });
  return ack.status;
}

/** False when the network is gone and the rest of the pass should wait. */
async function attempt(command: QueuedCommand): Promise<boolean> {
  const attempts = command.attempts + 1;

  try {
    await settle(command.id, await send(command), attempts, null);
    return true;
  } catch (error) {
    // A 4xx is a refusal: the same request will be refused again. A 5xx is the
    // backend having a bad moment, which is worth retrying.
    if (error instanceof ApiError && error.status < 500) {
      await settle(command.id, 'failed', attempts, 'refusée par le serveur');
      return true;
    }

    if (attempts >= MaxAttempts) {
      await settle(command.id, 'failed', attempts, 'abandonnée après plusieurs tentatives');
      return true;
    }

    await settle(command.id, 'pending', attempts, null);
    retry = setTimeout(() => drainQueue(command.device), backoffDelay(attempts));
    return false;
  }
}

async function settle(
  id: string,
  status: QueuedCommand['status'],
  attempts: number,
  reason: string | null
) {
  await updateCommand(id, { status, attempts, reason });
  useCommandStore.getState().patch(id, { status, attempts, reason });

  if (status === 'failed') useCommandStore.getState().setError(`Commande ${reason}`);
}

/** The box's own answer, arriving over the socket. */
export async function handleCommandEvent(event: SocketEvent) {
  const store = useCommandStore.getState();

  if (event.type === 'device_state') return store.setLed(event.led);
  if (event.type !== 'command_status') return;

  const reason = event.reason ?? null;
  await updateCommand(event.id, { status: event.status, reason });
  store.patch(event.id, { status: event.status, reason });

  if (event.status === 'failed') store.setError('Commande non confirmée par le boîtier');
}
