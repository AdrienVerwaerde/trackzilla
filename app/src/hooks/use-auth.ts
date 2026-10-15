import { useEffect } from 'react';

import { nowSeconds } from '@/api/client';
import { DeviceId } from '@/api/config';
import { restoreSession, signOut } from '@/services/auth';
import { drainQueue } from '@/services/command-queue';
import { useAuthStore } from '@/stores/auth-store';
import { useCommandStore } from '@/stores/command-store';

/**
 * Restores the session at launch, sends what was queued once logged in, and
 * logs out when the token runs out so the screen never claims a session the
 * backend would refuse.
 */
export function useAuth() {
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (!session) return;

    useCommandStore.getState().setError(null);
    drainQueue(DeviceId);

    const expiry = setTimeout(signOut, (session.expiresAt - nowSeconds()) * 1000);
    return () => clearTimeout(expiry);
  }, [session]);
}
