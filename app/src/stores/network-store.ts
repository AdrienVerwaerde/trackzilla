import { create } from 'zustand';

type NetworkState = {
  /**
   * What the phone says about its own connectivity, which is not the same
   * question as "can I reach the backend": `null` until NetInfo has answered,
   * and `false` on a Wi-Fi whose captive portal swallows everything.
   *
   * It is the fast signal, never the verdict. Only the socket decides whether
   * the app is online — see `use-network-banner`.
   */
  reachable: boolean | null;
  setReachable: (reachable: boolean | null) => void;
};

export const useNetworkStore = create<NetworkState>((set) => ({
  reachable: null,
  setReachable: (reachable) => set({ reachable }),
}));
