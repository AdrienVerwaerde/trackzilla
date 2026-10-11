import type { Thresholds } from '@/api/types';
import { getDatabase } from '@/db/database';

type ThresholdRow = {
  t_min: number | null;
  t_max: number | null;
  h_min: number | null;
  h_max: number | null;
  hold_minutes: number;
};

export async function readThresholds(device: string): Promise<Thresholds | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ThresholdRow>(
    'SELECT * FROM thresholds WHERE device = ?',
    [device]
  );

  if (!row) return null;

  return {
    tMin: row.t_min,
    tMax: row.t_max,
    hMin: row.h_min,
    hMax: row.h_max,
    holdMinutes: row.hold_minutes,
  };
}

export async function saveThresholds(device: string, thresholds: Thresholds) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT OR REPLACE INTO thresholds (device, t_min, t_max, h_min, h_max, hold_minutes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      device,
      thresholds.tMin,
      thresholds.tMax,
      thresholds.hMin,
      thresholds.hMax,
      thresholds.holdMinutes,
    ]
  );
}
