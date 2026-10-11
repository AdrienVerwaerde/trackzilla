import type { Thresholds } from '@/api/types';
import { getDatabase } from '@/db/database';

export type CommandStatus = 'pending' | 'sent' | 'acked' | 'failed';
export type CommandKind = 'led' | 'thresholds';

type Base = {
  id: string;
  device: string;
  status: CommandStatus;
  attempts: number;
  reason: string | null;
  createdAt: number;
};

export type QueuedCommand =
  | (Base & { kind: 'led'; payload: { led: boolean } })
  | (Base & { kind: 'thresholds'; payload: Thresholds });

type CommandRow = {
  id: string;
  device: string;
  kind: CommandKind;
  payload: string;
  status: CommandStatus;
  attempts: number;
  reason: string | null;
  created_at: number;
};

/** How many entries the Journal keeps per device. */
const HistoryLimit = 50;

const toCommand = (row: CommandRow) =>
  ({
    id: row.id,
    device: row.device,
    kind: row.kind,
    payload: JSON.parse(row.payload),
    status: row.status,
    attempts: row.attempts,
    reason: row.reason,
    createdAt: row.created_at,
  }) as QueuedCommand;

export async function insertCommand(command: QueuedCommand) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO commands (id, device, kind, payload, status, attempts, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      command.id,
      command.device,
      command.kind,
      JSON.stringify(command.payload),
      command.status,
      command.attempts,
      command.reason,
      command.createdAt,
    ]
  );
}

/**
 * Drops still-pending entries of one kind. They never reached the network, so
 * the newer order simply replaces them — see the README on conflicts. Scoped
 * by kind so a threshold edit does not cancel a waiting LED order.
 */
export async function dropPending(device: string, kind: CommandKind) {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM commands WHERE device = ? AND kind = ? AND status = 'pending'`, [
    device,
    kind,
  ]);
}

export async function updateCommand(
  id: string,
  fields: { status: CommandStatus; attempts?: number; reason?: string | null }
) {
  const db = await getDatabase();
  const { status, attempts, reason = null } = fields;

  if (attempts === undefined) {
    await db.runAsync('UPDATE commands SET status = ?, reason = ? WHERE id = ?', [
      status,
      reason,
      id,
    ]);
    return;
  }

  await db.runAsync('UPDATE commands SET status = ?, attempts = ?, reason = ? WHERE id = ?', [
    status,
    attempts,
    reason,
    id,
  ]);
}

/** Everything still owed to the backend, oldest first: the queue drains in order. */
export async function readUnsent(device: string): Promise<QueuedCommand[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CommandRow>(
    `SELECT * FROM commands WHERE device = ? AND status = 'pending' ORDER BY created_at, rowid`,
    [device]
  );

  return rows.map(toCommand);
}

/** Recent entries, newest first, for the dashboard and the Journal. */
export async function readRecent(device: string): Promise<QueuedCommand[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CommandRow>(
    `SELECT * FROM commands WHERE device = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    [device, HistoryLimit]
  );

  return rows.map(toCommand);
}

/** A kill mid-flight leaves entries claiming to be sent; they must be retried. */
export async function resetInFlight(device: string) {
  const db = await getDatabase();

  await db.runAsync(`UPDATE commands SET status = 'pending' WHERE device = ? AND status = 'sent'`, [
    device,
  ]);
}

export async function pruneCommands(device: string) {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM commands
     WHERE device = ?
       AND id NOT IN (SELECT id FROM commands WHERE device = ? ORDER BY created_at DESC LIMIT ?)`,
    [device, device, HistoryLimit]
  );
}
