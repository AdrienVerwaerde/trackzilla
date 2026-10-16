import { useEffect } from 'react';

import { forgetPushToken, syncPushToken } from '@/services/push';
import { useAuthStore } from '@/stores/auth-store';
import { canNotify, usePreferenceStore } from '@/stores/preference-store';

/**
 * Keeps the backend's list of phones in step with the Réglages switch: alerts
 * on and logged in means registered. Logging in later registers then.
 */
export function usePushRegistration() {
  const alertsEnabled = usePreferenceStore((state) => state.alertsEnabled);
  const permission = usePreferenceStore((state) => state.permission);
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    if (canNotify()) syncPushToken();
    else forgetPushToken();
  }, [alertsEnabled, permission, session]);
}
