import type { Player, PlayerId, SidePot } from './types.js';

/**
 * Build side pots from the committed chip amounts.
 *
 * Algorithm:
 * 1. Collect unique betCommitted levels sorted ascending.
 * 2. For each level L: contribution = L - prevLevel.
 *    eligiblePlayers = non-folded players whose betCommitted >= L.
 *    amount = contribution * (ALL players whose betCommitted >= L).
 * 3. A folded player contributes chips but is NOT eligible to win.
 *
 * Result is ordered main-pot first; total chips across all pots = sum of betCommitted.
 */
export function buildSidePots(players: readonly Player[]): SidePot[] {
  const levels = [...new Set(players.map(p => p.betCommitted))].sort((a, b) => a - b);

  const pots: SidePot[] = [];
  let prevLevel = 0;

  for (const level of levels) {
    if (level === 0) continue;
    const contribution = level - prevLevel;
    // All players who put in at least this level contribute to the pot amount
    const contributors = players.filter(p => p.betCommitted >= level);
    const amount = contribution * contributors.length;
    // Only non-folded players are eligible to win
    const eligiblePlayerIds = contributors
      .filter(p => p.status !== 'folded')
      .map(p => p.id);

    if (amount > 0) {
      pots.push({ amount, eligiblePlayerIds });
    }
    prevLevel = level;
  }

  return pots;
}

// ── Award computation ─────────────────────────────────────────────────────────

export interface AwardResult {
  /** Base amount each winner receives (before odd-chip adjustment) */
  readonly perWinner: number;
  /** Player who receives the single extra odd chip(s); null if divides evenly */
  readonly oddChipWinnerId: PlayerId | null;
  /** Final chip amounts by player id */
  readonly distribution: ReadonlyMap<PlayerId, number>;
}

export interface AwardInput {
  readonly amount: number;
  readonly winnerIds: readonly PlayerId[];
  readonly eligiblePlayerIds: readonly PlayerId[];
  readonly dealerSeatIndex: number;
  readonly players: readonly Player[];
}

/**
 * Compute how to distribute a pot among winners.
 * Odd chips (when pot doesn't divide evenly) go to the first winner clockwise
 * from the dealer, per standard TDA rules.
 */
export function computeAward(input: AwardInput): AwardResult {
  const { amount, winnerIds, dealerSeatIndex, players } = input;
  const n = winnerIds.length;
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;

  let oddChipWinnerId: PlayerId | null = null;

  if (remainder > 0) {
    // Find the winner with the lowest seat index that is "first clockwise" after dealer
    // i.e. the winner whose seatIndex mod (maxSeat+1) is the smallest positive offset
    const maxSeat = Math.max(...players.map(p => p.seatIndex));
    const tableSize = maxSeat + 1;

    const winnerPlayers = winnerIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => p !== undefined);

    // Sort winners by clockwise distance from the dealer
    const sorted = [...winnerPlayers].sort((a, b) => {
      const distA = (a.seatIndex - dealerSeatIndex - 1 + tableSize) % tableSize;
      const distB = (b.seatIndex - dealerSeatIndex - 1 + tableSize) % tableSize;
      return distA - distB;
    });

    oddChipWinnerId = sorted[0]?.id ?? null;
  }

  const distribution = new Map<PlayerId, number>();
  for (const id of winnerIds) {
    distribution.set(id, base + (id === oddChipWinnerId ? remainder : 0));
  }

  return { perWinner: base, oddChipWinnerId, distribution };
}
