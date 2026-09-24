import { useEffect } from 'react';

import { getDevices, getMeasurements, nowSeconds } from '@/api/client';
import { WsUrl } from '@/api/config';
import type { SocketEvent } from '@/api/types';
import { useSensorStore } from '@/stores/sensor-store';
import { LiveWindowSeconds, useTelemetryStore } from '@/stores/telemetry-store';

/** Delay before trying the backend again after the socket dropped. */
const RetryDelayMs = 3000;

/** Fills the sliding window from REST: on open, and after every gap. */
async function loadRecent() {
  const { deviceId, setDevice, mergeMeasurements } = useTelemetryStore.getState();

  try {
    const device = (await getDevices()).find((d) => d.id === deviceId);
    // The backend only knows a device once it has heard from it: asking for its
    // measurements before that is a 404.
    if (!device) return;

    setDevice(device);
    mergeMeasurements(await getMeasurements(deviceId, { from: nowSeconds() - LiveWindowSeconds }));
  } catch (error) {
    console.warn('[telemetry] REST reload failed', error);
  }
}

/**
 * Keeps the backend WebSocket open only while the app is in the foreground.
 * Mount it once, at the root of the app.
 */
export function useTelemetrySocket() {
  const appState = useSensorStore((state) => state.appState);

  useEffect(() => {
    const { setConnection, handleEvent } = useTelemetryStore.getState();

    // No socket outside the foreground: nobody is looking at the curve.
    if (appState !== 'active') {
      setConnection('idle');
      return;
    }

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      // While retrying, the screen keeps saying "hors ligne" rather than
      // flickering to "connexion…" every three seconds.
      if (useTelemetryStore.getState().connection !== 'lost') setConnection('connecting');

      socket = new WebSocket(WsUrl);

      socket.onopen = () => {
        setConnection('open');
        // Socket first, REST second: a measurement arriving while the history
        // loads is caught by the socket, and the store drops the duplicate.
        // The other order leaves a hole between the two.
        loadRecent();
      };

      socket.onmessage = (message) => {
        // A malformed frame must not take the dashboard down.
        try {
          handleEvent(JSON.parse(String(message.data)) as SocketEvent);
        } catch {
          console.warn('[telemetry] unreadable frame', message.data);
        }
      };

      // `onerror` is always followed by `onclose`: reconnecting from here alone
      // avoids scheduling two retries for one failure.
      socket.onclose = () => {
        socket = null;
        if (cancelled) return;

        setConnection('lost');
        retry = setTimeout(connect, RetryDelayMs);
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [appState]);
}
