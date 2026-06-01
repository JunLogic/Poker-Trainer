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
  allin: { label: 'ALL IN', color: '#8e44ad' },
  folded: { label: 'FOLDED', color: '#666' },
  'sitting-out': { label: 'AWAY', color: '#444' },
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
          background: 'var(--color-gold)', color: '#1a1a1a',
          fontSize: 8, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
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
        background: isActive ? 'rgba(212,168,67,0.22)' : 'rgba(0,0,0,0.6)',
        border: `2px solid ${isActive ? 'var(--color-gold)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8, padding: '5px 10px', textAlign: 'center',
        minWidth: isHero ? 110 : 90,
        backdropFilter: 'blur(4px)',
        transition: 'border-color 0.2s, background 0.2s',
      }}>
        <div style={{
          fontSize: '0.78rem', fontWeight: 700, marginBottom: 2,
          color: isHero ? 'var(--color-gold)' : 'var(--color-text)',
        }}>
          {player.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <ChipDisplay amount={player.stack} />
        </div>
        {player.betThisStreet > 0 && (
          <div style={{ fontSize: '0.68rem', color: 'var(--color-text-dim)', marginTop: 1 }}>
            bet <ChipDisplay amount={player.betThisStreet} />
          </div>
        )}
        {badge && (
          <div style={{ fontSize: '0.65rem', color: badge.color, fontWeight: 700, marginTop: 2, letterSpacing: 0.5 }}>
            {badge.label}
          </div>
        )}
      </div>
    </div>
  );
}
