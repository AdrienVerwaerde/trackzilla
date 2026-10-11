import { isRunningInExpoGo } from 'expo';
import type { NotificationPermissionsStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { readPreference, savePreference } from '@/db/preference-cache';
import { canNotify, usePreferenceStore, type PermissionState } from '@/stores/preference-store';

type NotificationsModule = typeof import('expo-notifications');

const AlertsEnabledKey = 'alertsEnabled';

/** Android drops notifications that have no channel, silently. */
export const AlertChannelId = 'alerts';

/**
 * Since SDK 53, merely importing expo-notifications throws in Expo Go on
 * Android: a side-effect file registers a push-token listener at load. The
 * module is therefore loaded lazily, and only where it can load.
 */
export const notificationsSupported = !(Platform.OS === 'android' && isRunningInExpoGo());

let loaded: NotificationsModule | null = null;

export function notifications(): NotificationsModule | null {
  if (!notificationsSupported) return null;

  if (!loaded) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-notifications') as NotificationsModule;

    // Without this nothing appears while the app is open, which is exactly
    // when the dashboard is being watched.
    loaded.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  return loaded;
}

/** Shown at once. A no-op unless the user enabled alerts and the OS agreed. */
export async function notify(title: string, body: string) {
  const module = notifications();
  if (!module || !canNotify()) return;

  try {
    await module.scheduleNotificationAsync({
      content: { title, body },
      trigger: Platform.OS === 'android' ? { channelId: AlertChannelId } : null,
    });
  } catch (error) {
    console.warn('[notifications] could not notify', error);
  }
}

const toPermission = ({ granted, canAskAgain }: NotificationPermissionsStatus): PermissionState => {
  if (granted) return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
};

async function ensureChannel(module: NotificationsModule) {
  if (Platform.OS !== 'android') return;

  await module.setNotificationChannelAsync(AlertChannelId, {
    name: 'Alertes du potager',
    importance: module.AndroidImportance.HIGH,
  });
}

/** Reads the stored wish and what the OS currently allows. */
export async function restorePreferences() {
  const store = usePreferenceStore.getState();
  const module = notifications();

  try {
    if (!module) {
      store.setPermission('unavailable');
      store.setAlertsEnabled(false);
      return;
    }

    await ensureChannel(module);

    const [stored, status] = await Promise.all([
      readPreference(AlertsEnabledKey),
      module.getPermissionsAsync(),
    ]);

    store.setAlertsEnabled(stored === 'true');
    store.setPermission(toPermission(status));
  } catch (error) {
    console.warn('[notifications] restore failed', error);
  } finally {
    store.markLoaded();
  }
}

/**
 * Asks the OS only when the user turns alerts on — never at launch. A refusal
 * leaves the switch off and changes nothing else: alerts stay in the app and
 * in the Journal.
 */
export async function setAlertsEnabled(enabled: boolean): Promise<PermissionState> {
  const store = usePreferenceStore.getState();
  const module = notifications();

  if (!module) return 'unavailable';

  if (!enabled) {
    store.setAlertsEnabled(false);
    await savePreference(AlertsEnabledKey, 'false');
    return store.permission;
  }

  const current = await module.getPermissionsAsync();
  const status = current.granted ? current : await module.requestPermissionsAsync();
  const permission = toPermission(status);

  store.setPermission(permission);
  store.setAlertsEnabled(permission === 'granted');
  await savePreference(AlertsEnabledKey, String(permission === 'granted'));

  return permission;
}
