import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  setPlayers: (players: PlayerSetupForm[]) => void;
  setBlinds: (sb: number, bb: number, ante?: number) => void;
  setDealer: (seatIndex: number) => void;
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
      setPlayers: (players) => set({ players }),
      setBlinds: (smallBlind, bigBlind, ante = 0) => set({ smallBlind, bigBlind, ante }),
      setDealer: (dealerSeatIndex) => set({ dealerSeatIndex }),
    }),
    { name: 'poker-settings' },
  ),
);
