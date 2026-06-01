import { describe, it, expect } from 'vitest';
import { estimateEquity } from '../monteCarlo.js';
import type { Card } from '../types.js';

function c(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

describe('estimateEquity', () => {
  it('AA vs KK preflop: AA wins ~80% of the time', () => {
    const aa: [Card, Card] = [c('A', 'c'), c('A', 'd')];
    const kk: [Card, Card] = [c('K', 'c'), c('K', 'd')];
    const equities = estimateEquity([aa, kk], [], 5000, [], 42);
    expect(equities[0]).toBeGreaterThan(0.78);
    expect(equities[0]).toBeLessThan(0.90);
  });

  it('equities sum to 1.0 within floating-point tolerance', () => {
    const aa: [Card, Card] = [c('A', 'h'), c('A', 's')];
    const kk: [Card, Card] = [c('K', 'h'), c('K', 's')];
    const equities = estimateEquity([aa, kk], [], 1000, [], 99);
    const sum = equities.reduce((s, e) => s + e, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('nut flush draw on flop gets reasonable equity', () => {
    // 9h Th on board Jh Qh 2c — straight flush draw + pair prospects
    const hero: [Card, Card] = [c('9', 'h'), c('T', 'h')];
    const villain: [Card, Card] = [c('A', 'c'), c('A', 'd')];
    const board = [c('J', 'h'), c('Q', 'h'), c('2', 'c')];
    const equities = estimateEquity([hero, villain], board, 2000, [], 7);
    // Hero has strong draw; should have meaningful equity
    expect(equities[0]).toBeGreaterThan(0.35);
  });

  it('handles three players — equities sum to 1', () => {
    const p1: [Card, Card] = [c('A', 'c'), c('K', 'd')];
    const p2: [Card, Card] = [c('Q', 'h'), c('J', 's')];
    const p3: [Card, Card] = [c('T', 'c'), c('9', 'd')];
    const equities = estimateEquity([p1, p2, p3], [], 2000, [], 13);
    const sum = equities.reduce((s, e) => s + e, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('deterministic results with same seed', () => {
    const aa: [Card, Card] = [c('A', 'c'), c('A', 'd')];
    const kk: [Card, Card] = [c('K', 'c'), c('K', 'd')];
    const eq1 = estimateEquity([aa, kk], [], 200, [], 42);
    const eq2 = estimateEquity([aa, kk], [], 200, [], 42);
    expect(eq1[0]).toBeCloseTo(eq2[0]!, 10);
  });
});
