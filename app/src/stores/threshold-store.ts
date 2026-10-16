import { create } from 'zustand';

import type { Thresholds } from '@/api/types';

type ThresholdState = {
  /** Null until the cache or the backend has answered. */
  thresholds: Thresholds | null;
  /** False until the cache has been read, so the form knows not to draw yet. */
  loaded: boolean;

  setThresholds: (thresholds: Thresholds) => void;
  markLoaded: () => void;
};

export const useThresholdStore = create<ThresholdState>((set) => ({
  thresholds: null,
  loaded: false,

  setThresholds: (thresholds) => set({ thresholds }),

  markLoaded: () => set({ loaded: true }),
}));
