import type { Card } from '@poker/engine';
import { SUIT_SYMBOLS, suitInk } from './suits.js';

const SIZES = {
  xs: { w: 28, h: 40, corner: 9,  pip: 8,  center: 15, radius: 4 },
  sm: { w: 38, h: 54, corner: 12, pip: 10, center: 21, radius: 5 },
  md: { w: 50, h: 70, corner: 15, pip: 12, center: 27, radius: 7 },
  lg: { w: 62, h: 88, corner: 18, pip: 14, center: 34, radius: 8 },
} as const;

type CardSize = keyof typeof SIZES;

interface Props {
  card: Card;
  faceDown?: boolean;
  size?: CardSize;
  /** Use the 4-color deck (clubs green, diamonds blue). Additive; defaults off. */
  fourColor?: boolean;
  /** Emphasise as a winning / selected card. Additive; defaults off. */
  highlight?: boolean;
}

/**
 * Matte vector playing card. Crisp rank+suit typography, hairline border, soft
 * corner radius, no gloss / drop-shadow. Scales cleanly on mobile. Supports
 * face-down and highlighted (winning) states. Core API (card/faceDown/size) is
 * unchanged; `fourColor` and `highlight` are optional additions.
 */
export function PlayingCard({ card, faceDown = false, size = 'md', fourColor = false, highlight = false }: Props) {
  const { w, h, corner, pip, center, radius } = SIZES[size];

  if (faceDown) {
    return (
      <div
        aria-hidden
        style={{
          width: w, height: h, borderRadius: radius, flexShrink: 0,
          background: 'var(--accent-700)',
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 1.5px, transparent 1.5px, transparent 6px)',
          border: '1px solid var(--accent-600)',
          boxShadow: 'var(--shadow-card)',
        }}
      />
    );
  }

  const ink = suitInk(card.suit, fourColor);
  const sym = SUIT_SYMBOLS[card.suit] ?? '';

  return (
    <div
      role="img"
      aria-label={`${card.rank} of ${SUIT_NAMES[card.suit] ?? card.suit}`}
      style={{
        position: 'relative', width: w, height: h, borderRadius: radius,
        background: 'var(--card-face)',
        border: highlight ? '1.5px solid var(--success)' : '1px solid var(--card-face-edge)',
        boxShadow: highlight
          ? '0 0 0 3px var(--green-soft), var(--shadow-card)'
          : 'var(--shadow-card)',
        flexShrink: 0, userSelect: 'none',
        transition: 'box-shadow var(--dur) var(--ease-out), border-color var(--dur) var(--ease-out)',
      }}
    >
      {/* Top-left: rank over pip */}
      <div style={{
        position: 'absolute', top: radius - 1, left: radius - 1,
        color: ink, lineHeight: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <span style={{ fontSize: corner, fontWeight: 700, letterSpacing: '-0.03em' }}>{card.rank}</span>
        <span style={{ fontSize: pip, marginTop: 0.5 }}>{sym}</span>
      </div>

      {/* Center pip */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: ink, fontSize: center, opacity: 0.9,
        pointerEvents: 'none',
      }}>
        {sym}
      </div>

      {/* Bottom-right: mirrored */}
      <div style={{
        position: 'absolute', bottom: radius - 1, right: radius - 1,
        color: ink, lineHeight: 1, transform: 'rotate(180deg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <span style={{ fontSize: corner, fontWeight: 700, letterSpacing: '-0.03em' }}>{card.rank}</span>
        <span style={{ fontSize: pip, marginTop: 0.5 }}>{sym}</span>
      </div>
    </div>
  );
}

const SUIT_NAMES: Record<string, string> = { h: 'hearts', d: 'diamonds', c: 'clubs', s: 'spades' };
