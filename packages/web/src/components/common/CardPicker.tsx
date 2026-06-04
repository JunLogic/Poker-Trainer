import type { Card } from '@poker/engine';
import { RANKS, SUITS } from '@poker/engine';
import { SUIT_SYMBOLS, suitInk } from '../cards/suits.js';

interface Props {
  usedCards: readonly Card[];
  selected?: Card | null;
  onSelect: (card: Card) => void;
}

function isUsed(card: Card, used: readonly Card[]): boolean {
  return used.some(u => u.rank === card.rank && u.suit === card.suit);
}

export function CardPicker({ usedCards, selected, onSelect }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(13, 1fr)',
      gap: 4,
      background: 'var(--bg-inset)',
      padding: 'var(--space-2)',
      borderRadius: 'var(--radius-md)',
    }}>
      {SUITS.map(suit =>
        RANKS.map(rank => {
          const card: Card = { rank, suit };
          const used = isUsed(card, usedCards);
          const sel = selected?.rank === rank && selected?.suit === suit;
          return (
            <button
              key={`${rank}${suit}`}
              onClick={() => !used && onSelect(card)}
              disabled={used}
              style={{
                width: 32,
                height: 44,
                padding: 0,
                background: 'var(--card-face)',
                color: suitInk(suit),
                border: sel ? '1.5px solid var(--accent)' : '1px solid var(--card-face-edge)',
                boxShadow: sel ? '0 0 0 3px var(--accent-soft)' : 'none',
                borderRadius: 'var(--radius-xs)',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                opacity: used ? 0.28 : 1,
                cursor: used ? 'not-allowed' : 'pointer',
                transition: 'border-color var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out)',
              }}
            >
              <span style={{ letterSpacing: '-0.03em' }}>{rank}</span>
              <span>{SUIT_SYMBOLS[suit]}</span>
            </button>
          );
        }),
      )}
    </div>
  );
}
