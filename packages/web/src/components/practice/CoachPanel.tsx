import type { CoachAnalysis } from '@poker/engine';

interface Props {
  analysis: CoachAnalysis | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  good: 'var(--color-call)',
  neutral: 'var(--color-text-dim)',
  suboptimal: 'var(--color-gold)',
  mistake: 'var(--color-fold)',
};

const SEVERITY_ICONS: Record<string, string> = {
  good: '✓',
  neutral: '→',
  suboptimal: '⚠',
  mistake: '✗',
};

export function CoachPanel({ analysis }: Props) {
  if (!analysis) return null;

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${SEVERITY_COLORS[analysis.severity]}`,
      borderRadius: 8,
      padding: '10px 14px',
      marginTop: 12,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: '1.1rem', color: SEVERITY_COLORS[analysis.severity] }}>
        {SEVERITY_ICONS[analysis.severity]}
      </span>
      <div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{analysis.hint}</div>
        {analysis.suggestedAction && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: 4 }}>
            Suggested: {analysis.suggestedAction.type}
          </div>
        )}
      </div>
    </div>
  );
}
