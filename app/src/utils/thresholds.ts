import type { Thresholds } from '@/api/types';

/** Mirrors the backend's rules, so a bad value is caught before it is queued. */
const TemperatureRange = { min: -10, max: 50 };
const HumidityRange = { min: 0, max: 100 };
const MaxHoldMinutes = 1440;

export type ThresholdField = keyof Thresholds;

export type ThresholdErrors = Partial<Record<ThresholdField, string>>;

const inRange = (value: number, { min, max }: { min: number; max: number }) =>
  value >= min && value <= max;

/**
 * An empty bound is a bound nobody watches, which the backend accepts as null.
 * Anything else must parse as a number.
 */
export function parseBound(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export function validate(thresholds: Thresholds): ThresholdErrors {
  const errors: ThresholdErrors = {};
  const { tMin, tMax, hMin, hMax, holdMinutes } = thresholds;

  for (const field of ['tMin', 'tMax'] as const) {
    const value = thresholds[field];
    if (value !== null && !inRange(value, TemperatureRange)) {
      errors[field] = `Entre ${TemperatureRange.min} et ${TemperatureRange.max} °C`;
    }
  }

  for (const field of ['hMin', 'hMax'] as const) {
    const value = thresholds[field];
    if (value !== null && !inRange(value, HumidityRange)) {
      errors[field] = `Entre ${HumidityRange.min} et ${HumidityRange.max} %`;
    }
  }

  // A min at or above its max leaves no room to be in range: the alert would
  // never stop.
  if (tMin !== null && tMax !== null && tMin >= tMax) {
    errors.tMin = 'Doit rester sous le maximum';
  }
  if (hMin !== null && hMax !== null && hMin >= hMax) {
    errors.hMin = 'Doit rester sous le maximum';
  }

  if (!Number.isInteger(holdMinutes) || holdMinutes < 0 || holdMinutes > MaxHoldMinutes) {
    errors.holdMinutes = `Entre 0 et ${MaxHoldMinutes} minutes`;
  }

  return errors;
}
