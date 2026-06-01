import { create } from 'zustand';
import type { Card } from '@poker/engine';

/**
 * Holds the pre-dealt board cards for the current practice hand.
 * These are derived from the same shuffle as the hole cards (in PracticeSetup)
 * and stored here so PracticeTable can deal them street-by-street without
 * re-shuffling or modifying the engine state.
 */
interface PracticeStore {
  /** 5 board cards pre-dealt at hand start. null when no hand is active. */
  boardCards: readonly [Card, Card, Card, Card, Card] | null;
  setBoardCards: (cards: [Card, Card, Card, Card, Card]) => void;
  clearBoard: () => void;
}

export const usePracticeStore = create<PracticeStore>(set => ({
  boardCards: null,
  setBoardCards: (boardCards) => set({ boardCards }),
  clearBoard: () => set({ boardCards: null }),
}));
