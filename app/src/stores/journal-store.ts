import { create } from 'zustand';

import type { JournalEvent } from '@/api/types';
import type { ConnectionEntry } from '@/db/connection-log';

type JournalState = {
  /** Backend events, newest first. */
  events: JournalEvent[];
  /** The app's own connection changes, newest first. */
  connections: ConnectionEntry[];

  setEvents: (events: JournalEvent[]) => void;
  mergeEvents: (incoming: JournalEvent[]) => void;
  setConnections: (connections: ConnectionEntry[]) => void;
  addConnection: (entry: ConnectionEntry) => void;
};

export const useJournalStore = create<JournalState>((set, get) => ({
  events: [],
  connections: [],

  setEvents: (events) => set({ events }),

  mergeEvents: (incoming) => {
    if (incoming.length === 0) return;

    const byId = new Map(get().events.map((event) => [event.eventId, event]));
    for (const event of incoming) byId.set(event.eventId, event);

    set({
      events: [...byId.values()].sort((a, b) => b.ts - a.ts || b.eventId - a.eventId),
    });
  },

  setConnections: (connections) => set({ connections }),

  addConnection: (entry) => set((state) => ({ connections: [entry, ...state.connections] })),
}));
