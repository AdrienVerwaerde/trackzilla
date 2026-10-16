import { getDatabase } from '@/db/database';
import type { Device, Measurement } from '@/api/types';
import { LiveWindows } from '@/stores/telemetry-store';

/**
 * How far back the cache keeps readings: exactly as far as the dashboard can
 * draw them.
 *
 * The bound the brief asks for, expressed as the widest window the user can
 * select rather than a round number, so it cannot drift away from what the
 * screen actually shows. At one reading every five seconds that is about 2 160
 * rows per device — a curve worth opening in flight, and a table that stays
 * small enough to read back in one go when the app starts.
 */
export const CacheWindowSeconds = Math.max(...LiveWindows);

type MeasurementRow = { ts: number; t: number | null; h: number | null };
type DeviceRow = {
  id: string;
  group_name: string;
  status: string;
  last_seen: number | null;
  led: number | null;
};

/** The cached readings for a device, oldest first, from `since` onwards. */
export async function readMeasurements(device: string, since: number): Promise<Measurement[]> {
  const db = await getDatabase();

  return db.getAllAsync<MeasurementRow>(
    'SELECT ts, t, h FROM measurements WHERE device = ? AND ts >= ? ORDER BY ts',
    [device, since]
  );
}

/**
 * Writes readings, replacing any already held for the same instant.
 *
 * One statement per row inside a transaction: expo-sqlite has no bulk insert,
 * and a transaction is what keeps a batch of 2 000 from being 2 000 separate
 * disk commits.
 */
export async function saveMeasurements(device: string, measurements: Measurement[]) {
  if (measurements.length === 0) return;

  const db = await getDatabase();
  const statement = await db.prepareAsync(
    'INSERT OR REPLACE INTO measurements (device, ts, t, h) VALUES (?, ?, ?, ?)'
  );

  try {
    await db.withTransactionAsync(async () => {
      for (const { ts, t, h } of measurements) {
        await statement.executeAsync([device, ts, t, h]);
      }
    });
  } finally {
    await statement.finalizeAsync();
  }
}

/**
 * Drops readings that have fallen out of the cache window.
 *
 * Called when the app starts and after each catch-up rather than on every
 * insert: a reading arrives every five seconds, and a DELETE scanning the
 * table that often would cost far more than the handful of rows it reclaims.
 */
export async function pruneMeasurements(device: string, now: number) {
  const db = await getDatabase();

  await db.runAsync('DELETE FROM measurements WHERE device = ? AND ts < ?', [
    device,
    now - CacheWindowSeconds,
  ]);
}

/** The device's last known state, or null when nothing has been cached yet. */
export async function readDevice(device: string): Promise<Device | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<DeviceRow>('SELECT * FROM devices WHERE id = ?', [device]);

  if (!row) return null;

  return {
    id: row.id,
    group: row.group_name,
    // Narrowed on the way out: the column is text, the app's type is a union.
    status: row.status === 'online' ? 'online' : 'offline',
    lastSeen: row.last_seen ?? 0,
    led: row.led === null ? null : row.led === 1,
  };
}

export async function saveDevice(device: Device) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO devices (id, group_name, status, last_seen, led)
     VALUES (?, ?, ?, ?, ?)`,
    [
      device.id,
      device.group,
      device.status,
      device.lastSeen,
      device.led === null ? null : Number(device.led),
    ]
  );
}

export async function saveDeviceLed(device: string, led: boolean) {
  const db = await getDatabase();

  await db.runAsync('UPDATE devices SET led = ? WHERE id = ?', [Number(led), device]);
}

/**
 * Records a status change on its own, without touching `last_seen`: a device
 * going quiet is the backend's verdict about silence, not a sign of life.
 */
export async function saveDeviceStatus(device: string, status: Device['status']) {
  const db = await getDatabase();

  await db.runAsync('UPDATE devices SET status = ? WHERE id = ?', [status, device]);
}
