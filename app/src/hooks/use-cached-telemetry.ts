import { useEffect } from 'react';

import { nowSeconds } from '@/api/client';
import { pruneMeasurements, readDevice, readMeasurements } from '@/db/telemetry-cache';
import { useTelemetryStore } from '@/stores/telemetry-store';

/**
 * Draws the dashboard from the cache before the network is asked anything.
 *
 * This is the first half of stale-while-revalidate: whatever was stored goes
 * on screen immediately, dated and greyed, and the socket replaces it if and
 * when it answers. In airplane mode it never answers, and the screen is still
 * there — which is the whole point. Mount it once, at the root of the app.
 */
export function useCachedTelemetry() {
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const { deviceId, windowSeconds, setDevice, mergeMeasurements, markHydrated } =
        useTelemetryStore.getState();
      const now = nowSeconds();

      try {
        const [device, measurements] = await Promise.all([
          readDevice(deviceId),
          readMeasurements(deviceId, now - windowSeconds),
        ]);

        if (cancelled) return;

        if (device) setDevice(device);
        mergeMeasurements(measurements);

        // The app starting is the moment to pay for the cleanup: nothing is
        // being drawn yet, and whatever the phone collected before the last
        // shutdown may be long past the window.
        await pruneMeasurements(deviceId, now);
      } catch (error) {
        // A cache that cannot be read is a slower app, never a broken one.
        console.warn('[cache] hydration failed', error);
      } finally {
        if (!cancelled) markHydrated();
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);
}
