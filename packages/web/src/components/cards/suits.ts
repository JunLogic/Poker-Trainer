import type { Suit } from '@poker/engine';

/** Pip glyphs for each suit. */
export const SUIT_SYMBOLS: Record<Suit, string> = {
  h: '♥', d: '♦', c: '♣', s: '♠',
};

/**
 * Suit ink color token.
 * - 2-color deck (default): red for hearts/diamonds, near-black for spades/clubs.
 * - 4-color deck: hearts red, diamonds blue, clubs green, spades black.
 * Returns a CSS `var(--token)` so it tracks the theme.
 */
export function suitInk(suit: Suit, fourColor = false): string {
  if (fourColor) {
    switch (suit) {
      case 'h': return 'var(--suit-heart-4)';
      case 'd': return 'var(--suit-diamond-4)';
      case 'c': return 'var(--suit-club-4)';
      case 's': return 'var(--suit-spade-4)';
    }
  }
  return suit === 'h' || suit === 'd' ? 'var(--card-ink-red)' : 'var(--card-ink)';
}
