import { create } from 'zustand';

import { nowSeconds } from '@/api/client';

export type Session = {
  token: string;
  /** Epoch seconds, as the backend's `expiresAt`. */
  expiresAt: number;
  username: string;
};

type AuthState = {
  session: Session | null;
  /** False until the secure store has been read: "logged out" is not known yet. */
  loaded: boolean;

  setSession: (session: Session | null) => void;
  markLoaded: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loaded: false,

  setSession: (session) => set({ session }),
  markLoaded: () => set({ loaded: true }),
}));

/**
 * The token, or null when there is none or it has run out. An expired token is
 * not worth sending: the backend would answer 401 and the order would be lost.
 */
export function currentToken() {
  const { session } = useAuthStore.getState();
  if (!session || session.expiresAt <= nowSeconds()) return null;
  return session.token;
}
