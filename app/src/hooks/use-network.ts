import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useEffect } from 'react';

import { useNetworkStore } from '@/stores/network-store';

/**
 * `isConnected` alone is the optimistic answer: it only says an interface is
 * up, which is still true on the hotel Wi-Fi that blocks every request behind
 * its portal. `isInternetReachable` is the probe, and it is `null` while that
 * probe is still running — unknown, not offline, or the banner would flash
 * "hors ligne" every time the app starts.
 */
function readReachable(state: NetInfoState) {
  if (!state.isConnected) return false;
  return state.isInternetReachable;
}

/** Mirrors NetInfo into the store. Mount it once, at the root of the app. */
export function useNetwork() {
  useEffect(() => {
    // addEventListener fires once with the current state on subscribe, so there
    // is no separate initial fetch to race against.
    return NetInfo.addEventListener((state) => {
      useNetworkStore.getState().setReachable(readReachable(state));
    });
  }, []);
}
