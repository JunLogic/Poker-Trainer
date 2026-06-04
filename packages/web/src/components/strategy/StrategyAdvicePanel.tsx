import { Lightbulb20Filled } from '@fluentui/react-icons';
import type { StrategyAdvice } from '@poker/engine';

interface Props {
  advice: StrategyAdvice | null;
}

export function StrategyAdvicePanel({ advice }: Props) {
  if (!advice) return null;

  return (
    <div style={{
      border: '1px solid var(--border)',
      background: 'var(--accent-softer)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-3)',
      marginBottom: 'var(--space-3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 'var(--text-xs)',
          color: 'var(--accent-strong)',
          textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-wide)',
          fontWeight: 600,
        }}>
          <Lightbulb20Filled style={{ fontSize: 16 }} /> Pre-action advice
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {advice.profileName} · {advice.difficulty}
        </span>
      </div>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 'var(--leading-normal)' }}>
        {advice.advice}
      </div>
      <div style={{ marginTop: 5, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        Concept: {advice.conceptTrained}
      </div>
    </div>
  );
}
