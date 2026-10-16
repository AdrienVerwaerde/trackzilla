import type { JournalEvent } from '@/api/types';
import type { QueuedCommand } from '@/db/command-cache';
import type { ConnectionEntry } from '@/db/connection-log';
import { formatValue, ThresholdLabels } from '@/utils/format';

export type JournalTone = 'alert' | 'ok' | 'pending' | 'neutral';

export type JournalEntry = {
  key: string;
  /** Epoch seconds. */
  at: number;
  tag: string;
  label: string;
  tone: JournalTone;
};

const CommandLabels: Record<QueuedCommand['status'], string> = {
  pending: 'en attente',
  sent: 'envoyée',
  acked: 'confirmée',
  failed: 'échec',
};

const CommandTones: Record<QueuedCommand['status'], JournalTone> = {
  pending: 'pending',
  sent: 'pending',
  acked: 'ok',
  failed: 'alert',
};

function fromEvent(event: JournalEvent): JournalEntry | null {
  const base = { key: `e-${event.eventId}`, at: event.ts };

  switch (event.type) {
    case 'alert':
      return {
        ...base,
        tag: 'alerte',
        tone: 'alert',
        label: `${ThresholdLabels[event.kind!]} : ${formatValue(event.value)} (seuil ${formatValue(event.threshold)})`,
      };

    case 'alert_cleared':
      return {
        ...base,
        tag: 'alerte',
        tone: 'ok',
        label: `Retour à la normale : ${ThresholdLabels[event.kind!]}`,
      };

    case 'status':
      return {
        ...base,
        tag: 'capteur',
        tone: 'neutral',
        label: event.status === 'online' ? 'Capteur en ligne' : 'Capteur hors ligne',
      };

    // The local queue says the same thing with the attempt count, and says it
    // offline too. Showing both would list every command twice.
    default:
      return null;
  }
}

const subject = (command: QueuedCommand) =>
  command.kind === 'led' ? `LED ${command.payload.led ? 'allumée' : 'éteinte'}` : 'Seuils modifiés';

function fromCommand(command: QueuedCommand): JournalEntry {
  const replayed = command.attempts > 1 ? ' · rejouée' : '';
  const reason = command.status === 'failed' && command.reason ? ` (${command.reason})` : '';

  return {
    key: `c-${command.id}`,
    at: command.createdAt,
    tag: command.kind === 'led' ? 'commande' : 'réglages',
    tone: CommandTones[command.status],
    label: `${subject(command)} · ${CommandLabels[command.status]}${reason}${replayed}`,
  };
}

/** The backend's journal and the local queue, newest first. */
/** The phone's side: the sensor's own transitions come from backend events. */
const fromConnection = (entry: ConnectionEntry): JournalEntry => ({
  key: `n-${entry.id}`,
  at: entry.ts,
  tag: 'réseau',
  tone: entry.state === 'online' ? 'ok' : 'neutral',
  label: entry.state === 'online' ? 'En ligne' : 'Hors ligne',
});

export function toJournalEntries(
  events: JournalEvent[],
  commands: QueuedCommand[],
  connections: ConnectionEntry[]
): JournalEntry[] {
  const entries = [
    ...events.map(fromEvent).filter((entry): entry is JournalEntry => entry !== null),
    ...commands.map(fromCommand),
    ...connections.map(fromConnection),
  ];

  return entries.sort((a, b) => b.at - a.at || b.key.localeCompare(a.key));
}
