import type { Card, HandCategory, HandRank } from './types.js';
import { RANK_VALUE, HAND_CATEGORY_RANK } from './constants.js';

/**
 * Evaluate the best 5-card poker hand from up to 7 cards.
 * Iterates all C(n,5) combinations, scores each, returns the highest.
 */
export function evaluateHand(cards: readonly Card[]): HandRank {
  if (cards.length < 5) {
    throw new Error(`evaluateHand requires ≥5 cards, got ${cards.length}`);
  }

  let best: HandRank | null = null;

  for (const five of combinations(cards, 5)) {
    const rank = scoreFive(five as [Card, Card, Card, Card, Card]);
    if (best === null || compareHandRanks(rank, best) > 0) {
      best = rank;
    }
  }

  return best!;
}

/** Compare two HandRanks: positive if a > b, negative if a < b, 0 if equal */
export function compareHandRanks(a: HandRank, b: HandRank): number {
  const catDiff =
    HAND_CATEGORY_RANK[a.category]! - HAND_CATEGORY_RANK[b.category]!;
  if (catDiff !== 0) return catDiff;

  for (let i = 0; i < Math.max(a.tiebreaker.length, b.tiebreaker.length); i++) {
    const diff = (a.tiebreaker[i] ?? 0) - (b.tiebreaker[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── Internal scoring ──────────────────────────────────────────────────────────

function scoreFive(five: [Card, Card, Card, Card, Card]): HandRank {
  const vals = five.map(c => RANK_VALUE[c.rank]).sort((a, b) => b - a) as number[];
  const suits = five.map(c => c.suit);
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = checkStraight(vals);

  if (isFlush && isStraight) {
    return {
      category: 'straight-flush',
      tiebreaker: [isStraight],
      bestFive: five,
    };
  }

  const groups = groupByCount(vals);

  if (groups[4]) {
    const quad = groups[4][0]!;
    const kicker = vals.find(v => v !== quad)!;
    return { category: 'four-of-a-kind', tiebreaker: [quad, kicker], bestFive: five };
  }

  if (groups[3] && groups[2]) {
    return {
      category: 'full-house',
      tiebreaker: [groups[3][0]!, groups[2][0]!],
      bestFive: five,
    };
  }

  if (isFlush) {
    return { category: 'flush', tiebreaker: vals, bestFive: five };
  }

  if (isStraight) {
    return { category: 'straight', tiebreaker: [isStraight], bestFive: five };
  }

  if (groups[3]) {
    const trips = groups[3][0]!;
    const kickers = vals.filter(v => v !== trips);
    return { category: 'three-of-a-kind', tiebreaker: [trips, ...kickers], bestFive: five };
  }

  if (groups[2] && groups[2].length === 2) {
    const [high, low] = groups[2].sort((a, b) => b - a) as [number, number];
    const kicker = vals.find(v => v !== high && v !== low)!;
    return { category: 'two-pair', tiebreaker: [high, low, kicker], bestFive: five };
  }

  if (groups[2]) {
    const pair = groups[2][0]!;
    const kickers = vals.filter(v => v !== pair);
    return { category: 'pair', tiebreaker: [pair, ...kickers], bestFive: five };
  }

  return { category: 'high-card', tiebreaker: vals, bestFive: five };
}

/**
 * Returns the high card of the straight if found, else 0.
 * Handles the wheel (A-2-3-4-5).
 */
function checkStraight(sortedVals: number[]): number {
  // Normal case
  let consecutive = true;
  for (let i = 0; i < 4; i++) {
    if ((sortedVals[i]! - sortedVals[i + 1]!) !== 1) {
      consecutive = false;
      break;
    }
  }
  if (consecutive) return sortedVals[0]!;

  // Wheel: A-5-4-3-2 (A=14 treated as 1)
  const wheel = [14, 5, 4, 3, 2];
  if (sortedVals.every((v, i) => v === wheel[i])) return 5;

  return 0;
}

function groupByCount(vals: number[]): Record<number, number[]> {
  const counts: Record<number, number> = {};
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;

  const groups: Record<number, number[]> = {};
  for (const [val, cnt] of Object.entries(counts)) {
    if (!groups[cnt]) groups[cnt] = [];
    groups[cnt]!.push(Number(val));
    groups[cnt]!.sort((a, b) => b - a);
  }
  return groups;
}

function* combinations<T>(arr: readonly T[], k: number): Generator<T[]> {
  if (k === 0) { yield []; return; }
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i]!, ...rest];
    }
  }
}
