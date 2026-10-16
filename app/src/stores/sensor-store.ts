import { AppState, type AppStateStatus } from 'react-native';
import { create } from 'zustand';

type SensorState = {
  /** Drives the socket and the queue: both stop outside the foreground. */
  appState: AppStateStatus;
  setAppState: (next: AppStateStatus) => void;
};

export const useSensorStore = create<SensorState>((set) => ({
  appState: AppState.currentState,

  setAppState: (next) => set({ appState: next }),
}));
