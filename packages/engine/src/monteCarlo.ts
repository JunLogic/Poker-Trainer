import type { Card } from './types.js';
import { createDeck, shuffle } from './deck.js';
import { evaluateHand, compareHandRanks } from './handEvaluator.js';

/**
 * Monte Carlo equity estimation.
 *
 * @param holeCards - One entry per player. null means unknown (will be dealt randomly).
 * @param board     - 0–5 known community cards.
 * @param iterations - Number of Monte Carlo samples (2000 is a reasonable default).
 * @param deadCards  - Cards known to be out of play (mucks, burn cards).
 * @param seed      - Optional seed for deterministic results (tests).
 * @returns equity[i] ∈ [0,1], sum ≈ 1.0 (split pots are fractional).
 */
export function estimateEquity(
  holeCards: readonly (readonly [Card, Card] | null)[],
  board: readonly Card[],
  iterations = 2000,
  deadCards: readonly Card[] = [],
  seed?: number,
): number[] {
  const numPlayers = holeCards.length;
  const wins = new Array<number>(numPlayers).fill(0);

  // Build the set of cards already accounted for
  const usedKeys = new Set<string>();
  for (const pair of holeCards) {
    if (pair) {
      usedKeys.add(cardKey(pair[0]));
      usedKeys.add(cardKey(pair[1]));
    }
  }
  for (const c of board) usedKeys.add(cardKey(c));
  for (const c of deadCards) usedKeys.add(cardKey(c));

  const remainingDeck = createDeck().filter(c => !usedKeys.has(cardKey(c)));
  const boardNeeded = 5 - board.length;

  // LCG state if seeded
  let rngState = seed !== undefined ? (seed >>> 0) : undefined;

  for (let iter = 0; iter < iterations; iter++) {
    // Shuffle remaining deck for this iteration
    const shuffled = rngState !== undefined
      ? shuffleLcg(remainingDeck, rngState + iter)
      : shuffleRandom(remainingDeck);

    let deckCursor = 0;

    // Deal unknown hole cards
    const dealtHands: [Card, Card][] = holeCards.map(pair => {
      if (pair) return [pair[0], pair[1]];
      const c1 = shuffled[deckCursor++]!;
      const c2 = shuffled[deckCursor++]!;
      return [c1, c2];
    });

    // Complete the board
    const fullBoard: Card[] = [
      ...board,
      ...shuffled.slice(deckCursor, deckCursor + boardNeeded),
    ];

    // Evaluate each player
    const ranks = dealtHands.map(hand => evaluateHand([...hand, ...fullBoard]));

    // Find winner(s) — handle ties
    let bestRank = ranks[0]!;
    for (let i = 1; i < ranks.length; i++) {
      if (compareHandRanks(ranks[i]!, bestRank) > 0) bestRank = ranks[i]!;
    }

    const winnerIndices = ranks
      .map((r, i) => ({ r, i }))
      .filter(x => compareHandRanks(x.r, bestRank) === 0)
      .map(x => x.i);

    const share = 1 / winnerIndices.length;
    for (const i of winnerIndices) wins[i]! += share;
  }

  return wins.map(w => w / iterations);
}

function cardKey(c: Card): string {
  return `${c.rank}${c.suit}`;
}

function shuffleRandom<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function shuffleLcg<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = seed >>> 0;
  const rng = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
