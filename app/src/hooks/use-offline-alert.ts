import { useEffect } from 'react';

import { checkSilentDevice } from '@/services/alerts';
import { useSensorStore } from '@/stores/sensor-store';

const CheckEveryMs = 15_000;

/** Watches for a silent box while the app is open; nothing runs in the background. */
export function useOfflineAlert() {
  const appState = useSensorStore((state) => state.appState);

  useEffect(() => {
    if (appState !== 'active') return;

    const timer = setInterval(checkSilentDevice, CheckEveryMs);
    return () => clearInterval(timer);
  }, [appState]);
}
