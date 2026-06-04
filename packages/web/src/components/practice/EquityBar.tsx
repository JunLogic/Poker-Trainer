import type { Player } from '@poker/engine';

interface Props {
  players: readonly Player[];
  equities: readonly number[];
  isComputing: boolean;
}

// Calm, desaturated per-player palette (no neon).
const COLORS = [
  '#6379c2', '#5d9e74', '#c66b6b', '#8a7bc0',
  '#c79a55', '#5f8bbf', '#7f8aa0', '#b08a6b',
];

export function EquityBar({ players, equities, isComputing }: Props) {
  const active = players.filter(p => p.status !== 'folded');

  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{
        display: 'flex', height: 24, borderRadius: 'var(--radius-sm)', overflow: 'hidden',
        background: 'var(--bg-inset)',
        opacity: isComputing ? 0.6 : 1,
        transition: 'opacity var(--dur) var(--ease-out)',
      }}>
        {active.map((player, i) => {
          const idx = players.indexOf(player);
          const eq = equities[idx] ?? 1 / active.length;
          return (
            <div
              key={player.id}
              className="tnum"
              style={{
                width: `${eq * 100}%`,
                background: COLORS[i % COLORS.length],
                transition: 'width var(--dur-slow) var(--ease-out)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', fontSize: 'var(--text-xs)', fontWeight: 600, color: '#fff',
                minWidth: eq > 0.08 ? undefined : 0,
              }}
            >
              {eq > 0.08 ? `${(eq * 100).toFixed(0)}%` : ''}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 6, flexWrap: 'wrap' }}>
        {active.map((player, i) => {
          const idx = players.indexOf(player);
          const eq = equities[idx] ?? 0;
          return (
            <span key={player.id} className="tnum" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
              {player.name}: {(eq * 100).toFixed(1)}%
            </span>
          );
        })}
        {isComputing && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>computing…</span>}
      </div>
    </div>
  );
}
