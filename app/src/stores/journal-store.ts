import { create } from 'zustand';

import type { JournalEvent } from '@/api/types';

type JournalState = {
  /** Backend events, newest first. */
  events: JournalEvent[];
  setEvents: (events: JournalEvent[]) => void;
  mergeEvents: (incoming: JournalEvent[]) => void;
};

export const useJournalStore = create<JournalState>((set, get) => ({
  events: [],

  setEvents: (events) => set({ events }),

  mergeEvents: (incoming) => {
    if (incoming.length === 0) return;

    const byId = new Map(get().events.map((event) => [event.eventId, event]));
    for (const event of incoming) byId.set(event.eventId, event);

    set({
      events: [...byId.values()].sort((a, b) => b.ts - a.ts || b.eventId - a.eventId),
    });
  },
}));
