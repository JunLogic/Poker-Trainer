import type { StrategyAdvice } from '@poker/engine';

interface Props {
  advice: StrategyAdvice | null;
}

export function StrategyAdvicePanel({ advice }: Props) {
  if (!advice) return null;

  return (
    <div style={{
      border: '1px solid rgba(212,168,67,0.28)',
      background: 'rgba(212,168,67,0.07)',
      borderRadius: 8,
      padding: '9px 11px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{
          fontSize: '0.72rem',
          color: 'var(--color-gold)',
          textTransform: 'uppercase',
          letterSpacing: 0.7,
          fontWeight: 700,
        }}>
          Pre-action advice
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-dim)' }}>
          {advice.profileName} · {advice.difficulty}
        </span>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--color-text)', lineHeight: 1.45 }}>
        {advice.advice}
      </div>
      <div style={{ marginTop: 5, fontSize: '0.74rem', color: 'var(--color-text-dim)' }}>
        Concept: {advice.conceptTrained}
      </div>
    </div>
  );
}
