import Constants from 'expo-constants';
import * as Device from 'expo-device';

import { registerPushToken, unregisterPushToken } from '@/api/client';
import { notifications } from '@/services/notifications';
import { currentToken } from '@/stores/auth-store';

/** The token the backend holds for this phone, once it has accepted it. */
let registered: string | null = null;

/**
 * True once the backend can reach this phone by push. The local `alert`
 * notification then stands down: the push covers it, open or closed, and
 * both together would ring twice for the same breach.
 */
export const pushActive = () => registered !== null;

async function expoPushToken() {
  const module = notifications();
  // Emulators have no push service, and Expo Go on Android cannot load the module.
  if (!module || !Device.isDevice) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  const { data } = await module.getExpoPushTokenAsync({ projectId });
  return data;
}

/**
 * Sends this phone's push token to the backend. Only called with alerts on and
 * the OS permission granted — the token is never asked for before that — and
 * with a session, since the route is behind the JWT. Re-run at every launch:
 * the token can change after a reinstall, and the backend ignores duplicates.
 */
export async function syncPushToken() {
  const session = currentToken();
  if (!session) return;

  try {
    const pushToken = await expoPushToken();
    if (!pushToken) return;

    await registerPushToken(pushToken, session);
    registered = pushToken;
  } catch (error) {
    // No push is not fatal: local notifications still cover an open app.
    console.warn('[push] registration failed', error);
  }
}

/** Alerts turned off: the backend stops pushing to this phone. */
export async function forgetPushToken() {
  const session = currentToken();
  const pushToken = registered;
  registered = null;
  if (!session || !pushToken) return;

  try {
    await unregisterPushToken(pushToken, session);
  } catch (error) {
    console.warn('[push] unregistration failed', error);
  }
}
