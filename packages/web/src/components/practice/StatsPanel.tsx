import type { PlayerStats, PlayerId } from '@poker/engine';

interface Props {
  stats: readonly PlayerStats[];
  heroId: PlayerId;
  title?: string;
}

function pct(x: number): string { return `${(x * 100).toFixed(0)}%`; }

export function StatsPanel({ stats, heroId, title = 'Session stats' }: Props) {
  if (stats.length === 0) return null;
  const cell: React.CSSProperties = { padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontVariantNumeric: 'tabular-nums' };
  const head: React.CSSProperties = { padding: '4px 8px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' };

  return (
    <div className="panel">
      <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left' }}>Player</th>
            <th style={head}>Hands</th>
            <th style={head} title="Voluntarily put $ in pot preflop">VPIP</th>
            <th style={head} title="Preflop raise">PFR</th>
            <th style={head} title="(bets+raises+all-ins) / calls">AF</th>
            <th style={head}>Net</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.playerId} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <td style={{ padding: '4px 8px', textAlign: 'left', fontWeight: s.playerId === heroId ? 600 : 400, color: s.playerId === heroId ? 'var(--accent-strong)' : 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                {s.name}
              </td>
              <td style={cell}>{s.handsPlayed}</td>
              <td style={cell}>{pct(s.vpip)}</td>
              <td style={cell}>{pct(s.pfr)}</td>
              <td style={cell}>{s.aggressionFactor.toFixed(1)}</td>
              <td style={{ ...cell, color: s.net > 0 ? 'var(--success)' : s.net < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                {s.net > 0 ? `+${s.net}` : s.net}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
