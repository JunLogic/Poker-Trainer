import type { MatchState, PlayerId } from '@poker/engine';
import { computeAllStats, handsForMatch } from '@poker/engine';
import { useMatchStore } from '../../store/matchStore.js';
import { useGameStore } from '../../store/gameStore.js';
import { useHistoryStore } from '../../store/historyStore.js';
import { StatsPanel } from './StatsPanel.js';

interface Props {
  match: MatchState;
  heroId: PlayerId;
}

export function MatchResults({ match, heroId }: Props) {
  const allHands = useHistoryStore(s => s.hands);
  const matchHands = handsForMatch(allHands, match.config.matchId);
  const stats = computeAllStats(matchHands);

  const nameOf = (id: PlayerId) => match.config.players.find(p => p.id === id)?.name ?? id;
  const heroWon = match.winnerId === heroId;

  // Final standings: survivor on top, then eliminated in reverse order (last out = runner-up).
  const standings: PlayerId[] = [
    ...(match.winnerId ? [match.winnerId] : []),
    ...[...match.eliminated].reverse(),
  ];

  function newMatch() {
    useMatchStore.getState().reset();
    useGameStore.getState().resetHand();
  }

  return (
    <div style={{ maxWidth: 480, margin: '32px auto', padding: '0 16px' }}>
      <div className="panel" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Match complete
        </div>
        <h1 style={{ color: 'var(--color-gold)', margin: '8px 0' }}>
          {heroWon ? '🏆 You win!' : `${nameOf(match.winnerId ?? '')} wins`}
        </h1>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
          {match.handNumber} hand{match.handNumber !== 1 ? 's' : ''} played
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
          Final standings
        </div>
        {standings.map((id, i) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: '0.9rem' }}>
            <span style={{ width: 24, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
            <span style={{ fontWeight: id === heroId ? 700 : 400, color: id === heroId ? 'var(--color-gold)' : 'var(--color-text)' }}>
              {nameOf(id)}
            </span>
            {i === 0 && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-call)' }}>winner</span>}
          </div>
        ))}
      </div>

      {stats.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <StatsPanel stats={stats} heroId={heroId} title={`Match stats · ${matchHands.length} hands`} />
        </div>
      )}

      <button className="btn-call" style={{ width: '100%', padding: 12 }} onClick={newMatch}>
        New Match
      </button>
    </div>
  );
}
