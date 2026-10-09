import { create } from 'zustand';

import type { QueuedCommand } from '@/db/command-cache';

type CommandState = {
  /** Newest first. */
  commands: QueuedCommand[];
  /** The LED state the box itself reported, null until it has. */
  led: boolean | null;
  /** Shown once when a command is given up on. */
  error: string | null;

  hydrate: (commands: QueuedCommand[], led: boolean | null) => void;
  upsert: (command: QueuedCommand) => void;
  patch: (id: string, fields: Partial<QueuedCommand>) => void;
  dropPending: (device: string) => void;
  setLed: (led: boolean) => void;
  setError: (error: string | null) => void;
};

export const useCommandStore = create<CommandState>((set) => ({
  commands: [],
  led: null,
  error: null,

  hydrate: (commands, led) => set({ commands, led }),

  upsert: (command) =>
    set((state) => ({
      commands: [command, ...state.commands.filter((c) => c.id !== command.id)],
    })),

  patch: (id, fields) =>
    set((state) => ({
      commands: state.commands.map((c) => (c.id === id ? { ...c, ...fields } : c)),
    })),

  dropPending: (device) =>
    set((state) => ({
      commands: state.commands.filter((c) => !(c.device === device && c.status === 'pending')),
    })),

  setLed: (led) => set({ led }),

  setError: (error) => set({ error }),
}));

/** The order still owed to the backend, if any: what the button shows. */
export const inFlightCommand = (commands: QueuedCommand[]) =>
  commands.find((c) => c.status === 'pending' || c.status === 'sent') ?? null;
