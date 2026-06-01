import type { GameState, LegalAction, Player } from './types.js';
import { whoseTurn } from './whoseTurn.js';

/**
 * Returns the set of legal actions for the current player.
 * Empty array if no action is required (waiting for street advance, showdown,
 * or hand over).
 */
export function legalActions(state: GameState): LegalAction[] {
  if (state.isHandOver) return [];
  const activeId = whoseTurn(state);
  if (activeId === null) return [];

  const player = state.players.find(p => p.id === activeId);
  if (!player || player.status !== 'active') return [];

  const { currentBet, lastRaiseSize } = state.bettingRound;
  const { stack, betThisStreet } = player;
  const gap = currentBet - betThisStreet; // chips needed to call

  const legal: LegalAction[] = [];

  if (gap === 0) {
    // No outstanding bet — player can check or bet
    legal.push({ type: 'CHECK' });
    if (stack > 0 && hasOtherActiveOrAllIn(state, player)) {
      const minBet = Math.min(state.config.bigBlind, stack);
      if (stack <= minBet) {
        legal.push({ type: 'ALL_IN', amount: betThisStreet + stack });
      } else {
        legal.push({ type: 'BET', min: minBet, max: stack });
      }
    }
  } else {
    // There is a bet to face — fold, call, or raise
    legal.push({ type: 'FOLD' });

    const callAmount = Math.min(gap, stack);
    if (callAmount >= stack) {
      // Calling would commit the whole stack
      legal.push({ type: 'ALL_IN', amount: betThisStreet + stack });
    } else {
      legal.push({ type: 'CALL', amount: callAmount });
      // Raise is legal if player has chips beyond the call
      const raiseSize = Math.max(lastRaiseSize, state.config.bigBlind);
      const minRaiseTo = currentBet + raiseSize;
      const maxRaiseTo = betThisStreet + stack; // total chips in after raise
      if (maxRaiseTo > currentBet) {
        if (maxRaiseTo <= minRaiseTo) {
          // Only option is going all-in (less than a full raise)
          legal.push({ type: 'ALL_IN', amount: maxRaiseTo });
        } else {
          legal.push({ type: 'RAISE', min: minRaiseTo, max: maxRaiseTo });
        }
      }
    }
  }

  return legal;
}

/** True if at least one other player is active or all-in (i.e. the action matters) */
function hasOtherActiveOrAllIn(state: GameState, exclude: Player): boolean {
  return state.players.some(
    p => p.id !== exclude.id && (p.status === 'active' || p.status === 'allin'),
  );
}
