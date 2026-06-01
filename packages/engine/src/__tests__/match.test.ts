import { describe, it, expect } from 'vitest';
import {
  createMatch, startNextHand, applyHandResult, assignBlinds, rotateButton,
  survivingPlayers, isMatchOver, matchWinner,
  type MatchConfig, type MatchState,
} from '../match.js';
import { createInitialState } from '../state.js';
import { applyAction } from '../applyAction.js';
import { whoseTurn } from '../whoseTurn.js';
import type { Action, GameConfig, PlayerId } from '../types.js';

function makeConfig(n: number, stack = 1000): MatchConfig {
  return {
    matchId: 'M',
    smallBlind: 10,
    bigBlind: 20,
    startingStack: stack,
    players: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`, name: `P${i}`, seatIndex: i, isHuman: i === 0,
    })),
  };
}

/** Post the two blinds onto a fresh engine state and return resulting state. */
function postBlinds(handConfig: GameConfig, sbId: PlayerId, bbId: PlayerId) {
  let s = createInitialState(handConfig);
  const mk = (playerId: PlayerId, amount: number, blindType: 'small' | 'big'): Action => ({
    id: `${playerId}-${blindType}`, playerId, timestamp: 0, type: 'POST_BLIND', amount, blindType,
  });
  s = applyAction(s, mk(sbId, handConfig.smallBlind, 'small'));
  s = applyAction(s, mk(bbId, handConfig.bigBlind, 'big'));
  return s;
}

describe('createMatch', () => {
  it('initialises stacks and button', () => {
    const m = createMatch(makeConfig(3), 0);
    expect(m.stacks).toEqual({ p0: 1000, p1: 1000, p2: 1000 });
    expect(m.buttonSeat).toBe(0);
    expect(m.handNumber).toBe(0);
    expect(m.status).toBe('pending');
    expect(m.events[0]?.type).toBe('MATCH_STARTED');
  });

  it('rejects fewer than 2 players', () => {
    expect(() => createMatch({ ...makeConfig(2), players: [{ id: 'x', name: 'X', seatIndex: 0 }] })).toThrow();
  });
});

describe('assignBlinds — heads-up exception', () => {
  it('heads-up: button posts the small blind', () => {
    const survivors = survivingPlayers(createMatch(makeConfig(2), 0));
    const blinds = assignBlinds(survivors, 0); // button seat 0
    expect(blinds.sbId).toBe('p0'); // button = SB
    expect(blinds.bbId).toBe('p1');
  });

  it('3-handed: small blind is left of button, big blind next', () => {
    const survivors = survivingPlayers(createMatch(makeConfig(3), 0));
    const blinds = assignBlinds(survivors, 0); // button seat 0
    expect(blinds.sbId).toBe('p1');
    expect(blinds.bbId).toBe('p2');
  });
});

describe('first-to-act through the real engine (the classic HU bug)', () => {
  it('heads-up: BUTTON (SB) acts first preflop', () => {
    const m0 = createMatch(makeConfig(2), 0);
    const { handConfig, blinds } = startNextHand(m0, 0);
    const s = postBlinds(handConfig, blinds.sbId, blinds.bbId);
    // p0 is the button & SB; in HU the button acts first preflop
    expect(whoseTurn(s)).toBe('p0');
  });

  it('heads-up: BIG BLIND acts first postflop', () => {
    const m0 = createMatch(makeConfig(2), 0);
    const { handConfig, blinds } = startNextHand(m0, 0);
    let s = postBlinds(handConfig, blinds.sbId, blinds.bbId);
    // preflop: button(SB=p0) calls, BB(p1) checks option → flop
    s = applyAction(s, { id: 'a1', playerId: 'p0', timestamp: 0, type: 'CALL', amount: 10 });
    s = applyAction(s, { id: 'a2', playerId: 'p1', timestamp: 0, type: 'CHECK' });
    s = applyAction(s, { id: 'a3', playerId: 'dealer', timestamp: 0, type: 'DEAL_BOARD', street: 'flop',
      cards: [{ rank: '2', suit: 'c' }, { rank: '7', suit: 'd' }, { rank: 'K', suit: 's' }] });
    // postflop the non-button (BB=p1) acts first
    expect(whoseTurn(s)).toBe('p1');
  });

  it('3-handed: UTG (left of big blind) acts first preflop', () => {
    const m0 = createMatch(makeConfig(3), 0);
    const { handConfig, blinds } = startNextHand(m0, 0);
    const s = postBlinds(handConfig, blinds.sbId, blinds.bbId);
    // button p0, SB p1, BB p2 → first to act is p0 (UTG wraps to button seat in 3-handed)
    expect(whoseTurn(s)).toBe('p0');
  });
});

describe('button rotation', () => {
  it('advances clockwise each hand', () => {
    let m = createMatch(makeConfig(3), 0);
    const seats: number[] = [];
    for (let i = 0; i < 4; i++) {
      const nh = startNextHand(m, 0);
      seats.push(nh.handConfig.dealerSeatIndex);
      // simulate a no-op result (stacks unchanged) to advance
      m = applyHandResult(nh.state, nh.handConfig.handId, nh.state.stacks, 0);
    }
    expect(seats).toEqual([0, 1, 2, 0]); // first hand keeps button at 0, then rotates
  });

  it('skips eliminated seats', () => {
    let m = createMatch(makeConfig(3), 0);
    // eliminate p1 (seat 1)
    m = { ...m, eliminated: ['p1'] } as MatchState;
    expect(rotateButton(m, 0)).toBe(2); // seat 1 skipped
    expect(rotateButton(m, 2)).toBe(0);
  });
});

describe('stack carryover', () => {
  it('carries final stacks into the next hand config', () => {
    const m0 = createMatch(makeConfig(2), 1000);
    const h1 = startNextHand(m0, 0);
    // p0 wins 300 from p1
    const after = applyHandResult(h1.state, h1.handConfig.handId, { p0: 1300, p1: 700 }, 0);
    const h2 = startNextHand(after, 0);
    expect(h2.handConfig.startingStacks).toEqual({ p0: 1300, p1: 700 });
    expect(h2.handConfig.players.find(p => p.id === 'p0')?.startingStack).toBe(1300);
  });
});

describe('elimination + match over', () => {
  it('eliminates a busted player and completes heads-up matches', () => {
    const m0 = createMatch(makeConfig(2), 1000);
    const h1 = startNextHand(m0, 0);
    const after = applyHandResult(h1.state, h1.handConfig.handId, { p0: 2000, p1: 0 }, 0);
    expect(after.eliminated).toEqual(['p1']);
    expect(isMatchOver(after)).toBe(true);
    expect(matchWinner(after)).toBe('p0');
    expect(after.events.some(e => e.type === 'PLAYER_ELIMINATED')).toBe(true);
    expect(after.events.some(e => e.type === 'MATCH_COMPLETED')).toBe(true);
  });

  it('continues a 3-handed match after one elimination', () => {
    const m0 = createMatch(makeConfig(3), 1000);
    const h1 = startNextHand(m0, 0);
    const after = applyHandResult(h1.state, h1.handConfig.handId, { p0: 1500, p1: 1500, p2: 0 }, 0);
    expect(after.eliminated).toEqual(['p2']);
    expect(after.status).toBe('in-progress');
    expect(survivingPlayers(after).map(p => p.id)).toEqual(['p0', 'p1']);
  });

  it('orders multi-bust by stack at hand start (shorter stack finishes lower)', () => {
    let m = createMatch(makeConfig(3), 1000);
    // craft uneven stacks before the hand
    m = { ...m, stacks: { p0: 2500, p1: 300, p2: 200 } } as MatchState;
    const h1 = startNextHand(m, 0);
    // both short stacks bust this hand
    const after = applyHandResult(h1.state, h1.handConfig.handId, { p0: 3000, p1: 0, p2: 0 }, 0);
    // p2 started with fewer (200) than p1 (300) → p2 eliminated first
    expect(after.eliminated).toEqual(['p2', 'p1']);
    expect(matchWinner(after)).toBe('p0');
  });
});
