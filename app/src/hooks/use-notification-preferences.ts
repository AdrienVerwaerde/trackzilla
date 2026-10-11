import { useEffect } from 'react';

import { restorePreferences } from '@/services/notifications';

/** Reads the alerts preference at launch. Asks the OS for nothing. */
export function useNotificationPreferences() {
  useEffect(() => {
    restorePreferences();
  }, []);
}
