import { create } from 'zustand';
import { nanoid } from 'nanoid';
import {
  applyAction,
  createInitialState,
} from '@poker/engine';
import type { Action, GameConfig, GameState } from '@poker/engine';

interface GameStore {
  config: GameConfig | null;
  actionLog: Action[];
  /** Append one action to the log — the source of truth */
  appendAction: (action: Action) => void;
  /** Start a fresh hand */
  startHand: (config: Omit<GameConfig, 'handId'>) => void;
  /** Overwrite log entirely (for history replay) */
  loadHand: (config: GameConfig, log: Action[]) => void;
  /** Reset to idle state */
  resetHand: () => void;
}

export const useGameStore = create<GameStore>(set => ({
  config: null,
  actionLog: [],

  appendAction: (action) =>
    set(state => ({ actionLog: [...state.actionLog, action] })),

  startHand: (partialConfig) => {
    const config: GameConfig = { ...partialConfig, handId: nanoid() };
    set({ config, actionLog: [] });
  },

  loadHand: (config, log) => set({ config, actionLog: [...log] }),

  resetHand: () => set({ config: null, actionLog: [] }),
}));

/**
 * Derive current GameState by replaying the action log.
 * Called from a useMemo in useGameState hook — not stored directly.
 */
export function replayLog(config: GameConfig, log: readonly Action[]): GameState {
  let state = createInitialState(config);
  for (const action of log) {
    state = applyAction(state, action);
  }
  return state;
}
