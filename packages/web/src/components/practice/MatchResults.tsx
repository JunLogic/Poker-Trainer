import { Trophy24Filled, ArrowDownload20Regular } from '@fluentui/react-icons';
import type { MatchState, PlayerId } from '@poker/engine';
import { computeAllStats, handsForMatch } from '@poker/engine';
import { useMatchStore } from '../../store/matchStore.js';
import { useGameStore } from '../../store/gameStore.js';
import { useHistoryStore } from '../../store/historyStore.js';
import { StatsPanel } from './StatsPanel.js';
import { exportMatchToFile } from '../../export/exportMatch.js';

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
      <div className="panel" style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
        <div className="eyebrow">Match complete</div>
        <h1 style={{ margin: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)' }}>
          {heroWon && <Trophy24Filled style={{ color: 'var(--caution)' }} />}
          {heroWon ? 'You win!' : `${nameOf(match.winnerId ?? '')} wins`}
        </h1>
        <div className="tnum" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {match.handNumber} hand{match.handNumber !== 1 ? 's' : ''} played
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
          Final standings
        </div>
        {standings.map((id, i) => (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 'var(--text-base)' }}>
            <span className="tnum" style={{ width: 24, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{i + 1}</span>
            <span style={{ fontWeight: id === heroId ? 600 : 400, color: id === heroId ? 'var(--accent-strong)' : 'var(--text-primary)' }}>
              {nameOf(id)}
            </span>
            {i === 0 && <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--success)' }}>winner</span>}
          </div>
        ))}
      </div>

      {stats.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <StatsPanel stats={stats} heroId={heroId} title={`Match stats · ${matchHands.length} hands`} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          className="btn-ghost"
          style={{ flex: 1, padding: 'var(--space-3)' }}
          onClick={() => { void exportMatchToFile(match, allHands, heroId); }}
        >
          <ArrowDownload20Regular /> Export JSON
        </button>
        <button className="btn-primary" style={{ flex: 1, padding: 'var(--space-3)' }} onClick={newMatch}>
          New Match
        </button>
      </div>
    </div>
  );
}
