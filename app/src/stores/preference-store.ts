import { create } from 'zustand';

/**
 * What the OS says, which the user's wish cannot override. `unavailable` is
 * Expo Go on Android, where the notifications module cannot load at all.
 */
export type PermissionState = 'undetermined' | 'granted' | 'denied' | 'unavailable';

type PreferenceState = {
  /** The user's wish. Alerts only actually notify when permission is granted too. */
  alertsEnabled: boolean;
  permission: PermissionState;
  loaded: boolean;

  setAlertsEnabled: (alertsEnabled: boolean) => void;
  setPermission: (permission: PermissionState) => void;
  markLoaded: () => void;
};

export const usePreferenceStore = create<PreferenceState>((set) => ({
  alertsEnabled: false,
  permission: 'undetermined',
  loaded: false,

  setAlertsEnabled: (alertsEnabled) => set({ alertsEnabled }),
  setPermission: (permission) => set({ permission }),
  markLoaded: () => set({ loaded: true }),
}));

/** Notifications only go out when the user asked for them and the OS agreed. */
export const canNotify = () => {
  const { alertsEnabled, permission } = usePreferenceStore.getState();
  return alertsEnabled && permission === 'granted';
};
