import { getThresholds, recordEvent } from './store.js';

/**
 * The four bounds the contract names, each tied to the field it watches and
 * to the side of the range it guards.
 */
const Bounds = [
  { kind: 'tMin', field: 't', isBreached: (value, bound) => value < bound },
  { kind: 'tMax', field: 't', isBreached: (value, bound) => value > bound },
  { kind: 'hMin', field: 'h', isBreached: (value, bound) => value < bound },
  { kind: 'hMax', field: 'h', isBreached: (value, bound) => value > bound },
];

/**
 * `device -> kind -> { since, alerted }`, the memory that keeps one alert per
 * breach instead of one every five seconds.
 *
 * It lives in memory on purpose: a restart resets the hold timers, which is
 * the safe direction. Rebuilding it from `events` would let a breach that
 * ended while the backend was down fire the moment it comes back.
 */
const states = new Map();

const stateFor = (device, kind) => {
  if (!states.has(device)) states.set(device, new Map());

  const perKind = states.get(device);
  if (!perKind.has(kind)) perKind.set(kind, { since: null, alerted: false });

  return perKind.get(kind);
};

/**
 * Judges one reading against the device thresholds and returns the events it
 * triggers — none most of the time, which is the point.
 *
 * Three rules, straight from the brief: an alert only once the breach has
 * lasted `holdMinutes`, only once per breach, and an `alert_cleared` when the
 * value returns inside the range.
 */
export function evaluate({ device, ts, t, h }) {
  const thresholds = getThresholds(device);
  const holdSeconds = thresholds.holdMinutes * 60;
  const reading = { t, h };
  const events = [];

  for (const { kind, field, isBreached } of Bounds) {
    const bound = thresholds[kind];
    const value = reading[field];

    // A null bound is a bound nobody watches; a missing field says nothing.
    if (bound === null || bound === undefined || !Number.isFinite(value)) continue;

    const state = stateFor(device, kind);

    if (isBreached(value, bound)) {
      // First reading outside the range: start the clock, stay silent.
      state.since ??= ts;

      if (!state.alerted && ts - state.since >= holdSeconds) {
        state.alerted = true;
        events.push({ type: 'alert', device, ts, kind, value, threshold: bound });
      }
      continue;
    }

    // Back inside the range. Only worth announcing if an alert went out.
    if (state.alerted) {
      events.push({ type: 'alert_cleared', device, ts, kind });
    }

    state.since = null;
    state.alerted = false;
  }

  for (const { type, ...payload } of events) {
    recordEvent(device, ts, type, payload);
  }

  return events;
}

/** Test seam: the hold timers are process state, not database state. */
export const resetAlertState = () => states.clear();
