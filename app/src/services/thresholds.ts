import { getThresholds } from '@/api/client';
import type { Thresholds } from '@/api/types';
import { readThresholds, saveThresholds } from '@/db/threshold-cache';
import { useThresholdStore } from '@/stores/threshold-store';

/** Cache first, so the screen opens offline. */
export async function restoreThresholds(device: string) {
  const store = useThresholdStore.getState();

  try {
    const cached = await readThresholds(device);
    if (cached) store.setThresholds(cached);
  } catch (error) {
    console.warn('[thresholds] restore failed', error);
  } finally {
    store.markLoaded();
  }
}

export async function syncThresholds(device: string) {
  try {
    const thresholds = await getThresholds(device);
    await saveThresholds(device, thresholds);
    useThresholdStore.getState().setThresholds(thresholds);
  } catch (error) {
    console.warn('[thresholds] sync failed', error);
  }
}

/**
 * Applied locally before the queue sends it: the screen must show the value
 * the user chose, whether or not the backend has heard about it yet.
 */
export async function applyThresholds(device: string, thresholds: Thresholds) {
  useThresholdStore.getState().setThresholds(thresholds);
  await saveThresholds(device, thresholds);
}
