import { describe, it, expect } from 'vitest';
import { legalActions } from '../legalActions.js';
import { createInitialState } from '../state.js';
import type { GameConfig, GameState, BettingRoundState } from '../types.js';

function makeConfig(numPlayers = 3): GameConfig {
  return {
    handId: 'test',
    mode: 'umpire',
    smallBlind: 5,
    bigBlind: 10,
    ante: 0,
    dealerSeatIndex: 0,
    players: Array.from({ length: numPlayers }, (_, i) => ({
      id: `p${i + 1}`,
      name: `P${i + 1}`,
      seatIndex: i,
      startingStack: 500,
    })),
    startingStacks: Object.fromEntries(
      Array.from({ length: numPlayers }, (_, i) => [`p${i + 1}`, 500]),
    ),
  };
}

function withBettingRound(
  state: GameState,
  br: Partial<BettingRoundState>,
  activeIdx: number,
): GameState {
  return {
    ...state,
    bettingRound: { ...state.bettingRound, ...br },
    activePlayerIndex: activeIdx,
  };
}

describe('legalActions — no outstanding bet (check/bet)', () => {
  it('returns CHECK and BET when no bet is open', () => {
    const cfg = makeConfig(2);
    const state = withBettingRound(
      createInitialState(cfg),
      { currentBet: 0, actorIdsThisStreet: [] },
      0,
    );
    const actions = legalActions(state);
    expect(actions.map(a => a.type)).toEqual(expect.arrayContaining(['CHECK', 'BET']));
    expect(actions.find(a => a.type === 'FOLD')).toBeUndefined();
  });

  it('BET min is bigBlind', () => {
    const cfg = makeConfig(2);
    const state = withBettingRound(createInitialState(cfg), { currentBet: 0 }, 0);
    const bet = legalActions(state).find(a => a.type === 'BET') as { type: 'BET'; min: number; max: number } | undefined;
    expect(bet?.min).toBe(10); // bigBlind
  });

  it('BET max is player stack', () => {
    const cfg = makeConfig(2);
    const state = withBettingRound(createInitialState(cfg), { currentBet: 0 }, 0);
    const bet = legalActions(state).find(a => a.type === 'BET') as { type: 'BET'; min: number; max: number } | undefined;
    expect(bet?.max).toBe(500);
  });
});

describe('legalActions — outstanding bet (fold/call/raise)', () => {
  it('returns FOLD, CALL and RAISE when facing a bet', () => {
    const cfg = makeConfig(2);
    const base = createInitialState(cfg);
    const state: GameState = {
      ...base,
      bettingRound: { ...base.bettingRound, currentBet: 50, lastRaiseSize: 50 },
      players: base.players.map((p, i) =>
        i === 1 ? { ...p, betThisStreet: 0 } : { ...p, betThisStreet: 50 }
      ),
      activePlayerIndex: 1,
    };
    const actions = legalActions(state);
    expect(actions.map(a => a.type)).toEqual(expect.arrayContaining(['FOLD', 'CALL', 'RAISE']));
  });

  it('CALL amount equals the gap (currentBet - betThisStreet)', () => {
    const cfg = makeConfig(2);
    const base = createInitialState(cfg);
    const state: GameState = {
      ...base,
      bettingRound: { ...base.bettingRound, currentBet: 100, lastRaiseSize: 100 },
      players: base.players.map((p, i) =>
        i === 1 ? { ...p, betThisStreet: 20 } : { ...p, betThisStreet: 100 }
      ),
      activePlayerIndex: 1,
    };
    const call = legalActions(state).find(a => a.type === 'CALL') as { type: 'CALL'; amount: number } | undefined;
    expect(call?.amount).toBe(80);
  });

  it('RAISE min follows the min-raise rule', () => {
    const cfg = makeConfig(2);
    const base = createInitialState(cfg);
    // Current bet is 50, last raise size was 50 → min raise-to = 100
    const state: GameState = {
      ...base,
      bettingRound: { ...base.bettingRound, currentBet: 50, lastRaiseSize: 50 },
      players: base.players.map((p, i) =>
        i === 1 ? { ...p, betThisStreet: 0 } : { ...p, betThisStreet: 50 }
      ),
      activePlayerIndex: 1,
    };
    const raise = legalActions(state).find(a => a.type === 'RAISE') as { type: 'RAISE'; min: number } | undefined;
    expect(raise?.min).toBe(100); // 50 + 50
  });

  it('returns ALL_IN (not RAISE) when stack is not enough for full raise', () => {
    const cfg = makeConfig(2);
    const base = createInitialState(cfg);
    // Player p2 only has 30 chips vs a 100 bet
    const state: GameState = {
      ...base,
      bettingRound: { ...base.bettingRound, currentBet: 100, lastRaiseSize: 100 },
      players: base.players.map((p, i) =>
        i === 1 ? { ...p, betThisStreet: 0, stack: 30 } : { ...p, betThisStreet: 100 }
      ),
      activePlayerIndex: 1,
    };
    const actions = legalActions(state);
    expect(actions.find(a => a.type === 'RAISE')).toBeUndefined();
    expect(actions.find(a => a.type === 'ALL_IN')).toBeDefined();
  });
});

describe('legalActions — edge cases', () => {
  it('returns empty array when hand is over', () => {
    const cfg = makeConfig(2);
    const state = { ...createInitialState(cfg), isHandOver: true };
    expect(legalActions(state)).toEqual([]);
  });

  it('returns empty array when activePlayerIndex is null', () => {
    const cfg = makeConfig(2);
    const state = { ...createInitialState(cfg), activePlayerIndex: null };
    expect(legalActions(state)).toEqual([]);
  });
});
