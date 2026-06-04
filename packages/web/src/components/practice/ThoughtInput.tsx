interface Props {
  equity: number;
  pot: number;
  betToCall: number;
  value: string;
  onChange: (text: string) => void;
}

export function ThoughtInput({ equity, pot, betToCall, value, onChange }: Props) {
  const potOdds = betToCall > 0 && pot > 0
    ? betToCall / (pot + betToCall)
    : 0;

  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
    }}>
      {/* Context line */}
      <div className="tnum" style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        <span>Equity <strong style={{ color: equity > 0.5 ? 'var(--success)' : 'var(--text-primary)' }}>{(equity * 100).toFixed(0)}%</strong></span>
        {pot > 0 && <span>Pot <strong style={{ color: 'var(--text-primary)' }}>{pot}</strong></span>}
        {betToCall > 0 && (
          <span>
            Call {betToCall}
            {potOdds > 0 && (
              <span style={{ color: potOdds < equity ? 'var(--success)' : 'var(--danger)' }}>
                {' '}({(potOdds * 100).toFixed(0)}% odds)
              </span>
            )}
          </span>
        )}
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Your reasoning… (optional, Enter to skip)"
        maxLength={300}
        rows={2}
        style={{
          width: '100%', resize: 'none', fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)', lineHeight: 'var(--leading-normal)',
          boxSizing: 'border-box',
        }}
      />
      {value.length > 0 && (
        <div className="tnum" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2, textAlign: 'right' }}>
          {value.length}/300
        </div>
      )}
    </div>
  );
}
