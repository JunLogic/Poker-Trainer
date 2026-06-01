import type { PlayerStats, PlayerId } from '@poker/engine';

interface Props {
  stats: readonly PlayerStats[];
  heroId: PlayerId;
  title?: string;
}

function pct(x: number): string { return `${(x * 100).toFixed(0)}%`; }

export function StatsPanel({ stats, heroId, title = 'Session stats' }: Props) {
  if (stats.length === 0) return null;
  const cell: React.CSSProperties = { padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' };
  const head: React.CSSProperties = { padding: '4px 8px', textAlign: 'right', fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 };

  return (
    <div className="panel">
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
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
            <tr key={s.playerId} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <td style={{ padding: '4px 8px', textAlign: 'left', fontWeight: s.playerId === heroId ? 700 : 400, color: s.playerId === heroId ? 'var(--color-gold)' : 'var(--color-text)', fontSize: '0.82rem' }}>
                {s.name}
              </td>
              <td style={cell}>{s.handsPlayed}</td>
              <td style={cell}>{pct(s.vpip)}</td>
              <td style={cell}>{pct(s.pfr)}</td>
              <td style={cell}>{s.aggressionFactor.toFixed(1)}</td>
              <td style={{ ...cell, color: s.net > 0 ? 'var(--color-call)' : s.net < 0 ? 'var(--color-fold)' : 'var(--color-text)' }}>
                {s.net > 0 ? `+${s.net}` : s.net}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
