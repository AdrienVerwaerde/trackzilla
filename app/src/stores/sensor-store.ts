import { BatteryState } from 'expo-battery';
import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

/** Grows as new sensors are added (location, …). */
export type LogSource = 'lifecycle' | 'accelerometer' | 'battery' | 'telemetry';

export type LogEvent = {
  id: number;
  /** Timestamp of the event. */
  at: number;
  source: LogSource;
  message: string;
  /** For a transition: time spent in the state being left. */
  durationMs?: number;
};

export type AccelerometerSample = {
  x: number;
  y: number;
  z: number;
};

export type AccelerometerStatus =
  /** Not subscribed yet. */
  | 'idle'
  /** Subscribed and receiving samples. */
  | 'active'
  /** Subscription cut because the app left the foreground. */
  | 'paused'
  /** No accelerometer on this device. */
  | 'unavailable'
  /** Motion permission refused (iOS). */
  | 'denied';

/** Update intervals offered by the UI, in milliseconds. */
export const UpdateIntervals = [50, 200, 1000] as const;

export type UpdateInterval = (typeof UpdateIntervals)[number];

/** Above this magnitude, the device is being shaken (1 g at rest). */
export const ShakeThreshold = 1.6;

/** Keep the log bounded: only the most recent events are useful. */
const MaxLogLength = 100;

const BatteryStateMessages: Record<BatteryState, string> = {
  [BatteryState.UNKNOWN]: 'unknown state',
  [BatteryState.UNPLUGGED]: 'on battery',
  [BatteryState.CHARGING]: 'on charge',
  [BatteryState.FULL]: 'full',
  [BatteryState.NOT_CHARGING]: 'plugged in, not charging',
};

const AccelerometerStatusMessages: Partial<Record<AccelerometerStatus, string>> = {
  active: 'Accelerometer : active',
  paused: 'Accelerometer : paused',
  unavailable: 'Accelerometer : unavailable',
  denied: 'Accelerometer : permission denied',
};

const ZeroSample: AccelerometerSample = { x: 0, y: 0, z: 0 };

let nextLogId = 1;

type SensorState = {
  appState: AppStateStatus;
  /** Timestamp the app entered `appState`. */
  enteredAt: number;
  /** Cumulative time spent outside of `active`. */
  backgroundMs: number;
  /** Most recent event first. */
  log: LogEvent[];

  accelerometer: AccelerometerSample;
  /** √(x² + y² + z²) of the last sample, in g. */
  magnitude: number;
  /** Samples received since the app started. */
  samples: number;
  accelerometerStatus: AccelerometerStatus;
  updateInterval: UpdateInterval;

  /** Between 0 and 1, or -1 when unknown. */
  batteryLevel: number;
  batteryState: BatteryState;
  lowPowerMode: boolean;
  batteryAvailable: boolean;

  pushLog: (source: LogSource, message: string, durationMs?: number) => void;
  setAppState: (next: AppStateStatus) => void;
  pushAccelerometerSample: (sample: AccelerometerSample) => void;
  setAccelerometerStatus: (status: AccelerometerStatus) => void;
  setUpdateInterval: (interval: UpdateInterval) => void;
  setBatteryLevel: (level: number) => void;
  setBatteryState: (state: BatteryState) => void;
  setLowPowerMode: (enabled: boolean) => void;
  setBatteryAvailable: (available: boolean) => void;
  clearLog: () => void;
};

export const useSensorStore = create<SensorState>((set, get) => ({
  appState: AppState.currentState,
  enteredAt: Date.now(),
  backgroundMs: 0,
  log: [],

  accelerometer: ZeroSample,
  magnitude: 0,
  samples: 0,
  accelerometerStatus: 'idle',
  updateInterval: 200,

  batteryLevel: -1,
  batteryState: BatteryState.UNKNOWN,
  lowPowerMode: false,
  batteryAvailable: true,

  pushLog: (source, message, durationMs) =>
    set((state) => ({
      log: [{ id: nextLogId++, at: Date.now(), source, message, durationMs }, ...state.log].slice(
        0,
        MaxLogLength
      ),
    })),

  setAppState: (next) => {
    const { appState, enteredAt, backgroundMs, pushLog } = get();
    if (next === appState) return;

    const at = Date.now();
    const elapsed = at - enteredAt;

    set({
      appState: next,
      enteredAt: at,
      // Anything that is not `active` counts as time away from the app.
      backgroundMs: appState === 'active' ? backgroundMs : backgroundMs + elapsed,
    });
    pushLog('lifecycle', `${appState} → ${next}`, elapsed);
  },

  pushAccelerometerSample: ({ x, y, z }) =>
    set((state) => ({
      accelerometer: { x, y, z },
      magnitude: Math.sqrt(x * x + y * y + z * z),
      samples: state.samples + 1,
    })),

  // Logging lives here so that the journal can never disagree with the status
  // the UI shows.
  setAccelerometerStatus: (status) => {
    const { accelerometerStatus, pushLog } = get();
    if (status === accelerometerStatus) return;

    set({
      accelerometerStatus: status,
      // Stale readings would look like a live sensor once paused.
      ...(status === 'active' ? null : { accelerometer: ZeroSample, magnitude: 0 }),
    });

    const message = AccelerometerStatusMessages[status];
    if (message) pushLog('accelerometer', message);
  },

  setUpdateInterval: (interval) => {
    const { updateInterval, pushLog } = get();
    if (interval === updateInterval) return;

    set({ updateInterval: interval });
    pushLog('accelerometer', `Intervalle : ${interval} ms`);
  },

  setBatteryLevel: (level) => {
    const { batteryLevel, pushLog } = get();
    // The platform reports 1 % steps: rounding keeps one log line per step.
    if (Math.round(level * 100) === Math.round(batteryLevel * 100)) return;

    set({ batteryLevel: level });
    pushLog('battery', `Battery : ${Math.round(level * 100)} %`);
  },

  setBatteryState: (state) => {
    const { batteryState, pushLog } = get();
    if (state === batteryState) return;

    set({ batteryState: state });
    pushLog('battery', `Battery : ${BatteryStateMessages[state]}`);
  },

  setLowPowerMode: (enabled) => {
    const { lowPowerMode, pushLog } = get();
    if (enabled === lowPowerMode) return;

    set({ lowPowerMode: enabled });
    pushLog('battery', `Économie d'énergie : ${enabled ? 'activée' : 'désactivée'}`);
  },

  setBatteryAvailable: (available) => set({ batteryAvailable: available }),

  clearLog: () => set({ log: [] }),
}));
