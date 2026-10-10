import type { JournalEvent } from '@/api/types';
import type { QueuedCommand } from '@/db/command-cache';
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

function fromCommand(command: QueuedCommand): JournalEntry {
  const replayed = command.attempts > 1 ? ' · rejouée' : '';
  const reason = command.status === 'failed' && command.reason ? ` (${command.reason})` : '';

  return {
    key: `c-${command.id}`,
    at: command.createdAt,
    tag: 'commande',
    tone: CommandTones[command.status],
    label: `LED ${command.led ? 'allumée' : 'éteinte'} · ${CommandLabels[command.status]}${reason}${replayed}`,
  };
}

/** The backend's journal and the local queue, newest first. */
export function toJournalEntries(events: JournalEvent[], commands: QueuedCommand[]): JournalEntry[] {
  const entries = [
    ...events.map(fromEvent).filter((entry): entry is JournalEntry => entry !== null),
    ...commands.map(fromCommand),
  ];

  return entries.sort((a, b) => b.at - a.at || b.key.localeCompare(a.key));
}
