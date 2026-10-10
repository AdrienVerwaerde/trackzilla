import { useEffect } from 'react';

import { DeviceId } from '@/api/config';
import { restoreJournal, syncJournal } from '@/services/journal';
import { useTelemetryStore } from '@/stores/telemetry-store';

/** Journal from the cache at launch, then caught up whenever the socket opens. */
export function useJournal() {
  const connection = useTelemetryStore((state) => state.connection);

  useEffect(() => {
    restoreJournal(DeviceId).catch((error) => console.warn('[journal] restore failed', error));
  }, []);

  useEffect(() => {
    if (connection === 'open') syncJournal(DeviceId);
  }, [connection]);
}
