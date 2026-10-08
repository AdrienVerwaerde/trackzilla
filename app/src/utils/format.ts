import type { ThresholdKind } from '@/api/types';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function formatTime(at: number) {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** The hour a value was measured, as the banner says it: "14h02". */
export function formatClock(at: number) {
  const date = new Date(at);
  return `${pad(date.getHours())}h${pad(date.getMinutes())}`;
}

/** Display names of the threshold kinds, shared by the dashboard and the journal. */
export const ThresholdLabels: Record<ThresholdKind, string> = {
  tMin: 'Min-Temp',
  tMax: 'Max-Temp',
  hMin: 'Min-Hum',
  hMax: 'Max-Hum',
};
