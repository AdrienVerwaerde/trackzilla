import { create } from 'zustand';

import { nowSeconds } from '@/api/client';
import { DeviceId } from '@/api/config';
import type { Device, DeviceStatus, Measurement, SocketEvent, ThresholdKind } from '@/api/types';
import { useSensorStore } from '@/stores/sensor-store';
import { ThresholdLabels } from '@/utils/format';

/** Length of the dashboard's sliding window, in seconds. */
export const LiveWindowSeconds = 10 * 60;

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
  /** `unknown` until `GET /devices` or a `device_status` event says otherwise. */
  deviceStatus: DeviceStatus | 'unknown';
  /** Epoch seconds of the device's last activity. */
  lastSeen: number | null;
  /** Oldest first, deduplicated by `ts`, trimmed to `LiveWindowSeconds`. */
  measurements: Measurement[];
  /**
   * Most recent measurement, kept even once it leaves the window: the
   * "capteur hors ligne" screen must still show the last value and its time.
   */
  last: Measurement | null;
  alerts: Partial<Record<ThresholdKind, ActiveAlert>>;

  setConnection: (connection: BackendConnection) => void;
  setDevice: (device: Device) => void;
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
  deviceStatus: 'unknown',
  lastSeen: null,
  measurements: [],
  last: null,
  alerts: {},

  setConnection: (connection) => {
    if (connection === get().connection) return;

    set({ connection });
    const message = ConnectionMessages[connection];
    if (message) log(message);
  },

  setDevice: (device) => {
    if (device.id !== get().deviceId) return;
    set({ deviceStatus: device.status, lastSeen: device.lastSeen });
  },

  mergeMeasurements: (incoming) => {
    if (incoming.length === 0) return;

    const { measurements, last, lastSeen } = get();
    // Keyed by ts: a measurement received by REST and again by the socket
    // (reload after background) must appear once.
    const byTs = new Map(measurements.map((m) => [m.ts, m]));
    for (const m of incoming) byTs.set(m.ts, m);

    const since = nowSeconds() - LiveWindowSeconds;
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
