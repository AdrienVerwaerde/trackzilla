import { useEffect } from 'react';

import { DeviceId } from '@/api/config';
import { readDevice } from '@/db/telemetry-cache';
import { drainNow, drainQueue, restoreQueue } from '@/services/command-queue';
import { useNetworkStore } from '@/stores/network-store';
import { useSensorStore } from '@/stores/sensor-store';
import { useTelemetryStore } from '@/stores/telemetry-store';

/** Restores the queue at launch and empties it whenever a chance appears. */
export function useCommandQueue() {
  const appState = useSensorStore((state) => state.appState);
  const connection = useTelemetryStore((state) => state.connection);
  const reachable = useNetworkStore((state) => state.reachable);

  useEffect(() => {
    readDevice(DeviceId)
      .then((device) => restoreQueue(DeviceId, device?.led ?? null))
      .catch((error) => console.warn('[queue] restore failed', error));
  }, []);

  useEffect(() => {
    if (appState === 'active' && connection === 'open') drainQueue(DeviceId);
  }, [appState, connection]);

  // NetInfo is the faster of the two signals; the socket may still be retrying.
  useEffect(() => {
    if (appState === 'active' && reachable) drainNow(DeviceId);
  }, [appState, reachable]);
}
