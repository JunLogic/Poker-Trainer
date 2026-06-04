import type { CSSProperties } from 'react';
import type { StrategyVerdict } from '@poker/engine';

interface Props {
  verdict: StrategyVerdict | null;
  compact?: boolean;
}

export function StrategyFeedbackPanel({ verdict, compact = false }: Props) {
  if (!verdict) {
    if (compact) return null;
    return (
      <div className="panel" style={{ marginTop: 12 }}>
        <PanelTitle title="Strategy Feedback" />
        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)' }}>
          Feedback appears after each hero action.
        </div>
      </div>
    );
  }

  const actionLabel = correctnessLabel(verdict.actionCorrect);
  const sizingLabel = correctnessLabel(verdict.sizingCorrect);

  return (
    <div
      className={compact ? undefined : 'panel'}
      style={{
        marginTop: compact ? 8 : 12,
        padding: compact ? '10px 12px' : undefined,
        background: compact ? 'rgba(255,255,255,0.04)' : undefined,
        border: compact ? '1px solid rgba(255,255,255,0.1)' : undefined,
        borderRadius: compact ? 8 : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <PanelTitle title="Strategy Feedback" />
        <span style={badgeStyle(verdict.covered ? 'good' : 'neutral')}>
          {verdict.covered ? 'covered' : 'uncovered'}
        </span>
        <span style={{ color: 'var(--color-text-dim)', fontSize: '0.76rem' }}>
          {verdict.profileName} · {verdict.difficulty}
        </span>
        {verdict.covered && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--color-gold)' }}>
            {verdict.score}/{verdict.maxScore}
          </span>
        )}
      </div>

      {verdict.covered && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={badgeStyle(actionLabel.kind)}>Action {actionLabel.text}</span>
          <span style={badgeStyle(sizingLabel.kind)}>Sizing {sizingLabel.text}</span>
        </div>
      )}

      <div style={{ fontSize: compact ? '0.78rem' : '0.84rem', lineHeight: 1.5, color: 'var(--color-text)' }}>
        {verdict.explanation}
      </div>

      <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: '0.78rem' }}>
        <MetaRow label="Concept" value={verdict.conceptTrained} />
        {verdict.baselineAction && <MetaRow label="Preferred" value={`${verdict.baselineAction}${verdict.baselineSizing ? ` · ${verdict.baselineSizing}` : ''}`} />}
        {verdict.violatedRule && <MetaRow label="Rule" value={verdict.violatedRule} tone="warn" />}
      </div>
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return (
    <div style={{
      fontSize: '0.78rem',
      color: 'var(--color-text-dim)',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontWeight: 700,
    }}>
      {title}
    </div>
  );
}

function MetaRow({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 8 }}>
      <span style={{ color: 'var(--color-text-dim)' }}>{label}</span>
      <span style={{ color: tone === 'warn' ? 'var(--color-fold)' : 'var(--color-text)' }}>{value}</span>
    </div>
  );
}

function correctnessLabel(value: boolean | null): { text: string; kind: 'good' | 'bad' | 'neutral' } {
  if (value === true) return { text: 'follows', kind: 'good' };
  if (value === false) return { text: 'missed', kind: 'bad' };
  return { text: 'not scored', kind: 'neutral' };
}

function badgeStyle(kind: 'good' | 'bad' | 'neutral'): CSSProperties {
  const color = kind === 'good'
    ? 'var(--color-call)'
    : kind === 'bad'
      ? 'var(--color-fold)'
      : 'var(--color-text-dim)';
  const background = kind === 'good'
    ? 'rgba(39,174,96,0.12)'
    : kind === 'bad'
      ? 'rgba(231,76,60,0.12)'
      : 'rgba(255,255,255,0.07)';
  return {
    border: `1px solid ${color}`,
    color,
    background,
    borderRadius: 6,
    padding: '2px 7px',
    fontSize: '0.72rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  };
}
