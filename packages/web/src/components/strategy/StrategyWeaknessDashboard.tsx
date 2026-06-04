import { DataTrending20Regular } from '@fluentui/react-icons';
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
      padding: compact ? 'var(--space-3)' : undefined,
      background: compact ? 'var(--bg-raised)' : undefined,
      border: compact ? '1px solid var(--border-subtle)' : undefined,
      borderRadius: compact ? 'var(--radius-md)' : undefined,
    }}>
      <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2)' }}>
        <DataTrending20Regular style={{ fontSize: 16 }} /> Strategy Dashboard
      </div>

      <div className="tnum" style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
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
        <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
          {weaknesses.map(entry => (
            <div key={entry.tag} style={{ fontSize: 'var(--text-sm)', lineHeight: 1.4 }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{entry.label}</span>
                <span className="tnum" style={{ color: 'var(--caution)', fontFamily: 'var(--font-mono)' }}>{entry.count}</span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>{entry.suggestedFocus}</div>
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
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '3px 8px',
      background: 'var(--bg-surface)',
    }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </span>
  );
}

function pillStyle() {
  return {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-pill)',
    padding: '2px 9px',
    color: 'var(--text-secondary)',
    background: 'var(--accent-softer)',
    fontSize: 'var(--text-xs)',
    textTransform: 'capitalize' as const,
  };
}
