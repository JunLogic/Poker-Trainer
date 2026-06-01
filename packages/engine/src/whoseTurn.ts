import type { GameState, PlayerId } from './types.js';

/**
 * Returns the PlayerId of the player who should act next,
 * or null if no action is currently required (waiting for street advance,
 * showdown, or the hand is over).
 */
export function whoseTurn(state: GameState): PlayerId | null {
  if (state.isHandOver) return null;
  if (state.street === 'showdown' || state.street === 'finished') return null;
  if (state.activePlayerIndex === null) return null;
  return state.players[state.activePlayerIndex]?.id ?? null;
}
