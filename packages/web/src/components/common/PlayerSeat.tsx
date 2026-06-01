import type { Player } from '@poker/engine';
import { ChipDisplay } from './ChipDisplay.js';

interface Props {
  player: Player;
  isActive: boolean;
  isDealer: boolean;
  showCards?: boolean;
}

const STATUS_COLOR: Record<Player['status'], string> = {
  active: 'var(--color-call)',
  allin: 'var(--color-allin)',
  folded: '#555',
  'sitting-out': '#444',
};

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS: Record<string, string> = {
  h: 'var(--suit-hearts)', d: 'var(--suit-diamonds)',
  c: 'var(--suit-clubs)', s: 'var(--suit-spades)',
};

export function PlayerSeat({ player, isActive, isDealer, showCards }: Props) {
  const isFolded = player.status === 'folded';
  return (
    <div style={{
      background: isActive ? 'rgba(212,168,67,0.15)' : 'rgba(0,0,0,0.35)',
      border: `2px solid ${isActive ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 10,
      padding: '8px 12px',
      minWidth: 110,
      opacity: isFolded ? 0.5 : 1,
      position: 'relative',
    }}>
      {isDealer && (
        <span style={{
          position: 'absolute', top: -8, right: -8,
          background: 'var(--color-gold)', color: '#1a1a1a',
          borderRadius: '50%', width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 900,
        }}>D</span>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
          {player.name}
        </span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[player.status] }} />
      </div>
      <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>
        Stack: <ChipDisplay amount={player.stack} />
      </div>
      {player.betThisStreet > 0 && (
        <div style={{ fontSize: '0.75rem' }}>
          Bet: <ChipDisplay amount={player.betThisStreet} />
        </div>
      )}
      {showCards && player.holeCards && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {player.holeCards.map((card, i) => (
            <span key={i} style={{
              background: 'var(--color-card-bg)',
              color: SUIT_COLORS[card.suit] ?? '#000',
              borderRadius: 4,
              padding: '2px 5px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: '1px solid var(--color-card-border)',
            }}>
              {card.rank}{SUIT_SYMBOLS[card.suit]}
            </span>
          ))}
        </div>
      )}
      {player.status === 'folded' && (
        <div style={{ fontSize: '0.7rem', color: '#888', marginTop: 4 }}>FOLDED</div>
      )}
      {player.status === 'allin' && (
        <div style={{ fontSize: '0.7rem', color: 'var(--color-allin)', marginTop: 4 }}>ALL IN</div>
      )}
    </div>
  );
}
