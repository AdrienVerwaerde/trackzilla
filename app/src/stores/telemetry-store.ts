import { create } from 'zustand';

import { nowSeconds } from '@/api/client';
import { DeviceId } from '@/api/config';
import type { Device, DeviceStatus, Measurement, SocketEvent, ThresholdKind } from '@/api/types';
import { useSensorStore } from '@/stores/sensor-store';
import { ThresholdLabels } from '@/utils/format';

/** Lengths of the dashboard's sliding window the user can pick, in seconds. */
export const LiveWindows = [10 * 60, 60 * 60, 3 * 60 * 60] as const;

export type LiveWindow = (typeof LiveWindows)[number];

export type BackendConnection =
  /** Socket not opened yet, or closed on purpose (app in background). */
  | 'idle'
  | 'connecting'
  | 'open'
  /** Socket dropped or backend unreachable: the "vous êtes hors ligne" case. */
  | 'lost';

export type ActiveAlert = {
  ts: number;
  value: number;
  threshold: number;
};

type TelemetryState = {
  /** The device shown on the dashboard; events from other devices are ignored. */
  deviceId: string;
  connection: BackendConnection;
  /**
   * Epoch ms of the reconnection attempt the socket has scheduled, or null when
   * none is pending. The banner counts down to it.
   */
  nextAttemptAt: number | null;
  /**
   * False until the local cache has been read. It separates "nothing was ever
   * stored" from "not read yet", so an empty dashboard can say which it is
   * instead of showing a blank chart that might still fill in.
   */
  hydrated: boolean;
  /** `unknown` until the cache, `GET /devices` or a `device_status` event says otherwise. */
  deviceStatus: DeviceStatus | 'unknown';
  /** Epoch seconds of the device's last activity. */
  lastSeen: number | null;
  /** Length of the dashboard's sliding window. */
  windowSeconds: LiveWindow;
  /** Oldest first, deduplicated by `ts`, trimmed to `windowSeconds`. */
  measurements: Measurement[];
  /**
   * Most recent measurement, kept even once it leaves the window: the
   * "capteur hors ligne" screen must still show the last value and its time.
   */
  last: Measurement | null;
  alerts: Partial<Record<ThresholdKind, ActiveAlert>>;

  setConnection: (connection: BackendConnection) => void;
  /** Announced by the socket hook right after it schedules a retry. */
  setNextAttemptAt: (nextAttemptAt: number | null) => void;
  /** Called once the cache has been read, whether or not it held anything. */
  markHydrated: () => void;
  setDevice: (device: Device) => void;
  /** Shrinking trims at once; growing needs a REST reload (the socket hook does it). */
  setWindowSeconds: (windowSeconds: LiveWindow) => void;
  /** Merges measurements from REST or the socket, in any order. */
  mergeMeasurements: (incoming: Measurement[]) => void;
  handleEvent: (event: SocketEvent) => void;
};

const ConnectionMessages: Partial<Record<BackendConnection, string>> = {
  open: 'Backend : connecté',
  lost: 'Backend : connexion perdue',
};

function log(message: string) {
  useSensorStore.getState().pushLog('telemetry', message);
}

export const useTelemetryStore = create<TelemetryState>((set, get) => ({
  deviceId: DeviceId,
  connection: 'idle',
  nextAttemptAt: null,
  hydrated: false,
  windowSeconds: LiveWindows[0],
  deviceStatus: 'unknown',
  lastSeen: null,
  measurements: [],
  last: null,
  alerts: {},

  setConnection: (connection) => {
    if (connection === get().connection) return;

    // Entering a new state voids the attempt the previous one had scheduled;
    // the hook announces a fresh one when it schedules the next retry.
    set({ connection, nextAttemptAt: null });
    const message = ConnectionMessages[connection];
    if (message) log(message);
  },

  setNextAttemptAt: (nextAttemptAt) => set({ nextAttemptAt }),

  markHydrated: () => set({ hydrated: true }),

  setDevice: (device) => {
    if (device.id !== get().deviceId) return;
    set({ deviceStatus: device.status, lastSeen: device.lastSeen });
  },

  setWindowSeconds: (windowSeconds) => {
    const since = nowSeconds() - windowSeconds;
    set((state) => ({ windowSeconds, measurements: state.measurements.filter((m) => m.ts >= since) }));
  },

  mergeMeasurements: (incoming) => {
    if (incoming.length === 0) return;

    const { measurements, last, lastSeen, windowSeconds } = get();
    // Keyed by ts: a measurement received by REST and again by the socket
    // (reload after background) must appear once.
    const byTs = new Map(measurements.map((m) => [m.ts, m]));
    for (const m of incoming) byTs.set(m.ts, m);

    const since = nowSeconds() - windowSeconds;
    const merged = [...byTs.values()].filter((m) => m.ts >= since).sort((a, b) => a.ts - b.ts);

    const newest = incoming.reduce((a, b) => (b.ts > a.ts ? b : a));
    const isNewer = !last || newest.ts > last.ts;

    set({
      measurements: merged,
      last: isNewer ? newest : last,
      lastSeen: isNewer ? Math.max(newest.ts, lastSeen ?? 0) : lastSeen,
    });
  },

  handleEvent: (event) => {
    if (event.device !== get().deviceId) return;

    switch (event.type) {
      case 'measurement': {
        const { ts, t, h } = event;
        get().mergeMeasurements([{ ts, t, h }]);
        break;
      }

      case 'device_status':
        if (event.status === get().deviceStatus) return;
        set({ deviceStatus: event.status });
        log(`Capteur : ${event.status === 'online' ? 'en ligne' : 'hors ligne'}`);
        break;

      case 'alert': {
        const { kind, ts, value, threshold } = event;
        set((state) => ({ alerts: { ...state.alerts, [kind]: { ts, value, threshold } } }));
        log(`Alerte ${ThresholdLabels[kind]} : ${value} (seuil ${threshold})`);
        break;
      }

      case 'alert_cleared':
        set((state) => {
          const { [event.kind]: _cleared, ...alerts } = state.alerts;
          return { alerts };
        });
        log(`Retour à la normale : ${ThresholdLabels[event.kind]}`);
        break;
    }
  },
}));
