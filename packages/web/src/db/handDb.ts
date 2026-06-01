import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { HandRecord } from '@poker/engine';
import type { HandAnnotations } from '../types/thoughts.js';

export interface PokerDB extends DBSchema {
  hands: {
    key: string;
    value: HandRecord;
    indexes: { 'by-date': number };
  };
  /** Parallel annotation store — keyed by the same handId as the hands store */
  annotations: {
    key: string;
    value: HandAnnotations;
  };
}

export async function openHandDb(): Promise<IDBPDatabase<PokerDB>> {
  return openDB<PokerDB>('poker-app', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const store = db.createObjectStore('hands', { keyPath: 'handId' });
        store.createIndex('by-date', 'startedAt');
      }
      if (oldVersion < 2) {
        db.createObjectStore('annotations', { keyPath: 'handId' });
      }
    },
  });
}

// ── Hands ─────────────────────────────────────────────────────────────────────

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

// ── Annotations ───────────────────────────────────────────────────────────────

export async function saveAnnotations(
  db: IDBPDatabase<PokerDB>,
  annotations: HandAnnotations,
): Promise<void> {
  await db.put('annotations', annotations);
}

export async function getAnnotations(
  db: IDBPDatabase<PokerDB>,
  handId: string,
): Promise<HandAnnotations | undefined> {
  return db.get('annotations', handId);
}
