import { getDatabase } from '@/db/database';

export type CommandStatus = 'pending' | 'sent' | 'acked' | 'failed';

export type QueuedCommand = {
  id: string;
  device: string;
  led: boolean;
  status: CommandStatus;
  attempts: number;
  reason: string | null;
  createdAt: number;
};

type CommandRow = {
  id: string;
  device: string;
  led: number;
  status: CommandStatus;
  attempts: number;
  reason: string | null;
  created_at: number;
};

/** How many entries the Journal keeps per device. */
const HistoryLimit = 50;

const toCommand = (row: CommandRow): QueuedCommand => ({
  id: row.id,
  device: row.device,
  led: row.led === 1,
  status: row.status,
  attempts: row.attempts,
  reason: row.reason,
  createdAt: row.created_at,
});

export async function insertCommand(command: QueuedCommand) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO commands (id, device, led, status, attempts, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      command.id,
      command.device,
      command.led ? 1 : 0,
      command.status,
      command.attempts,
      command.reason,
      command.createdAt,
    ]
  );
}

/**
 * Drops still-pending commands for a device. They never reached the network,
 * so the newer order simply replaces them — see the README on conflicts.
 */
export async function dropPending(device: string) {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM commands WHERE device = ? AND status = 'pending'`, [device]);
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

/** Recent commands, newest first, for the dashboard and the Journal. */
export async function readRecent(device: string): Promise<QueuedCommand[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<CommandRow>(
    `SELECT * FROM commands WHERE device = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    [device, HistoryLimit]
  );

  return rows.map(toCommand);
}

/** A kill mid-flight leaves commands claiming to be sent; they must be retried. */
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
