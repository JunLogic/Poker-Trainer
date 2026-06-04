import {
  aggregateStrategyWeaknesses,
  summarizeStrategyPerformance,
} from '@poker/engine';
import type { StrategyVerdict } from '@poker/engine';

interface Props {
  verdicts: readonly StrategyVerdict[];
  compact?: boolean;
}

const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'] as const;

export function StrategyWeaknessDashboard({ verdicts, compact = false }: Props) {
  if (verdicts.length === 0) return null;

  const summary = summarizeStrategyPerformance(verdicts);
  const weaknesses = aggregateStrategyWeaknesses(verdicts, compact ? 3 : 5);
  const streetEntries = STREET_ORDER
    .map(street => [street, summary.streetAccuracy[street]] as const)
    .filter((entry): entry is readonly [typeof STREET_ORDER[number], number] => entry[1] !== undefined);
  const positionEntries = Object.entries(summary.positionAccuracy).slice(0, 4);

  return (
    <div className={compact ? undefined : 'panel'} style={{
      marginTop: compact ? 8 : 12,
      padding: compact ? '10px 12px' : undefined,
      background: compact ? 'rgba(255,255,255,0.04)' : undefined,
      border: compact ? '1px solid rgba(255,255,255,0.1)' : undefined,
      borderRadius: compact ? 8 : undefined,
    }}>
      <div style={{
        fontSize: '0.78rem',
        color: 'var(--color-text-dim)',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        fontWeight: 700,
        marginBottom: 8,
      }}>
        Strategy Dashboard
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, fontSize: '0.76rem' }}>
        <Metric label="Accuracy" value={summary.overallAccuracy === null ? '--' : `${Math.round(summary.overallAccuracy * 100)}%`} />
        <Metric label="Covered" value={String(summary.coveredCount)} />
        <Metric label="Uncovered" value={String(summary.uncoveredCount)} />
      </div>

      {streetEntries.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {streetEntries.map(([street, accuracy]) => (
            <span key={street} style={pillStyle()}>
              {street} {Math.round(accuracy * 100)}%
            </span>
          ))}
        </div>
      )}

      {positionEntries.length > 0 && !compact && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {positionEntries.map(([position, accuracy]) => (
            <span key={position} style={pillStyle()}>
              {position} {Math.round(accuracy * 100)}%
            </span>
          ))}
        </div>
      )}

      {weaknesses.length > 0 && (
        <div style={{ display: 'grid', gap: 7 }}>
          {weaknesses.map(entry => (
            <div key={entry.tag} style={{ fontSize: '0.78rem', lineHeight: 1.35 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{entry.label}</span>
                <span style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-mono)' }}>{entry.count}</span>
              </div>
              <div style={{ color: 'var(--color-text-dim)' }}>{entry.suggestedFocus}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      border: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 6,
      padding: '3px 7px',
      background: 'rgba(255,255,255,0.05)',
    }}>
      <span style={{ color: 'var(--color-text-dim)' }}>{label}</span>
      <span style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </span>
  );
}

function pillStyle() {
  return {
    border: '1px solid rgba(212,168,67,0.28)',
    borderRadius: 6,
    padding: '2px 7px',
    color: 'var(--color-text-dim)',
    background: 'rgba(212,168,67,0.06)',
    fontSize: '0.72rem',
    textTransform: 'capitalize' as const,
  };
}
