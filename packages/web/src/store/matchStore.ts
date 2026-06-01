import { create } from 'zustand';
import type { MatchState, MatchConfig } from '@poker/engine';
import { createMatch } from '@poker/engine';

interface MatchStore {
  match: MatchState | null;
  /** profile key per bot player id (e.g. { bot1: 'nit' }) */
  botProfileById: Record<string, string>;
  heroId: string;
  startMatch: (config: MatchConfig, botProfileById: Record<string, string>, heroId: string) => void;
  setMatch: (match: MatchState) => void;
  reset: () => void;
}

export const useMatchStore = create<MatchStore>(set => ({
  match: null,
  botProfileById: {},
  heroId: 'hero',

  startMatch: (config, botProfileById, heroId) =>
    set({ match: createMatch(config), botProfileById, heroId }),

  setMatch: (match) => set({ match }),

  reset: () => set({ match: null, botProfileById: {}, heroId: 'hero' }),
}));
