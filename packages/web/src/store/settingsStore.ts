import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_STRATEGY_PROFILE_ID } from '@poker/engine';
import type { DifficultyLevel, StrategyProfileId } from '@poker/engine';

export interface PlayerSetupForm {
  id: string;
  name: string;
  startingStack: number;
}

interface SettingsStore {
  players: PlayerSetupForm[];
  smallBlind: number;
  bigBlind: number;
  ante: number;
  dealerSeatIndex: number;
  /** Practice mode: show the hero equity display (computation always runs). */
  showOdds: boolean;
  /** Practice mode: show concise strategy advice before the hero acts. */
  showStrategyAdvice: boolean;
  strategyProfileId: StrategyProfileId;
  strategyDifficulty: DifficultyLevel;
  setPlayers: (players: PlayerSetupForm[]) => void;
  setBlinds: (sb: number, bb: number, ante?: number) => void;
  setDealer: (seatIndex: number) => void;
  setShowOdds: (show: boolean) => void;
  setShowStrategyAdvice: (show: boolean) => void;
  setStrategyProfileId: (profileId: StrategyProfileId) => void;
  setStrategyDifficulty: (difficulty: DifficultyLevel) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      players: [
        { id: 'p1', name: 'Player 1', startingStack: 1000 },
        { id: 'p2', name: 'Player 2', startingStack: 1000 },
        { id: 'p3', name: 'Player 3', startingStack: 1000 },
      ],
      smallBlind: 5,
      bigBlind: 10,
      ante: 0,
      dealerSeatIndex: 0,
      showOdds: true,
      showStrategyAdvice: false,
      strategyProfileId: DEFAULT_STRATEGY_PROFILE_ID,
      strategyDifficulty: 'intermediate',
      setPlayers: (players) => set({ players }),
      setBlinds: (smallBlind, bigBlind, ante = 0) => set({ smallBlind, bigBlind, ante }),
      setDealer: (dealerSeatIndex) => set({ dealerSeatIndex }),
      setShowOdds: (showOdds) => set({ showOdds }),
      setShowStrategyAdvice: (showStrategyAdvice) => set({ showStrategyAdvice }),
      setStrategyProfileId: (strategyProfileId) => set({ strategyProfileId }),
      setStrategyDifficulty: (strategyDifficulty) => set({ strategyDifficulty }),
    }),
    { name: 'poker-settings' },
  ),
);
