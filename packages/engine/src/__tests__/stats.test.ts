import { describe, it, expect } from 'vitest';
import { computePlayerStats, computeAllStats, handsForMatch } from '../stats.js';
import type { Action, GameConfig, HandRecord } from '../types.js';

function huConfig(handId: string): GameConfig {
  return {
    handId, mode: 'practice', smallBlind: 10, bigBlind: 20, ante: 0, dealerSeatIndex: 0,
    players: [
      { id: 'hero', name: 'You', seatIndex: 0, startingStack: 1000 },
      { id: 'villain', name: 'V', seatIndex: 1, startingStack: 1000 },
    ],
    startingStacks: { hero: 1000, villain: 1000 },
  };
}

let seq = 0;
const mk = (playerId: string, partial: Omit<Action, 'id' | 'playerId' | 'timestamp'>): Action =>
  ({ id: `a${seq++}`, playerId, timestamp: 0, ...partial } as Action);

function record(handId: string, log: Action[]): HandRecord {
  return {
    handId, startedAt: 0, finishedAt: 0, config: huConfig(handId), actionLog: log,
    summary: { playerNames: ['You', 'V'], winnerIds: [], potTotal: 0, streetReached: 'preflop' },
  };
}

// Hand 1: hero (button/SB) raises to 60 preflop, villain folds; hero wins 80.
const hand1 = record('M-h1', [
  mk('hero', { type: 'POST_BLIND', amount: 10, blindType: 'small' } as never),
  mk('villain', { type: 'POST_BLIND', amount: 20, blindType: 'big' } as never),
  mk('hero', { type: 'RAISE', amount: 60 } as never),
  mk('villain', { type: 'FOLD' } as never),
  mk('hero', { type: 'AWARD_POT', potIndex: 0, winnerIds: ['hero'], amount: 40, oddChipWinnerId: null } as never),
  mk('hero', { type: 'AWARD_POT', potIndex: 1, winnerIds: ['hero'], amount: 40, oddChipWinnerId: null } as never),
]);

// Hand 2: hero (button/SB) folds preflop; villain wins 30.
const hand2 = record('M-h2', [
  mk('hero', { type: 'POST_BLIND', amount: 10, blindType: 'small' } as never),
  mk('villain', { type: 'POST_BLIND', amount: 20, blindType: 'big' } as never),
  mk('hero', { type: 'FOLD' } as never),
  mk('villain', { type: 'AWARD_POT', potIndex: 0, winnerIds: ['villain'], amount: 20, oddChipWinnerId: null } as never),
  mk('villain', { type: 'AWARD_POT', potIndex: 1, winnerIds: ['villain'], amount: 10, oddChipWinnerId: null } as never),
]);

describe('computePlayerStats', () => {
  it('hero: VPIP/PFR over two hands (raised one, folded one)', () => {
    const s = computePlayerStats([hand1, hand2], 'hero');
    expect(s.handsPlayed).toBe(2);
    expect(s.vpipHands).toBe(1);
    expect(s.pfrHands).toBe(1);
    expect(s.vpip).toBeCloseTo(0.5, 6);
    expect(s.pfr).toBeCloseTo(0.5, 6);
  });

  it('hero: aggression factor counts the raise, no calls', () => {
    const s = computePlayerStats([hand1, hand2], 'hero');
    expect(s.aggressiveActions).toBe(1);
    expect(s.calls).toBe(0);
    expect(s.aggressionFactor).toBe(1); // calls=0 ⇒ raw aggressive count
  });

  it('net chips reconcile across the session', () => {
    const hero = computePlayerStats([hand1, hand2], 'hero');
    const villain = computePlayerStats([hand1, hand2], 'villain');
    // Hand1: hero +20, villain -20. Hand2: hero -10, villain +10.
    expect(hero.net).toBe(10);
    expect(villain.net).toBe(-10);
    // Zero-sum across all players
    expect(hero.net + villain.net).toBe(0);
  });

  it('villain posting the big blind is NOT counted as VPIP', () => {
    const s = computePlayerStats([hand1], 'villain');
    expect(s.vpipHands).toBe(0);
    expect(s.pfr).toBe(0);
  });

  it('ignores hands a player was not dealt into', () => {
    const other = record('M-h3', [
      mk('hero', { type: 'POST_BLIND', amount: 10, blindType: 'small' } as never),
      mk('villain', { type: 'POST_BLIND', amount: 20, blindType: 'big' } as never),
    ]);
    const s = computePlayerStats([other], 'ghost');
    expect(s.handsPlayed).toBe(0);
    expect(s.vpip).toBe(0);
    expect(s.aggressionFactor).toBe(0);
  });
});

describe('computeAllStats + handsForMatch', () => {
  it('returns one entry per distinct player', () => {
    const all = computeAllStats([hand1, hand2]);
    expect(all.map(s => s.playerId).sort()).toEqual(['hero', 'villain']);
  });

  it('filters hands by match id prefix', () => {
    const foreign = record('OTHER-h1', []);
    const filtered = handsForMatch([hand1, hand2, foreign], 'M');
    expect(filtered.map(h => h.handId)).toEqual(['M-h1', 'M-h2']);
  });
});
