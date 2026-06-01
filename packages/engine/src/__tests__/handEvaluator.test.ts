import { describe, it, expect } from 'vitest';
import { evaluateHand, compareHandRanks } from '../handEvaluator.js';
import type { Card } from '../types.js';

function c(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

describe('evaluateHand — hand category detection', () => {
  it('detects straight flush', () => {
    const cards = [c('9', 'h'), c('T', 'h'), c('J', 'h'), c('Q', 'h'), c('K', 'h'), c('2', 'c'), c('3', 'd')];
    expect(evaluateHand(cards).category).toBe('straight-flush');
  });

  it('detects four of a kind', () => {
    const cards = [c('A', 'c'), c('A', 'd'), c('A', 'h'), c('A', 's'), c('K', 'c'), c('2', 'h'), c('3', 's')];
    expect(evaluateHand(cards).category).toBe('four-of-a-kind');
  });

  it('detects full house', () => {
    const cards = [c('K', 'c'), c('K', 'd'), c('K', 'h'), c('Q', 's'), c('Q', 'c'), c('2', 'h'), c('3', 'd')];
    expect(evaluateHand(cards).category).toBe('full-house');
  });

  it('detects flush', () => {
    const cards = [c('2', 'h'), c('5', 'h'), c('7', 'h'), c('J', 'h'), c('A', 'h'), c('K', 's'), c('3', 'd')];
    expect(evaluateHand(cards).category).toBe('flush');
  });

  it('detects straight', () => {
    const cards = [c('7', 'c'), c('8', 'd'), c('9', 'h'), c('T', 's'), c('J', 'c'), c('2', 'd'), c('A', 's')];
    expect(evaluateHand(cards).category).toBe('straight');
  });

  it('detects wheel straight (A-5)', () => {
    const cards = [c('A', 'c'), c('2', 'd'), c('3', 'h'), c('4', 's'), c('5', 'c'), c('K', 'd'), c('Q', 's')];
    const hand = evaluateHand(cards);
    expect(hand.category).toBe('straight');
    expect(hand.tiebreaker[0]).toBe(5); // wheel high card is 5
  });

  it('detects three of a kind', () => {
    const cards = [c('Q', 'c'), c('Q', 'd'), c('Q', 'h'), c('2', 's'), c('3', 'c'), c('5', 'd'), c('7', 's')];
    expect(evaluateHand(cards).category).toBe('three-of-a-kind');
  });

  it('detects two pair', () => {
    const cards = [c('J', 'c'), c('J', 'd'), c('9', 'h'), c('9', 's'), c('A', 'c'), c('2', 'd'), c('3', 's')];
    expect(evaluateHand(cards).category).toBe('two-pair');
  });

  it('detects pair', () => {
    const cards = [c('T', 'c'), c('T', 'd'), c('2', 'h'), c('3', 's'), c('5', 'c'), c('7', 'd'), c('8', 's')];
    expect(evaluateHand(cards).category).toBe('pair');
  });

  it('detects high card', () => {
    const cards = [c('2', 'c'), c('4', 'd'), c('6', 'h'), c('8', 's'), c('T', 'c'), c('Q', 'd'), c('A', 's')];
    expect(evaluateHand(cards).category).toBe('high-card');
  });
});

describe('compareHandRanks', () => {
  it('flush beats straight', () => {
    const flush = evaluateHand([c('2', 'h'), c('5', 'h'), c('7', 'h'), c('J', 'h'), c('A', 'h'), c('K', 's'), c('3', 'd')]);
    const straight = evaluateHand([c('7', 'c'), c('8', 'd'), c('9', 'h'), c('T', 's'), c('J', 'c'), c('2', 'd'), c('A', 's')]);
    expect(compareHandRanks(flush, straight)).toBeGreaterThan(0);
  });

  it('higher pair beats lower pair', () => {
    const aaPair = evaluateHand([c('A', 'c'), c('A', 'd'), c('2', 'h'), c('3', 's'), c('5', 'c'), c('7', 'd'), c('8', 's')]);
    const kkPair = evaluateHand([c('K', 'c'), c('K', 'd'), c('2', 'h'), c('3', 's'), c('5', 'c'), c('7', 'd'), c('8', 's')]);
    expect(compareHandRanks(aaPair, kkPair)).toBeGreaterThan(0);
  });

  it('returns 0 for identical hands', () => {
    const cards = [c('A', 'c'), c('A', 'd'), c('K', 'h'), c('Q', 's'), c('J', 'c'), c('2', 'd'), c('3', 's')];
    const h1 = evaluateHand(cards);
    const h2 = evaluateHand(cards);
    expect(compareHandRanks(h1, h2)).toBe(0);
  });
});

describe('evaluateHand — kicker resolution', () => {
  it('higher kicker wins pair vs pair with same pair rank', () => {
    // Both have a pair of Tens; first has A kicker, second has K kicker
    const highKicker = evaluateHand([
      c('T', 'c'), c('T', 'd'), c('A', 'h'), c('3', 's'), c('2', 'c'), c('4', 'd'), c('5', 's'),
    ]);
    const lowKicker = evaluateHand([
      c('T', 'c'), c('T', 'd'), c('K', 'h'), c('3', 's'), c('2', 'c'), c('4', 'd'), c('5', 's'),
    ]);
    expect(compareHandRanks(highKicker, lowKicker)).toBeGreaterThan(0);
  });
});
