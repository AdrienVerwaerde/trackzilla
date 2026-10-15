import * as SecureStore from 'expo-secure-store';

import { login, nowSeconds } from '@/api/client';
import { useAuthStore, type Session } from '@/stores/auth-store';

/**
 * The Keychain on iOS, the Keystore on Android. Never AsyncStorage or SQLite:
 * those are plain files any backup or rooted phone can read.
 */
const SessionKey = 'session';

/** Reads the session back at launch, and forgets it if it has expired since. */
export async function restoreSession() {
  const { setSession, markLoaded } = useAuthStore.getState();

  try {
    const stored = await SecureStore.getItemAsync(SessionKey);
    const session = stored ? (JSON.parse(stored) as Session) : null;

    if (session && session.expiresAt > nowSeconds()) setSession(session);
    else if (session) await SecureStore.deleteItemAsync(SessionKey);
  } catch (error) {
    // An unreadable store means logging in again, nothing worse.
    console.warn('[auth] restore failed', error);
  } finally {
    markLoaded();
  }
}

/** Throws the ApiError on refusal: the screen tells a 401 from a 429. */
export async function signIn(username: string, password: string) {
  const { token, expiresAt } = await login(username, password);
  const session = { token, expiresAt, username };

  await SecureStore.setItemAsync(SessionKey, JSON.stringify(session));
  // useAuth sees the new session and sends what was queued while logged out.
  useAuthStore.getState().setSession(session);
}

export async function signOut() {
  useAuthStore.getState().setSession(null);
  await SecureStore.deleteItemAsync(SessionKey).catch((error) =>
    console.warn('[auth] delete failed', error)
  );
}
