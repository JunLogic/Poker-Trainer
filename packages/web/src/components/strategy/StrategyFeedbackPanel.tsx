import type { CSSProperties } from 'react';
import { CheckmarkCircle16Filled, DismissCircle16Filled, Circle16Regular } from '@fluentui/react-icons';
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
        padding: compact ? 'var(--space-3)' : undefined,
        background: compact ? 'var(--bg-raised)' : undefined,
        border: compact ? '1px solid var(--border-subtle)' : undefined,
        borderRadius: compact ? 'var(--radius-md)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
        <PanelTitle title="Strategy Feedback" />
        <span style={badgeStyle(verdict.covered ? 'good' : 'neutral')}>
          {verdict.covered
            ? <CheckmarkCircle16Filled style={{ fontSize: 13 }} />
            : <Circle16Regular style={{ fontSize: 13 }} />}
          {verdict.covered ? 'covered' : 'uncovered'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
          {verdict.profileName} · {verdict.difficulty}
        </span>
        {verdict.covered && (
          <span className="tnum" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>
            {verdict.score}/{verdict.maxScore}
          </span>
        )}
      </div>

      {verdict.covered && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
          <span style={badgeStyle(actionLabel.kind)}><KindIcon kind={actionLabel.kind} /> Action {actionLabel.text}</span>
          <span style={badgeStyle(sizingLabel.kind)}><KindIcon kind={sizingLabel.kind} /> Sizing {sizingLabel.text}</span>
        </div>
      )}

      <div style={{ fontSize: compact ? 'var(--text-sm)' : 'var(--text-base)', lineHeight: 'var(--leading-normal)', color: 'var(--text-secondary)' }}>
        {verdict.explanation}
      </div>

      <div style={{ display: 'grid', gap: 6, marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
        <MetaRow label="Concept" value={verdict.conceptTrained} />
        {verdict.baselineAction && <MetaRow label="Preferred" value={`${verdict.baselineAction}${verdict.baselineSizing ? ` · ${verdict.baselineSizing}` : ''}`} />}
        {verdict.violatedRule && <MetaRow label="Rule" value={verdict.violatedRule} tone="warn" />}
      </div>
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return <div className="eyebrow">{title}</div>;
}

function KindIcon({ kind }: { kind: 'good' | 'bad' | 'neutral' }) {
  const style = { fontSize: 13 } as const;
  if (kind === 'good') return <CheckmarkCircle16Filled style={style} />;
  if (kind === 'bad') return <DismissCircle16Filled style={style} />;
  return <Circle16Regular style={style} />;
}

function MetaRow({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 'var(--space-2)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: tone === 'warn' ? 'var(--danger)' : 'var(--text-secondary)' }}>{value}</span>
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
    ? 'var(--success)'
    : kind === 'bad'
      ? 'var(--danger)'
      : 'var(--text-muted)';
  const background = kind === 'good'
    ? 'var(--green-soft)'
    : kind === 'bad'
      ? 'var(--red-soft)'
      : 'var(--bg-raised)';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    border: `1px solid ${kind === 'neutral' ? 'var(--border)' : color}`,
    color,
    background,
    borderRadius: 'var(--radius-sm)',
    padding: '2px 8px',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };
}
