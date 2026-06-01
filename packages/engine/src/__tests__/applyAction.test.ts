import { describe, it, expect } from 'vitest';
import { applyAction } from '../applyAction.js';
import { createInitialState } from '../state.js';
import type { GameConfig, PostBlindAction, FoldAction, CheckAction, CallAction, BetAction, RaiseAction } from '../types.js';
import { nanoid } from 'nanoid';

function cfg(numPlayers = 3): GameConfig {
  return {
    handId: 'hand1',
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

function action<T extends object>(type: string, playerId: string, extra?: T) {
  return { id: nanoid(), playerId, timestamp: Date.now(), type, ...extra } as never;
}

describe('POST_BLIND', () => {
  it('reduces player stack and increases betThisStreet', () => {
    const state = createInitialState(cfg());
    const next = applyAction(state, action('POST_BLIND', 'p1', { amount: 5, blindType: 'small' }) as PostBlindAction);
    const p1 = next.players.find(p => p.id === 'p1')!;
    expect(p1.stack).toBe(995);
    expect(p1.betThisStreet).toBe(5);
    expect(p1.betCommitted).toBe(5);
  });

  it('sets currentBet to bigBlind after BB posts', () => {
    let state = createInitialState(cfg());
    state = applyAction(state, action('POST_BLIND', 'p1', { amount: 5, blindType: 'small' }) as PostBlindAction);
    state = applyAction(state, action('POST_BLIND', 'p2', { amount: 10, blindType: 'big' }) as PostBlindAction);
    expect(state.bettingRound.currentBet).toBe(10);
    expect(state.bettingRound.bigBlindHasOption).toBe(true);
  });
});

describe('FOLD', () => {
  it('marks player as folded', () => {
    let state = createInitialState(cfg());
    state = applyAction(state, action('POST_BLIND', 'p1', { amount: 5, blindType: 'small' }) as PostBlindAction);
    state = applyAction(state, action('POST_BLIND', 'p2', { amount: 10, blindType: 'big' }) as PostBlindAction);
    // p3 folds
    state = applyAction(state, action('FOLD', 'p3') as FoldAction);
    const p3 = state.players.find(p => p.id === 'p3')!;
    expect(p3.status).toBe('folded');
  });

  it('ends hand when only one player remains', () => {
    let state = createInitialState(cfg(2));
    state = applyAction(state, action('POST_BLIND', 'p1', { amount: 5, blindType: 'small' }) as PostBlindAction);
    state = applyAction(state, action('POST_BLIND', 'p2', { amount: 10, blindType: 'big' }) as PostBlindAction);
    state = applyAction(state, action('FOLD', 'p1') as FoldAction);
    expect(state.isHandOver).toBe(true);
    expect(state.street).toBe('showdown');
  });
});

describe('CHECK', () => {
  it('adds player to actorIdsThisStreet', () => {
    let state = createInitialState(cfg(2));
    state = applyAction(state, action('POST_BLIND', 'p1', { amount: 5, blindType: 'small' }) as PostBlindAction);
    state = applyAction(state, action('POST_BLIND', 'p2', { amount: 10, blindType: 'big' }) as PostBlindAction);
    // Simulate being on flop with no bet
    state = {
      ...state,
      street: 'flop',
      bettingRound: { ...state.bettingRound, currentBet: 0, actorIdsThisStreet: [] },
      players: state.players.map(p => ({ ...p, betThisStreet: 0 })),
      activePlayerIndex: 0,
    };
    state = applyAction(state, action('CHECK', 'p1') as CheckAction);
    expect(state.bettingRound.actorIdsThisStreet).toContain('p1');
  });

  it('clears bigBlindHasOption on BB check', () => {
    let state = createInitialState(cfg(2));
    state = applyAction(state, action('POST_BLIND', 'p1', { amount: 5, blindType: 'small' }) as PostBlindAction);
    state = applyAction(state, action('POST_BLIND', 'p2', { amount: 10, blindType: 'big' }) as PostBlindAction);
    // p1 calls
    state = applyAction(state, action('CALL', 'p1', { amount: 5 }) as CallAction);
    expect(state.bettingRound.bigBlindHasOption).toBe(true);
    // p2 BB checks
    state = applyAction(state, action('CHECK', 'p2') as CheckAction);
    expect(state.bettingRound.bigBlindHasOption).toBe(false);
  });
});

describe('BET', () => {
  it('updates currentBet and reopens action', () => {
    let state = createInitialState(cfg(3));
    state = {
      ...state,
      street: 'flop',
      bettingRound: { ...state.bettingRound, currentBet: 0, actorIdsThisStreet: ['p1', 'p2'] },
      activePlayerIndex: 2,
    };
    state = applyAction(state, action('BET', 'p3', { amount: 40 }) as BetAction);
    expect(state.bettingRound.currentBet).toBe(40);
    // Reopened action — only p3 should be in actorIdsThisStreet
    expect(state.bettingRound.actorIdsThisStreet).toEqual(['p3']);
  });
});

describe('RAISE', () => {
  it('updates currentBet and lastRaiseSize', () => {
    let state = createInitialState(cfg(2));
    state = applyAction(state, action('POST_BLIND', 'p1', { amount: 5, blindType: 'small' }) as PostBlindAction);
    state = applyAction(state, action('POST_BLIND', 'p2', { amount: 10, blindType: 'big' }) as PostBlindAction);
    // p1 raises to 30
    state = applyAction(state, action('RAISE', 'p1', { amount: 30 }) as RaiseAction);
    expect(state.bettingRound.currentBet).toBe(30);
    expect(state.bettingRound.lastRaiseSize).toBe(20); // 30-10
  });
});

describe('stack conservation', () => {
  it('total chips are conserved through a betting sequence', () => {
    const config = cfg(3);
    const totalStart = 3000;
    let state = createInitialState(config);
    const sumStacks = () => state.players.reduce((s, p) => s + p.stack, 0);

    state = applyAction(state, action('POST_BLIND', 'p1', { amount: 5, blindType: 'small' }) as PostBlindAction);
    state = applyAction(state, action('POST_BLIND', 'p2', { amount: 10, blindType: 'big' }) as PostBlindAction);

    // Total chips in stacks + all betCommitted = totalStart
    const totalCommitted = () => state.players.reduce((s, p) => s + p.betCommitted, 0);
    expect(sumStacks() + totalCommitted()).toBe(totalStart);

    state = applyAction(state, action('RAISE', 'p3', { amount: 30 }) as RaiseAction);
    expect(sumStacks() + totalCommitted()).toBe(totalStart);

    state = applyAction(state, action('CALL', 'p1', { amount: 25 }) as CallAction);
    expect(sumStacks() + totalCommitted()).toBe(totalStart);
  });
});
