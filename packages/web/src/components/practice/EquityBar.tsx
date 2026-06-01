import type { Player } from '@poker/engine';

interface Props {
  players: readonly Player[];
  equities: readonly number[];
  isComputing: boolean;
}

const COLORS = [
  '#2980b9', '#27ae60', '#c0392b', '#8e44ad',
  '#d35400', '#16a085', '#2c3e50', '#f39c12',
];

export function EquityBar({ players, equities, isComputing }: Props) {
  const active = players.filter(p => p.status !== 'folded');

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', height: 24, borderRadius: 6, overflow: 'hidden',
        background: 'rgba(0,0,0,0.3)',
        opacity: isComputing ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}>
        {active.map((player, i) => {
          const idx = players.indexOf(player);
          const eq = equities[idx] ?? 1 / active.length;
          return (
            <div
              key={player.id}
              style={{
                width: `${eq * 100}%`,
                background: COLORS[i % COLORS.length],
                transition: 'width 0.4s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', fontSize: '0.7rem', fontWeight: 700, color: '#fff',
                minWidth: eq > 0.08 ? undefined : 0,
              }}
            >
              {eq > 0.08 ? `${(eq * 100).toFixed(0)}%` : ''}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
        {active.map((player, i) => {
          const idx = players.indexOf(player);
          const eq = equities[idx] ?? 0;
          return (
            <span key={player.id} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
              {player.name}: {(eq * 100).toFixed(1)}%
            </span>
          );
        })}
        {isComputing && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>computing…</span>}
      </div>
    </div>
  );
}
