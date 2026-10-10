import { create } from 'zustand';

import type { CommandKind, QueuedCommand } from '@/db/command-cache';

/** Only the fields the queue ever revises; the kind and payload are fixed. */
type CommandPatch = Partial<Pick<QueuedCommand, 'status' | 'attempts' | 'reason'>>;

type CommandState = {
  /** Newest first. */
  commands: QueuedCommand[];
  /** The LED state the box itself reported, null until it has. */
  led: boolean | null;
  /** Shown once when an entry is given up on. */
  error: string | null;

  hydrate: (commands: QueuedCommand[], led: boolean | null) => void;
  upsert: (command: QueuedCommand) => void;
  patch: (id: string, fields: CommandPatch) => void;
  dropPending: (device: string, kind: CommandKind) => void;
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
      commands: state.commands.map((c) => (c.id === id ? ({ ...c, ...fields } as QueuedCommand) : c)),
    })),

  dropPending: (device, kind) =>
    set((state) => ({
      commands: state.commands.filter(
        (c) => !(c.device === device && c.kind === kind && c.status === 'pending')
      ),
    })),

  setLed: (led) => set({ led }),

  setError: (error) => set({ error }),
}));

/** The order of a kind still owed to the backend, if any. */
export const inFlightCommand = (commands: QueuedCommand[], kind: CommandKind) =>
  commands.find((c) => c.kind === kind && (c.status === 'pending' || c.status === 'sent')) ?? null;
