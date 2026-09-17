import * as Battery from 'expo-battery';
import { useEffect } from 'react';

import { useSensorStore } from '@/stores/sensor-store';

/**
 * Reads the battery once, then follows its three event streams.
 * Mount it once, at the root of the app.
 *
 * Unlike the accelerometer, these listeners are event-driven: nothing is
 * polled, so they cost nothing while the app sits in the background.
 */
export function useBattery() {
  useEffect(() => {
    const { setBatteryLevel, setBatteryState, setLowPowerMode, setBatteryAvailable } =
      useSensorStore.getState();

    const subscriptions: Battery.Subscription[] = [];
    let cancelled = false;

    (async () => {
      if (!(await Battery.isAvailableAsync())) {
        setBatteryAvailable(false);
        return;
      }

      const [level, state, lowPowerMode] = await Promise.all([
        Battery.getBatteryLevelAsync(),
        Battery.getBatteryStateAsync(),
        Battery.isLowPowerModeEnabledAsync(),
      ]);

      // The effect may have been torn down while those promises resolved.
      if (cancelled) return;

      setBatteryLevel(level);
      setBatteryState(state);
      setLowPowerMode(lowPowerMode);

      subscriptions.push(
        Battery.addBatteryLevelListener((event) => setBatteryLevel(event.batteryLevel)),
        Battery.addBatteryStateListener((event) => setBatteryState(event.batteryState)),
        Battery.addLowPowerModeListener((event) => setLowPowerMode(event.lowPowerMode))
      );
    })();

    return () => {
      cancelled = true;
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);
}
