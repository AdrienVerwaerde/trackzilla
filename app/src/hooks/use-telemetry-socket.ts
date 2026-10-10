import { useEffect } from 'react';

import { getDevices, getMeasurements, nowSeconds } from '@/api/client';
import { WsUrl } from '@/api/config';
import type { SocketEvent } from '@/api/types';
import {
  pruneMeasurements,
  readMeasurements,
  saveDevice,
  saveDeviceLed,
  saveDeviceStatus,
  saveMeasurements,
} from '@/db/telemetry-cache';
import { handleCommandEvent } from '@/services/command-queue';
import { handleJournalEvent } from '@/services/journal';
import { useCommandStore } from '@/stores/command-store';
import { useNetworkStore } from '@/stores/network-store';
import { useSensorStore } from '@/stores/sensor-store';
import { useTelemetryStore } from '@/stores/telemetry-store';
import { backoffDelay } from '@/utils/backoff';

/**
 * Fills the sliding window from REST, and mirrors what comes back into the
 * cache.
 *
 * `backfill` asks for the whole window. That is what a widened chart needs,
 * since its older half was never fetched. Left false — the reconnection case —
 * only the stretch since the newest reading already held is asked for, which
 * is the brief's "ne rechargez que ce qui manque".
 */
async function loadRecent({ backfill }: { backfill: boolean }) {
  const { deviceId, windowSeconds, last, setDevice, mergeMeasurements } =
    useTelemetryStore.getState();
  const now = nowSeconds();

  try {
    const device = (await getDevices()).find((d) => d.id === deviceId);
    // The backend only knows a device once it has heard from it: asking for its
    // measurements before that is a 404.
    if (!device) return;

    setDevice(device);
    await saveDevice(device);
    if (device.led !== null) useCommandStore.getState().setLed(device.led);

    // `+ 1` because the backend's range is inclusive, and the floor because a
    // cache older than the window leaves a hole a gap-only fetch would keep.
    const windowStart = now - windowSeconds;
    const from = backfill ? windowStart : Math.max(windowStart, (last?.ts ?? 0) + 1);

    const measurements = await getMeasurements(deviceId, { from });
    mergeMeasurements(measurements);
    await saveMeasurements(deviceId, measurements);
    await pruneMeasurements(deviceId, now);
  } catch (error) {
    console.warn('[telemetry] REST reload failed', error);
  }
}

/**
 * Mirrors into the cache what the store has just taken from the socket, so a
 * reading is still there after the app is killed.
 *
 * Writes are not awaited: the stream must not stall on the disk, and a cache
 * that misses a row is a shorter curve, not a wrong one.
 */
function cacheEvent(event: SocketEvent) {
  const { deviceId } = useTelemetryStore.getState();
  if (event.device !== deviceId) return;

  const failed = (error: unknown) => console.warn('[cache] write failed', error);

  if (event.type === 'measurement') {
    const { ts, t, h } = event;
    saveMeasurements(deviceId, [{ ts, t, h }]).catch(failed);
  }

  // No-ops until REST has created the row, which happens on the same open.
  if (event.type === 'device_status') saveDeviceStatus(deviceId, event.status).catch(failed);
  if (event.type === 'device_state') saveDeviceLed(deviceId, event.led).catch(failed);
}

/**
 * Keeps the backend WebSocket open only while the app is in the foreground.
 * Mount it once, at the root of the app.
 */
export function useTelemetrySocket() {
  const appState = useSensorStore((state) => state.appState);
  const windowSeconds = useTelemetryStore((state) => state.windowSeconds);

  // A wider window needs readings the store trimmed away. The cache usually
  // still holds them, so it answers first and the chart widens even in
  // airplane mode; the network then fills whatever the cache lacked.
  useEffect(() => {
    let cancelled = false;

    async function widen() {
      const { deviceId, mergeMeasurements, connection } = useTelemetryStore.getState();
      const cached = await readMeasurements(deviceId, nowSeconds() - windowSeconds);

      if (cancelled) return;
      mergeMeasurements(cached);

      if (connection === 'open') await loadRecent({ backfill: true });
    }

    widen();

    return () => {
      cancelled = true;
    };
  }, [windowSeconds]);

  useEffect(() => {
    const { setConnection, handleEvent, setNextAttemptAt } = useTelemetryStore.getState();

    // No socket outside the foreground: nobody is looking at the curve.
    if (appState !== 'active') {
      setConnection('idle');
      return;
    }

    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let attempt = 0;

    function connect() {
      // While retrying, the screen keeps saying "hors ligne" rather than
      // flickering to "connexion…" every three seconds.
      if (useTelemetryStore.getState().connection !== 'lost') setConnection('connecting');

      socket = new WebSocket(WsUrl);

      socket.onopen = () => {
        attempt = 0;
        setConnection('open');
        // Socket first, REST second: a measurement arriving while the history
        // loads is caught by the socket, and the store drops the duplicate.
        // The other order leaves a hole between the two.
        loadRecent({ backfill: false });
      };

      socket.onmessage = (message) => {
        // A malformed frame must not take the dashboard down.
        try {
          const event = JSON.parse(String(message.data)) as SocketEvent;
          handleEvent(event);
          cacheEvent(event);
          handleCommandEvent(event).catch((error) => console.warn('[queue]', error));
          handleJournalEvent(event, useTelemetryStore.getState().deviceId);
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
        const delay = backoffDelay(attempt++);
        // Announced before the timer starts, so the banner can count down to it.
        setNextAttemptAt(Date.now() + delay);
        retry = setTimeout(connect, delay);
      };
    }

    connect();

    // NetInfo saying the network is back beats waiting out the delay.
    const unsubscribe = useNetworkStore.subscribe((state, previous) => {
      if (!state.reachable || previous.reachable || !retry) return;

      clearTimeout(retry);
      retry = null;
      attempt = 0;
      connect();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, [appState]);
}
