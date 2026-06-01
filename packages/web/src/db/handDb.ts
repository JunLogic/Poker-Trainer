import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { HandRecord } from '@poker/engine';

export interface PokerDB extends DBSchema {
  hands: {
    key: string;
    value: HandRecord;
    indexes: { 'by-date': number };
  };
}

export async function openHandDb(): Promise<IDBPDatabase<PokerDB>> {
  return openDB<PokerDB>('poker-app', 1, {
    upgrade(db) {
      const store = db.createObjectStore('hands', { keyPath: 'handId' });
      store.createIndex('by-date', 'startedAt');
    },
  });
}

export async function saveHand(db: IDBPDatabase<PokerDB>, record: HandRecord): Promise<void> {
  await db.put('hands', record);
}

export async function listHands(
  db: IDBPDatabase<PokerDB>,
  limit = 50,
): Promise<HandRecord[]> {
  const all = await db.getAllFromIndex('hands', 'by-date');
  return all.reverse().slice(0, limit);
}

export async function getHand(
  db: IDBPDatabase<PokerDB>,
  handId: string,
): Promise<HandRecord | undefined> {
  return db.get('hands', handId);
}
