import type {
  GameState, Action, Player, BettingRoundState, Street,
} from './types.js';
import {
  isBettingRoundClosed, isHandForfeited, nextActiveIndex, nextStreet, resetStreetBets,
} from './bettingRound.js';
import { buildSidePots } from './sidePot.js';

/**
 * Pure reducer: given current state and an action, return the next state.
 * All state transitions live here; no side effects.
 */
export function applyAction(state: GameState, action: Action): GameState {
  // Append action to log first — log is always the source of truth
  const actionLog = [...state.actionLog, action] as const;

  let players = state.players as Player[];
  let bettingRound = state.bettingRound;
  let street = state.street;
  let board = state.board;
  let activePlayerIndex = state.activePlayerIndex;
  let isHandOver = state.isHandOver;
  let deck = state.deck;

  switch (action.type) {
    // ── Blinds / Antes ─────────────────────────────────────────────────────
    case 'POST_BLIND': {
      players = applyBet(players, action.playerId, action.amount);
      // The BB's bet sets the opening currentBet; SB's smaller post is updated when BB posts
      const newBet = Math.max(bettingRound.currentBet, action.amount);
      const newLastRaise = action.blindType === 'big'
        ? action.amount
        : bettingRound.lastRaiseSize;
      // BB gets option (can re-raise pre-flop even if everyone just called)
      const bigBlindHasOption = action.blindType === 'big' ? true : bettingRound.bigBlindHasOption;

      bettingRound = {
        ...bettingRound,
        currentBet: newBet,
        lastRaiseSize: newLastRaise,
        bigBlindHasOption,
        // Blinds don't count as a voluntary action for round-close purposes
        actorIdsThisStreet: bettingRound.actorIdsThisStreet,
      };

      // Advance activePlayerIndex to the next seat after the player who just posted
      const posterIndex = players.findIndex(p => p.id === action.playerId);
      activePlayerIndex = nextActiveIndex(players, posterIndex);
      break;
    }

    case 'POST_ANTE': {
      players = applyBet(players, action.playerId, action.amount);
      break;
    }

    // ── Deal ───────────────────────────────────────────────────────────────
    case 'DEAL_HOLE_CARDS': {
      players = players.map(p =>
        p.id === action.playerId
          ? { ...p, holeCards: action.cards }
          : p,
      );
      break;
    }

    case 'DEAL_BOARD': {
      if (action.street === 'flop') {
        const cards = action.cards as [typeof action.cards[0], typeof action.cards[1], typeof action.cards[2]];
        board = { ...board, flop: [cards[0]!, cards[1]!, cards[2]!] };
      } else if (action.street === 'turn') {
        board = { ...board, turn: action.cards[0] ?? null };
      } else {
        board = { ...board, river: action.cards[0] ?? null };
      }

      // After dealing, reset betting round and find first active player post-dealer
      const dealerIdx = players.findIndex(p => p.seatIndex === state.config.dealerSeatIndex);
      bettingRound = freshBettingRound(state.config.bigBlind);
      players = resetStreetBets(players) as Player[];
      activePlayerIndex = nextActiveIndex(players, dealerIdx);
      break;
    }

    // ── Voluntary Actions ──────────────────────────────────────────────────
    case 'FOLD': {
      players = players.map(p =>
        p.id === action.playerId ? { ...p, status: 'folded' as const } : p,
      );
      bettingRound = addActor(bettingRound, action.playerId);
      ({ activePlayerIndex, street, players, isHandOver } = advanceAfterAction(
        players, bettingRound, street, activePlayerIndex, state.config,
      ));
      break;
    }

    case 'CHECK': {
      bettingRound = addActor(bettingRound, action.playerId);
      // Clear BB option when BB checks
      if (bettingRound.bigBlindHasOption) {
        bettingRound = { ...bettingRound, bigBlindHasOption: false };
      }
      ({ activePlayerIndex, street, players, isHandOver } = advanceAfterAction(
        players, bettingRound, street, activePlayerIndex, state.config,
      ));
      break;
    }

    case 'CALL': {
      players = applyBet(players, action.playerId, action.amount);
      bettingRound = addActor(bettingRound, action.playerId);
      ({ activePlayerIndex, street, players, isHandOver } = advanceAfterAction(
        players, bettingRound, street, activePlayerIndex, state.config,
      ));
      break;
    }

    case 'BET': {
      players = applyBet(players, action.playerId, action.amount);
      bettingRound = {
        ...addActor(bettingRound, action.playerId),
        currentBet: betThisStreetOf(players, action.playerId),
        lastRaiseSize: action.amount,
        lastAggressorId: action.playerId,
        bigBlindHasOption: false,
        // A new bet reopens action — clear prior actors so everyone must act again
        actorIdsThisStreet: [action.playerId],
      };
      ({ activePlayerIndex, street, players, isHandOver } = advanceAfterAction(
        players, bettingRound, street, activePlayerIndex, state.config,
      ));
      break;
    }

    case 'RAISE': {
      const prevBet = bettingRound.currentBet;
      players = applyBetTo(players, action.playerId, action.amount);
      const newCurrentBet = betThisStreetOf(players, action.playerId);
      const raiseIncrement = newCurrentBet - prevBet;
      bettingRound = {
        ...addActor(bettingRound, action.playerId),
        currentBet: newCurrentBet,
        // Only update lastRaiseSize if this is a full (legal) raise
        lastRaiseSize: raiseIncrement >= bettingRound.lastRaiseSize
          ? raiseIncrement
          : bettingRound.lastRaiseSize,
        lastAggressorId: action.playerId,
        bigBlindHasOption: false,
        actorIdsThisStreet: [action.playerId],
      };
      ({ activePlayerIndex, street, players, isHandOver } = advanceAfterAction(
        players, bettingRound, street, activePlayerIndex, state.config,
      ));
      break;
    }

    case 'ALL_IN': {
      const prevBet = bettingRound.currentBet;
      players = applyBetTo(players, action.playerId, action.amount);
      const allInPlayer = players.find(p => p.id === action.playerId)!;
      const newCurrentBet = Math.max(bettingRound.currentBet, allInPlayer.betThisStreet);
      const raiseIncrement = allInPlayer.betThisStreet - prevBet;
      const isFullRaise = raiseIncrement >= bettingRound.lastRaiseSize;

      players = players.map(p =>
        p.id === action.playerId && p.stack === 0
          ? { ...p, status: 'allin' as const }
          : p,
      );

      bettingRound = {
        ...addActor(bettingRound, action.playerId),
        currentBet: newCurrentBet,
        lastRaiseSize: isFullRaise && raiseIncrement > 0
          ? raiseIncrement
          : bettingRound.lastRaiseSize,
        lastAggressorId: isFullRaise ? action.playerId : bettingRound.lastAggressorId,
        bigBlindHasOption: false,
        // A full raise by all-in reopens action; incomplete does not
        actorIdsThisStreet: isFullRaise && raiseIncrement > 0
          ? [action.playerId]
          : addActor(bettingRound, action.playerId).actorIdsThisStreet,
      };

      ({ activePlayerIndex, street, players, isHandOver } = advanceAfterAction(
        players, bettingRound, street, activePlayerIndex, state.config,
      ));
      break;
    }

    // ── Showdown ────────────────────────────────────────────────────────────
    case 'REVEAL_CARDS': {
      players = players.map(p =>
        p.id === action.playerId ? { ...p, holeCards: action.cards } : p,
      );
      break;
    }

    case 'AWARD_POT': {
      players = players.map(p => {
        const award = action.winnerIds.includes(p.id)
          ? Math.floor(action.amount / action.winnerIds.length) +
            (p.id === action.oddChipWinnerId ? (action.amount % action.winnerIds.length) : 0)
          : 0;
        return award > 0 ? { ...p, stack: p.stack + award } : p;
      });
      break;
    }

    case 'MUCK_CARDS': {
      players = players.map(p =>
        p.id === action.playerId ? { ...p, holeCards: null } : p,
      );
      break;
    }
  }

  const sidePots = buildSidePots(players);

  return {
    ...state,
    players,
    board,
    sidePots,
    street,
    bettingRound,
    actionLog,
    activePlayerIndex,
    deck,
    isHandOver,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Commit `amount` additional chips from player (relative to their current bet) */
function applyBet(players: Player[], playerId: string, amount: number): Player[] {
  return players.map(p => {
    if (p.id !== playerId) return p;
    const actual = Math.min(amount, p.stack);
    return {
      ...p,
      stack: p.stack - actual,
      betThisStreet: p.betThisStreet + actual,
      betCommitted: p.betCommitted + actual,
    };
  });
}

/** Set betThisStreet to `toAmount` (raise-to semantics: total in this street) */
function applyBetTo(players: Player[], playerId: string, toAmount: number): Player[] {
  return players.map(p => {
    if (p.id !== playerId) return p;
    const additional = Math.min(toAmount - p.betThisStreet, p.stack);
    const actual = Math.max(additional, 0);
    return {
      ...p,
      stack: p.stack - actual,
      betThisStreet: p.betThisStreet + actual,
      betCommitted: p.betCommitted + actual,
    };
  });
}

function betThisStreetOf(players: Player[], playerId: string): number {
  return players.find(p => p.id === playerId)?.betThisStreet ?? 0;
}

function addActor(br: BettingRoundState, playerId: string): BettingRoundState {
  if (br.actorIdsThisStreet.includes(playerId)) return br;
  return { ...br, actorIdsThisStreet: [...br.actorIdsThisStreet, playerId] };
}

function freshBettingRound(bigBlind: number): BettingRoundState {
  return {
    currentBet: 0,
    lastRaiseSize: bigBlind,
    lastAggressorId: null,
    bigBlindHasOption: false,
    actorIdsThisStreet: [],
  };
}

interface AdvanceResult {
  activePlayerIndex: number | null;
  street: Street;
  players: Player[];
  isHandOver: boolean;
}

/**
 * After any voluntary action, check:
 * 1. Did someone win by everyone else folding?
 * 2. Is the betting round closed → advance street?
 * 3. Otherwise → find next active player.
 */
function advanceAfterAction(
  players: Player[],
  bettingRound: BettingRoundState,
  street: Street,
  currentIndex: number | null,
  config: GameState['config'],
): AdvanceResult {
  // Check forfeit (everyone but one folded)
  const nonFolded = players.filter(p => p.status !== 'folded');
  if (nonFolded.length <= 1) {
    return { activePlayerIndex: null, street: 'showdown', players, isHandOver: true };
  }

  // Build a mock state to call isBettingRoundClosed
  const mockState = {
    players,
    bettingRound,
    street,
    config,
  } as unknown as GameState;

  if (isBettingRoundClosed(mockState)) {
    const next = nextStreet(street);
    if (next === 'showdown' || next === 'finished') {
      return { activePlayerIndex: null, street: next, players, isHandOver: next === 'finished' };
    }
    // Reset bets for the new street but don't deal the board here —
    // that's triggered by a DEAL_BOARD action from the UI/controller
    const resetPlayers = resetStreetBets(players) as Player[];
    return { activePlayerIndex: null, street: next, players: resetPlayers, isHandOver: false };
  }

  // Round still open — find next active player
  const nextIdx = currentIndex !== null
    ? nextActiveIndex(players, currentIndex)
    : null;

  return { activePlayerIndex: nextIdx, street, players, isHandOver: false };
}
