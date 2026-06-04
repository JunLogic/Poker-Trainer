import type { Player } from '@poker/engine';
import { ChipDisplay } from './ChipDisplay.js';
import { SUIT_SYMBOLS, suitInk } from '../cards/suits.js';

interface Props {
  player: Player;
  isActive: boolean;
  isDealer: boolean;
  showCards?: boolean;
}

const STATUS_COLOR: Record<Player['status'], string> = {
  active: 'var(--success)',
  allin: 'var(--allin)',
  folded: 'var(--text-faint)',
  'sitting-out': 'var(--text-faint)',
};

export function PlayerSeat({ player, isActive, isDealer, showCards }: Props) {
  const isFolded = player.status === 'folded';
  return (
    <div style={{
      background: isActive ? 'var(--accent-soft)' : 'var(--bg-raised)',
      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-2) var(--space-3)',
      minWidth: 116,
      opacity: isFolded ? 0.55 : 1,
      position: 'relative',
      transition: 'border-color var(--dur) var(--ease-out), background var(--dur) var(--ease-out)',
    }}>
      {isDealer && (
        <span style={{
          position: 'absolute', top: -8, right: -8,
          background: 'var(--accent)', color: 'var(--text-on-accent)',
          borderRadius: '50%', width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.62rem', fontWeight: 700,
          boxShadow: 'var(--shadow-sm)',
        }}>D</span>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {player.name}
        </span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[player.status] }} />
      </div>
      <div style={{ fontSize: 'var(--text-sm)', marginBottom: 2, color: 'var(--text-secondary)' }}>
        Stack <ChipDisplay amount={player.stack} />
      </div>
      {player.betThisStreet > 0 && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          Bet <ChipDisplay amount={player.betThisStreet} />
        </div>
      )}
      {showCards && player.holeCards && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {player.holeCards.map((card, i) => (
            <span key={i} style={{
              background: 'var(--card-face)',
              color: suitInk(card.suit),
              borderRadius: 'var(--radius-xs)',
              padding: '2px 6px',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              border: '1px solid var(--card-face-edge)',
            }}>
              {card.rank}{SUIT_SYMBOLS[card.suit]}
            </span>
          ))}
        </div>
      )}
      {isFolded && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.04em' }}>FOLDED</div>
      )}
      {player.status === 'allin' && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--allin)', marginTop: 4, fontWeight: 600, letterSpacing: '0.04em' }}>ALL IN</div>
      )}
    </div>
  );
}
