import { describe, it, expect } from 'vitest';
import { isBettingRoundClosed, nextActiveIndex, nextStreet } from '../bettingRound.js';
import { createInitialState } from '../state.js';
import type { GameConfig, GameState, Player } from '../types.js';

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
      startingStack: 1000,
    })),
    startingStacks: Object.fromEntries(
      Array.from({ length: numPlayers }, (_, i) => [`p${i + 1}`, 1000]),
    ),
  };
}

function patchState(state: GameState, overrides: Partial<GameState>): GameState {
  return { ...state, ...overrides };
}

function patchPlayers(
  state: GameState,
  updates: Partial<Player>[],
): GameState {
  const players = state.players.map((p, i) => ({ ...p, ...(updates[i] ?? {}) }));
  return { ...state, players };
}

describe('isBettingRoundClosed', () => {
  it('returns false when not all active players have acted', () => {
    const state = createInitialState(makeConfig());
    // No actors yet, BB has option — round is open
    expect(isBettingRoundClosed(state)).toBe(false);
  });

  it('returns true when all active players matched and acted (post-flop)', () => {
    const cfg = makeConfig(2);
    let state = createInitialState(cfg);
    // Simulate flop: P1 and P2 both checked
    state = patchState(state, {
      street: 'flop',
      bettingRound: {
        currentBet: 0,
        lastRaiseSize: 10,
        lastAggressorId: null,
        bigBlindHasOption: false,
        actorIdsThisStreet: ['p1', 'p2'],
      },
    });
    state = patchPlayers(state, [{ betThisStreet: 0 }, { betThisStreet: 0 }]);
    expect(isBettingRoundClosed(state)).toBe(true);
  });

  it('returns false pre-flop when BB has not yet exercised option', () => {
    const cfg = makeConfig(2);
    let state = createInitialState(cfg);
    // Simulate: P1 (UTG heads-up) called; BB has option
    state = patchState(state, {
      street: 'preflop',
      bettingRound: {
        currentBet: 10,
        lastRaiseSize: 10,
        lastAggressorId: null,
        bigBlindHasOption: true,
        actorIdsThisStreet: ['p1', 'p2'],
      },
    });
    state = patchPlayers(state, [{ betThisStreet: 10 }, { betThisStreet: 10 }]);
    expect(isBettingRoundClosed(state)).toBe(false);
  });

  it('returns true pre-flop after BB checks their option', () => {
    const cfg = makeConfig(2);
    let state = createInitialState(cfg);
    state = patchState(state, {
      street: 'preflop',
      bettingRound: {
        currentBet: 10,
        lastRaiseSize: 10,
        lastAggressorId: null,
        bigBlindHasOption: false,
        actorIdsThisStreet: ['p1', 'p2'],
      },
    });
    state = patchPlayers(state, [{ betThisStreet: 10 }, { betThisStreet: 10 }]);
    expect(isBettingRoundClosed(state)).toBe(true);
  });

  it('returns true when all non-folded players are all-in', () => {
    const cfg = makeConfig(2);
    let state = createInitialState(cfg);
    state = patchState(state, {
      street: 'flop',
      bettingRound: {
        currentBet: 500,
        lastRaiseSize: 500,
        lastAggressorId: 'p1',
        bigBlindHasOption: false,
        actorIdsThisStreet: ['p1', 'p2'],
      },
    });
    state = patchPlayers(state, [
      { status: 'allin', betThisStreet: 500 },
      { status: 'allin', betThisStreet: 500 },
    ]);
    expect(isBettingRoundClosed(state)).toBe(true);
  });

  it('returns false when one player has not matched the current bet', () => {
    const cfg = makeConfig(2);
    let state = createInitialState(cfg);
    state = patchState(state, {
      street: 'flop',
      bettingRound: {
        currentBet: 50,
        lastRaiseSize: 50,
        lastAggressorId: 'p1',
        bigBlindHasOption: false,
        actorIdsThisStreet: ['p1'],
      },
    });
    state = patchPlayers(state, [{ betThisStreet: 50 }, { betThisStreet: 0 }]);
    expect(isBettingRoundClosed(state)).toBe(false);
  });
});

describe('nextActiveIndex', () => {
  it('finds next active player clockwise', () => {
    const players = [
      { status: 'active' } as Player,
      { status: 'folded' } as Player,
      { status: 'active' } as Player,
    ];
    expect(nextActiveIndex(players, 0)).toBe(2);
  });

  it('wraps around the table', () => {
    const players = [
      { status: 'active' } as Player,
      { status: 'folded' } as Player,
      { status: 'folded' } as Player,
    ];
    expect(nextActiveIndex(players, 1)).toBe(0);
  });

  it('returns null when no active players remain', () => {
    const players = [
      { status: 'folded' } as Player,
      { status: 'allin' } as Player,
    ];
    expect(nextActiveIndex(players, 0)).toBeNull();
  });
});

describe('nextStreet', () => {
  it('sequences correctly through all streets', () => {
    expect(nextStreet('preflop')).toBe('flop');
    expect(nextStreet('flop')).toBe('turn');
    expect(nextStreet('turn')).toBe('river');
    expect(nextStreet('river')).toBe('showdown');
    expect(nextStreet('showdown')).toBe('finished');
  });
});
