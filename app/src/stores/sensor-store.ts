import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

export type LogSource = 'telemetry';

export type LogEvent = {
  id: number;
  /** Timestamp of the event. */
  at: number;
  source: LogSource;
  message: string;
};

/** Keep the log bounded: only the most recent events are useful. */
const MaxLogLength = 100;

let nextLogId = 1;

type SensorState = {
  /** Drives the socket: open in the foreground, closed otherwise. */
  appState: AppStateStatus;
  /** Most recent event first. */
  log: LogEvent[];

  pushLog: (source: LogSource, message: string) => void;
  setAppState: (next: AppStateStatus) => void;
  clearLog: () => void;
};

export const useSensorStore = create<SensorState>((set) => ({
  appState: AppState.currentState,
  log: [],

  pushLog: (source, message) =>
    set((state) => ({
      log: [{ id: nextLogId++, at: Date.now(), source, message }, ...state.log].slice(0, MaxLogLength),
    })),

  setAppState: (next) => set({ appState: next }),

  clearLog: () => set({ log: [] }),
}));
