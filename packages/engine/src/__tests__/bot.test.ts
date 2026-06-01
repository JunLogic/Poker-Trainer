import { describe, it, expect } from 'vitest';
import { HeuristicBot, BOT_PROFILES, makeBot } from '../bot.js';
import type { GameState, LegalAction, Card, Player } from '../types.js';

// Minimal seeded RNG (LCG) for deterministic tests.
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
}

// The bot only reads state.sidePots + (rarely) players; build a minimal state.
function stateWithPot(pot: number, players: Partial<Player>[] = []): GameState {
  return {
    sidePots: pot > 0 ? [{ amount: pot, eligiblePlayerIds: [] }] : [],
    players,
  } as unknown as GameState;
}

const FACING_BET: LegalAction[] = [
  { type: 'FOLD' },
  { type: 'CALL', amount: 50 },
  { type: 'RAISE', min: 100, max: 1000 },
];
const CHECK_LINE: LegalAction[] = [
  { type: 'CHECK' },
  { type: 'BET', min: 20, max: 1000 },
];

describe('skill: epsilon', () => {
  it('epsilon=0 deterministically plays the best action in a clear value spot', () => {
    const profile = { ...BOT_PROFILES.tag!, epsilon: 0, equityNoiseStd: 0, aggression: 1, sizingMin: 0.6, sizingMax: 0.6 };
    // equity 0.9 vs potOdds 50/150≈0.33 → clearly ahead, aggression 1 ⇒ always raise
    for (let seed = 1; seed <= 20; seed++) {
      const bot = new HeuristicBot('t', profile, seeded(seed));
      const a = bot.selectAction(stateWithPot(100), FACING_BET, 'me', 0.9);
      expect(a.type).toBe('RAISE');
    }
  });

  it('epsilon=1 deviates from the intended action a large fraction of the time', () => {
    const profile = { ...BOT_PROFILES.tag!, epsilon: 1 };
    // reference intended action in this clear spot (epsilon 0 clone)
    const ref = new HeuristicBot('r', { ...profile, epsilon: 0, equityNoiseStd: 0, aggression: 1, sizingMin: 0.6, sizingMax: 0.6 }, seeded(7));
    const intended = ref.selectAction(stateWithPot(100), FACING_BET, 'me', 0.9).type;

    let deviations = 0;
    const N = 300;
    const bot = new HeuristicBot('e', profile, Math.random);
    for (let i = 0; i < N; i++) {
      const a = bot.selectAction(stateWithPot(100), FACING_BET, 'me', 0.9);
      if (a.type !== intended) deviations++;
    }
    expect(deviations / N).toBeGreaterThan(0.25);
  });
});

describe('style: tightness (calling station vs nit)', () => {
  it('the calling station continues materially more often than the nit in a matched spot', () => {
    // potOdds = 50/150 ≈ 0.333; equity 0.24 → clearly behind by ~0.09 (> margin)
    const N = 400;
    const countContinue = (profileKey: string) => {
      const bot = makeBot(profileKey, profileKey, Math.random);
      let cont = 0;
      for (let i = 0; i < N; i++) {
        const a = bot.selectAction(stateWithPot(100), FACING_BET, 'me', 0.24);
        if (a.type === 'CALL' || a.type === 'RAISE' || a.type === 'ALL_IN') cont++;
      }
      return cont / N;
    };
    const station = countContinue('station');
    const nit = countContinue('nit');
    expect(station).toBeGreaterThan(nit + 0.2);
  });
});

describe('sizing jitter stays within legal bounds', () => {
  it('every bet/raise amount is within [min,max]; all-in only at/above max', () => {
    const bot = makeBot('maniac', 'm', Math.random); // wide sizing band incl. >pot
    for (let i = 0; i < 300; i++) {
      const a = bot.selectAction(stateWithPot(200), FACING_BET, 'me', 0.8);
      if (a.type === 'RAISE') {
        expect(a.amount).toBeGreaterThanOrEqual(100);
        expect(a.amount).toBeLessThanOrEqual(1000);
      }
    }
  });

  it('produces varied sizes across trials (jitter is active)', () => {
    const bot = makeBot('maniac', 'm', Math.random);
    const sizes = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const a = bot.selectAction(stateWithPot(200), CHECK_LINE, 'me', 0.8);
      if (a.type === 'BET') sizes.add(a.amount);
    }
    expect(sizes.size).toBeGreaterThan(1);
  });
});

describe('information hygiene', () => {
  it('never reads opponents\' hole cards (identical decision regardless of their cards)', () => {
    const aces: readonly [Card, Card] = [{ rank: 'A', suit: 's' }, { rank: 'A', suit: 'h' }];
    const deuces: readonly [Card, Card] = [{ rank: '2', suit: 's' }, { rank: '2', suit: 'h' }];
    const stateA = stateWithPot(100, [{ id: 'me' }, { id: 'opp', holeCards: aces }]);
    const stateB = stateWithPot(100, [{ id: 'me' }, { id: 'opp', holeCards: deuces }]);

    // Same seed ⇒ identical rng draws; if the bot ignored opp cards, action matches.
    for (let seed = 1; seed <= 10; seed++) {
      const botA = new HeuristicBot('a', BOT_PROFILES.maniac!, seeded(seed));
      const botB = new HeuristicBot('b', BOT_PROFILES.maniac!, seeded(seed));
      const a = botA.selectAction(stateA, FACING_BET, 'me', 0.5);
      const b = botB.selectAction(stateB, FACING_BET, 'me', 0.5);
      expect({ type: a.type, amount: (a as { amount?: number }).amount })
        .toEqual({ type: b.type, amount: (b as { amount?: number }).amount });
    }
  });
});

describe('profiles are well-formed', () => {
  it('all presets exist with sane ranges', () => {
    for (const key of ['nit', 'station', 'maniac', 'tag']) {
      const p = BOT_PROFILES[key]!;
      expect(p.epsilon).toBeGreaterThanOrEqual(0);
      expect(p.epsilon).toBeLessThanOrEqual(1);
      expect(p.sizingMax).toBeGreaterThanOrEqual(p.sizingMin);
    }
  });
});
