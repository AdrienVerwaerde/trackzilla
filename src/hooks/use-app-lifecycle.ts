import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSensorStore } from '@/stores/sensor-store';

/**
 * Feeds the store with `AppState` transitions.
 * Mount it once, at the root of the app.
 */
export function useAppLifecycle() {
  useEffect(() => {
    const { setAppState } = useSensorStore.getState();

    // The state may have changed between module load and this effect.
    setAppState(AppState.currentState);

    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
}
