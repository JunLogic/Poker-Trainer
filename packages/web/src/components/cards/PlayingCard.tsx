import type { Card } from '@poker/engine';

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS: Record<string, string> = {
  h: '#d32f2f', d: '#d32f2f', c: '#212121', s: '#212121',
};

const SIZES = {
  xs: { w: 28, h: 40, corner: 8,  center: 14 },
  sm: { w: 36, h: 52, corner: 10, center: 19 },
  md: { w: 48, h: 68, corner: 12, center: 26 },
  lg: { w: 60, h: 84, corner: 14, center: 32 },
} as const;

type CardSize = keyof typeof SIZES;

interface Props {
  card: Card;
  faceDown?: boolean;
  size?: CardSize;
}

export function PlayingCard({ card, faceDown = false, size = 'md' }: Props) {
  const { w, h, corner, center } = SIZES[size];
  const sym = SUIT_SYMBOLS[card.suit] ?? '';
  const color = SUIT_COLORS[card.suit] ?? '#212121';

  if (faceDown) {
    return (
      <div style={{
        width: w, height: h, borderRadius: 5, flexShrink: 0,
        background: 'repeating-linear-gradient(135deg, #1565C0 0px, #1565C0 4px, #0D47A1 4px, #0D47A1 8px)',
        border: '2px solid #0a3a7a',
        boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
      }} />
    );
  }

  return (
    <div style={{
      position: 'relative', width: w, height: h, borderRadius: 5,
      background: '#fafaf8',
      border: '1px solid #cdc8b0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      flexShrink: 0, userSelect: 'none',
    }}>
      {/* Top-left: rank + suit stacked */}
      <div style={{
        position: 'absolute', top: 3, left: 3,
        color, lineHeight: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <span style={{ fontSize: corner, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
          {card.rank}
        </span>
        <span style={{ fontSize: corner - 1 }}>{sym}</span>
      </div>

      {/* Center suit glyph */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize: center, opacity: 0.80,
        pointerEvents: 'none',
      }}>
        {sym}
      </div>

      {/* Bottom-right: mirrored (rotated 180°) */}
      <div style={{
        position: 'absolute', bottom: 3, right: 3,
        color, lineHeight: 1, transform: 'rotate(180deg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <span style={{ fontSize: corner, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
          {card.rank}
        </span>
        <span style={{ fontSize: corner - 1 }}>{sym}</span>
      </div>
    </div>
  );
}
