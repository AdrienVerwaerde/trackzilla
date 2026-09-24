import { Accelerometer } from 'expo-sensors';
import { useEffect } from 'react';

import { useSensorStore } from '@/stores/sensor-store';

/** iOS 17+ asks for motion permission; other platforms grant it upfront. */
async function ensurePermission() {
  const current = await Accelerometer.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Accelerometer.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Keeps the accelerometer subscription alive only while the app is in the
 * foreground. Mount it once, at the root of the app.
 */
export function useAccelerometer() {
  const appState = useSensorStore((state) => state.appState);
  const updateInterval = useSensorStore((state) => state.updateInterval);

  useEffect(() => {
    // The rule: no subscription outside the foreground. Sampling at 50 ms in
    // the background drains the battery for readings nobody can see.
    if (appState !== 'active') {
      useSensorStore.getState().setAccelerometerStatus('paused');
      return;
    }

    const { pushAccelerometerSample, setAccelerometerStatus } = useSensorStore.getState();
    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    let cancelled = false;

    (async () => {
      if (!(await Accelerometer.isAvailableAsync())) {
        setAccelerometerStatus('unavailable');
        return;
      }

      if (!(await ensurePermission())) {
        setAccelerometerStatus('denied');
        return;
      }

      // The app may have left the foreground while those promises resolved.
      if (cancelled) return;

      Accelerometer.setUpdateInterval(useSensorStore.getState().updateInterval);
      subscription = Accelerometer.addListener(pushAccelerometerSample);
      setAccelerometerStatus('active');
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [appState]);

  // Changing the interval must not tear the subscription down and log a
  // spurious pause/resume pair.
  useEffect(() => {
    Accelerometer.setUpdateInterval(updateInterval);
  }, [updateInterval]);
}
