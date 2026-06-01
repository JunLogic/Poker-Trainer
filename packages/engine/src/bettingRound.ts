import type { GameState, Player, Street } from './types.js';

/** True when all active (non-folded, non-all-in) players have matched the bet and acted */
export function isBettingRoundClosed(state: GameState): boolean {
  const activePlayers = state.players.filter(p => p.status === 'active');

  if (activePlayers.length === 0) return true;

  // All active players must have matched the current bet
  const allMatched = activePlayers.every(
    p => p.betThisStreet === state.bettingRound.currentBet,
  );
  if (!allMatched) return false;

  // All active players must have acted at least once this street
  const actorSet = new Set(state.bettingRound.actorIdsThisStreet);
  const allActed = activePlayers.every(p => actorSet.has(p.id));
  if (!allActed) return false;

  // Pre-flop: BB still has option (can raise after all called)
  if (state.street === 'preflop' && state.bettingRound.bigBlindHasOption) {
    return false;
  }

  return true;
}

/** True when only one or zero players are active (not folded) */
export function isHandForfeited(state: GameState): boolean {
  const canAct = state.players.filter(p => p.status !== 'folded');
  return canAct.length <= 1;
}

/** Players who can still act (active status only) */
export function getActivePlayers(state: GameState): readonly Player[] {
  return state.players.filter(p => p.status === 'active');
}

/** Next street in sequence */
export function nextStreet(current: Street): Street {
  const seq: Street[] = ['preflop', 'flop', 'turn', 'river', 'showdown', 'finished'];
  const idx = seq.indexOf(current);
  return seq[idx + 1] ?? 'finished';
}

/**
 * Find the index of the next player who can act, searching clockwise from
 * `fromIndex` (exclusive).  Returns null if no active player found.
 */
export function nextActiveIndex(
  players: readonly Player[],
  fromIndex: number,
): number | null {
  const n = players.length;
  for (let offset = 1; offset < n; offset++) {
    const idx = (fromIndex + offset) % n;
    if (players[idx]?.status === 'active') return idx;
  }
  return null;
}

/**
 * After a street advances, reset per-street bet tracking.
 * Returns updated players array.
 */
export function resetStreetBets(players: readonly Player[]): readonly Player[] {
  return players.map(p => ({ ...p, betThisStreet: 0 }));
}
