import type { Action, GameState, PlayerId, Street } from '../types.js';
import type {
  DifficultyLevel,
  StrategyActionType,
  StrategyAdviceContext,
  StrategyDecisionContext,
  StrategyProfileId,
  StrategyStreet,
  TablePosition,
} from './types.js';

const STRATEGY_STREETS = new Set<Street>(['preflop', 'flop', 'turn', 'river']);

export interface StrategyContextOptions {
  readonly heroId?: PlayerId;
  readonly profileId: StrategyProfileId;
  readonly difficulty: DifficultyLevel;
}

export function buildStrategyDecisionContext(
  state: GameState,
  action: Action,
  options: StrategyContextOptions,
): StrategyDecisionContext | null {
  const base = buildBaseContext(state, action.playerId, options);
  if (!base) return null;

  const userAction = actionTypeForStrategy(action);
  if (!userAction) return null;

  const userSizing = actionAmount(action);
  return {
    ...base,
    userAction,
    ...(userSizing !== undefined ? { userSizing } : {}),
  };
}

export function buildStrategyAdviceContext(
  state: GameState,
  options: StrategyContextOptions & { readonly heroId: PlayerId },
): StrategyAdviceContext | null {
  return buildBaseContext(state, options.heroId, options);
}

function buildBaseContext(
  state: GameState,
  heroId: PlayerId,
  options: StrategyContextOptions,
): StrategyAdviceContext | null {
  if (!STRATEGY_STREETS.has(state.street)) return null;

  const hero = state.players.find(p => p.id === heroId);
  if (!hero) return null;

  const street = state.street as StrategyStreet;
  const positionsByPlayerId = derivePositionsByPlayerId(state);
  const boardCards = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];
  const stackSizes = Object.fromEntries(state.players.map(p => [p.id, p.stack]));
  const activeInPot = state.players.filter(p => p.status !== 'folded' && p.status !== 'sitting-out');
  const currentBetToCall = Math.max(0, state.bettingRound.currentBet - hero.betThisStreet);

  return {
    profileId: options.profileId,
    difficulty: options.difficulty,
    heroId,
    tableSize: state.config.players.length,
    ...(positionsByPlayerId[heroId] ? { position: positionsByPlayerId[heroId] } : {}),
    positionsByPlayerId,
    street,
    heroHoleCards: hero.holeCards,
    boardCards,
    potSize: state.sidePots.reduce((sum, pot) => sum + pot.amount, 0),
    currentBetToCall,
    currentBet: state.bettingRound.currentBet,
    smallBlind: state.config.smallBlind,
    bigBlind: state.config.bigBlind,
    stackSizes,
    previousActions: state.actionLog,
    preflopAggressorId: inferPreflopAggressor(state.actionLog),
    isHeadsUpPot: activeInPot.length === 2,
    isMultiwayPot: activeInPot.length > 2,
  };
}

function actionTypeForStrategy(action: Action): StrategyActionType | null {
  switch (action.type) {
    case 'FOLD':
    case 'CHECK':
    case 'CALL':
    case 'BET':
    case 'RAISE':
    case 'ALL_IN':
      return action.type;
    default:
      return null;
  }
}

function actionAmount(action: Action): number | undefined {
  return 'amount' in action && typeof action.amount === 'number'
    ? action.amount
    : undefined;
}

export function derivePositionsByPlayerId(state: Pick<GameState, 'config'>): Record<PlayerId, TablePosition> {
  const players = [...state.config.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const tableSize = players.length;
  const buttonIndex = players.findIndex(p => p.seatIndex === state.config.dealerSeatIndex);
  if (buttonIndex < 0) return {};

  const assign = (offsetFromButton: number): TablePosition | null => {
    if (tableSize === 2) {
      if (offsetFromButton === 0) return 'BTN/SB';
      if (offsetFromButton === 1) return 'BB';
      return null;
    }
    if (offsetFromButton === 0) return 'BTN';
    if (offsetFromButton === 1) return 'SB';
    if (offsetFromButton === 2) return 'BB';

    const nonBlindOffsets = tableSize - 3;
    if (nonBlindOffsets <= 1) return 'CO';
    if (nonBlindOffsets === 2) return offsetFromButton === 3 ? 'MP' : 'CO';

    if (offsetFromButton === 3) return 'EP';
    if (offsetFromButton === 4) return 'MP';
    if (offsetFromButton === 5) return 'CO';
    return null;
  };

  const out: Record<PlayerId, TablePosition> = {};
  for (let i = 0; i < tableSize; i++) {
    const player = players[(buttonIndex + i) % tableSize]!;
    const position = assign(i);
    if (position) out[player.id] = position;
  }
  return out;
}

export function inferPreflopAggressor(actions: readonly Action[]): PlayerId | null {
  let aggressor: PlayerId | null = null;
  for (const action of actions) {
    if (action.type === 'DEAL_BOARD' && action.street === 'flop') break;
    if (action.type === 'RAISE' || action.type === 'BET' || action.type === 'ALL_IN') {
      aggressor = action.playerId;
    }
  }
  return aggressor;
}
