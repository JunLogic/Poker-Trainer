import type { Card } from '@poker/engine';
import { RANKS, SUITS } from '@poker/engine';

interface Props {
  usedCards: readonly Card[];
  selected?: Card | null;
  onSelect: (card: Card) => void;
}

const SUIT_SYMBOLS: Record<string, string> = {
  h: '♥', d: '♦', c: '♣', s: '♠',
};
const SUIT_COLORS: Record<string, string> = {
  h: 'var(--suit-hearts)',
  d: 'var(--suit-diamonds)',
  c: 'var(--suit-clubs)',
  s: 'var(--suit-spades)',
};

function isUsed(card: Card, used: readonly Card[]): boolean {
  return used.some(u => u.rank === card.rank && u.suit === card.suit);
}

export function CardPicker({ usedCards, selected, onSelect }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(13, 1fr)',
      gap: 3,
      background: 'rgba(0,0,0,0.3)',
      padding: 8,
      borderRadius: 8,
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
                background: sel ? '#fff' : 'var(--color-card-bg)',
                color: sel ? SUIT_COLORS[suit] : used ? '#bbb' : SUIT_COLORS[suit],
                border: sel ? '2px solid var(--color-gold)' : '1px solid var(--color-card-border)',
                borderRadius: 4,
                fontSize: '0.7rem',
                fontWeight: 700,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: used ? 0.3 : 1,
                cursor: used ? 'not-allowed' : 'pointer',
              }}
            >
              <span>{rank}</span>
              <span>{SUIT_SYMBOLS[suit]}</span>
            </button>
          );
        }),
      )}
    </div>
  );
}
