import { create } from 'zustand';
import type { ThoughtEntry, HandAnnotations } from '../types/thoughts.js';
import type { StrategyVerdict } from '@poker/engine';

interface ThoughtsStore {
  thoughts: Record<string, ThoughtEntry>;
  strategyVerdicts: Record<string, StrategyVerdict>;
  latestStrategyVerdictId: string | null;
  addThought: (entry: ThoughtEntry) => void;
  addStrategyVerdict: (actionId: string, verdict: StrategyVerdict) => void;
  clearThoughts: () => void;
  /** Build the HandAnnotations snapshot for persistence */
  snapshot: (handId: string) => HandAnnotations;
}

export const useThoughtsStore = create<ThoughtsStore>((set, get) => ({
  thoughts: {},
  strategyVerdicts: {},
  latestStrategyVerdictId: null,

  addThought: (entry) =>
    set(s => ({ thoughts: { ...s.thoughts, [entry.actionId]: entry } })),

  addStrategyVerdict: (actionId, verdict) =>
    set(s => ({
      strategyVerdicts: { ...s.strategyVerdicts, [actionId]: verdict },
      latestStrategyVerdictId: actionId,
    })),

  clearThoughts: () => set({ thoughts: {}, strategyVerdicts: {}, latestStrategyVerdictId: null }),

  snapshot: (handId) => ({
    handId,
    thoughts: { ...get().thoughts },
    strategyVerdicts: { ...get().strategyVerdicts },
  }),
}));
