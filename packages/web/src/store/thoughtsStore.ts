import { create } from 'zustand';
import type { ThoughtEntry, HandAnnotations } from '../types/thoughts.js';

interface ThoughtsStore {
  thoughts: Record<string, ThoughtEntry>;
  addThought: (entry: ThoughtEntry) => void;
  clearThoughts: () => void;
  /** Build the HandAnnotations snapshot for persistence */
  snapshot: (handId: string) => HandAnnotations;
}

export const useThoughtsStore = create<ThoughtsStore>((set, get) => ({
  thoughts: {},

  addThought: (entry) =>
    set(s => ({ thoughts: { ...s.thoughts, [entry.actionId]: entry } })),

  clearThoughts: () => set({ thoughts: {} }),

  snapshot: (handId) => ({
    handId,
    thoughts: { ...get().thoughts },
  }),
}));
