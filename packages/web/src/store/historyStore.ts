import { create } from 'zustand';
import type { HandRecord } from '@poker/engine';
import { openHandDb, saveHand, listHands } from '../db/handDb.js';
import type { IDBPDatabase } from 'idb';
import type { PokerDB } from '../db/handDb.js';

interface HistoryStore {
  hands: HandRecord[];
  db: IDBPDatabase<PokerDB> | null;
  openDb: () => Promise<void>;
  saveRecord: (record: HandRecord) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  hands: [],
  db: null,

  openDb: async () => {
    if (get().db) return;
    const db = await openHandDb();
    set({ db });
  },

  saveRecord: async (record) => {
    let { db } = get();
    if (!db) {
      await get().openDb();
      db = get().db;
    }
    if (!db) return;
    await saveHand(db, record);
    set(state => ({ hands: [record, ...state.hands] }));
  },

  refresh: async () => {
    let { db } = get();
    if (!db) {
      await get().openDb();
      db = get().db;
    }
    if (!db) return;
    const hands = await listHands(db);
    set({ hands });
  },
}));
