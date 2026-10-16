import { beforeEach, describe, expect, test } from '@jest/globals';

import { evaluate, resetAlertState } from '../src/alerts.js';
import { saveThresholds } from '../src/store.js';

const device = 'esp-test';
const start = 1_790_000_000;

/** Only `tMax` is watched, held 10 minutes: the other bounds stay out of the way. */
const thresholds = { tMin: null, tMax: 30, hMin: null, hMax: null, holdMinutes: 10 };

/** A reading `seconds` after the start, at temperature `t`. */
const at = (seconds, t) => evaluate({ device, ts: start + seconds, t, h: 50 });

const types = (events) => events.map((event) => event.type);

beforeEach(() => {
  // The hold timers live in memory: each test starts with no breach in progress.
  resetAlertState();
  saveThresholds(device, thresholds);
});

describe('threshold judgement', () => {
  test('a breach shorter than holdMinutes raises nothing, and clears nothing', () => {
    expect(at(0, 31)).toEqual([]); // above tMax: the clock starts, silently
    expect(at(5 * 60, 31)).toEqual([]); // 5 min in, still within the hold
    expect(at(6 * 60, 25)).toEqual([]); // back in range before 10 min: never alerted
  });

  test('a breach held for holdMinutes raises exactly one alert', () => {
    expect(at(0, 31)).toEqual([]);
    expect(at(10 * 60 - 1, 31.5)).toEqual([]); // one second short

    expect(at(10 * 60, 32)).toEqual([
      { type: 'alert', device, ts: start + 600, kind: 'tMax', value: 32, threshold: 30 },
    ]);

    // Still above, readings keep coming every 5 s: no second alert.
    expect(at(10 * 60 + 5, 33)).toEqual([]);
    expect(at(30 * 60, 33)).toEqual([]);
  });

  test('back in range after an alert raises one alert_cleared, and the next breach starts over', () => {
    at(0, 31);
    expect(types(at(10 * 60, 31))).toEqual(['alert']);

    expect(at(11 * 60, 29)).toEqual([{ type: 'alert_cleared', device, ts: start + 660, kind: 'tMax' }]);
    expect(at(12 * 60, 29)).toEqual([]); // cleared once, not on every reading

    // A new breach waits its own full hold before alerting again.
    expect(at(13 * 60, 31)).toEqual([]);
    expect(at(13 * 60 + 9 * 60, 31)).toEqual([]);
    expect(types(at(13 * 60 + 10 * 60, 31))).toEqual(['alert']);
  });

  test('a value exactly on the threshold is not a breach', () => {
    expect(at(0, 30)).toEqual([]);
    expect(at(60 * 60, 30)).toEqual([]);
  });

  test('a bound set to null is not watched', () => {
    saveThresholds(device, { ...thresholds, tMax: null });
    expect(at(0, 45)).toEqual([]);
    expect(at(60 * 60, 45)).toEqual([]);
  });
});
