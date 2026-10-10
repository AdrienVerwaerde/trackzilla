import { useEffect } from 'react';

import { DeviceId } from '@/api/config';
import { restoreThresholds, syncThresholds } from '@/services/thresholds';
import { useTelemetryStore } from '@/stores/telemetry-store';

export function useThresholds() {
  const connection = useTelemetryStore((state) => state.connection);

  useEffect(() => {
    restoreThresholds(DeviceId);
  }, []);

  useEffect(() => {
    if (connection === 'open') syncThresholds(DeviceId);
  }, [connection]);
}
