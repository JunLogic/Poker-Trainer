import type { GameConfig, GameState, Player, Board, BettingRoundState } from './types.js';

/** Derive the ordered seat list starting left of the dealer */
function seatsInOrder(config: GameConfig): readonly number[] {
  const seats = config.players.map(p => p.seatIndex).sort((a, b) => a - b);
  const dealerPos = seats.indexOf(config.dealerSeatIndex);
  return [...seats.slice(dealerPos + 1), ...seats.slice(0, dealerPos + 1)];
}

/** Build the initial GameState before any actions have been applied */
export function createInitialState(config: GameConfig): GameState {
  const players: Player[] = config.players.map(p => ({
    id: p.id,
    name: p.name,
    stack: config.startingStacks[p.id] ?? 0,
    betCommitted: 0,
    betThisStreet: 0,
    status: 'active' as const,
    holeCards: null,
    seatIndex: p.seatIndex,
  }));

  const orderedSeats = seatsInOrder(config);
  // Pre-flop: first to act is UTG (third seat left of dealer = index 2 after SB/BB)
  // However the actual first action is SB posting — engine dispatches POST_BLIND
  // actions first. activePlayerIndex points to SB seat initially.
  const sbSeat = orderedSeats[0];
  const sbIndex = players.findIndex(p => p.seatIndex === sbSeat);

  const bettingRound: BettingRoundState = {
    currentBet: 0,
    lastRaiseSize: config.bigBlind,
    lastAggressorId: null,
    bigBlindHasOption: false,
    actorIdsThisStreet: [],
  };

  const board: Board = { flop: null, turn: null, river: null };

  return {
    config,
    players,
    board,
    sidePots: [],
    street: 'preflop',
    bettingRound,
    actionLog: [],
    activePlayerIndex: sbIndex >= 0 ? sbIndex : null,
    deck: null,
    isHandOver: false,
  };
}
