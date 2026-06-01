import type { Card } from './types.js';
import { RANKS, SUITS } from './constants.js';

/** Create a standard 52-card deck in a canonical order */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle.
 * If `seed` is provided, use a deterministic LCG PRNG so results are
 * reproducible (useful for tests and replays).
 */
export function shuffle(deck: Card[], seed?: number): Card[] {
  const result = [...deck];
  const random = seed !== undefined ? lcg(seed) : Math.random.bind(Math);

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i]!;
    const b = result[j]!;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/** Simple LCG PRNG returning floats in [0, 1) */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
