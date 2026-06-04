import type { Player } from '@poker/engine';
import { PlayingCard } from '../cards/PlayingCard.js';
import { ChipDisplay } from '../common/ChipDisplay.js';

interface Props {
  player: Player;
  isActive: boolean;
  isDealer: boolean;
  showCards: boolean;
  isHero?: boolean;
}

const STATUS_BADGE: Record<Player['status'], { label: string; color: string } | null> = {
  active: null,
  allin: { label: 'ALL IN', color: 'var(--allin)' },
  folded: { label: 'FOLDED', color: 'var(--text-muted)' },
  'sitting-out': { label: 'AWAY', color: 'var(--text-faint)' },
};

export function SeatCard({ player, isActive, isDealer, showCards, isHero = false }: Props) {
  const badge = STATUS_BADGE[player.status];
  const cardSize = isHero ? 'lg' : 'sm';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      opacity: player.status === 'folded' ? 0.45 : 1,
      position: 'relative',
    }}>
      {/* Dealer button */}
      {isDealer && (
        <div style={{
          position: 'absolute', top: -4, right: -4, zIndex: 2,
          width: 20, height: 20, borderRadius: '50%',
          background: 'var(--accent)', color: 'var(--text-on-accent)',
          fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}>D</div>
      )}

      {/* Hole cards */}
      <div style={{ display: 'flex', gap: isHero ? 6 : 4 }}>
        {player.holeCards
          ? player.holeCards.map((card, i) => (
            <PlayingCard key={i} card={card} faceDown={!showCards} size={cardSize} />
          ))
          : [0, 1].map(i => (
            <PlayingCard key={i} card={{ rank: '2', suit: 'c' }} faceDown size={cardSize} />
          ))
        }
      </div>

      {/* Info box */}
      <div style={{
        background: isActive ? 'var(--accent-soft)' : 'var(--bg-raised)',
        border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: isActive ? '0 0 0 3px var(--accent-softer)' : 'none',
        borderRadius: 'var(--radius-md)', padding: '5px 10px', textAlign: 'center',
        minWidth: isHero ? 112 : 92,
        transition: 'border-color var(--dur) var(--ease-out), background var(--dur) var(--ease-out), box-shadow var(--dur) var(--ease-out)',
      }}>
        <div style={{
          fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 2,
          color: isHero ? 'var(--accent-strong)' : 'var(--text-primary)',
        }}>
          {player.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <ChipDisplay amount={player.stack} />
        </div>
        {player.betThisStreet > 0 && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>
            bet <ChipDisplay amount={player.betThisStreet} />
          </div>
        )}
        {badge && (
          <div style={{ fontSize: 'var(--text-xs)', color: badge.color, fontWeight: 600, marginTop: 2, letterSpacing: '0.04em' }}>
            {badge.label}
          </div>
        )}
      </div>
    </div>
  );
}
