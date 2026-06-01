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
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10, padding: '10px 12px', marginBottom: 10,
    }}>
      {/* Context line */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
        <span>Equity <strong style={{ color: equity > 0.5 ? 'var(--color-call)' : 'var(--color-gold)' }}>{(equity * 100).toFixed(0)}%</strong></span>
        {pot > 0 && <span>Pot <strong style={{ color: 'var(--color-text)' }}>{pot}</strong></span>}
        {betToCall > 0 && (
          <span>
            Call {betToCall}
            {potOdds > 0 && (
              <span style={{ color: potOdds < equity ? 'var(--color-call)' : 'var(--color-fold)' }}>
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
          fontSize: '0.82rem', lineHeight: 1.5,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, padding: '6px 8px',
          color: 'var(--color-text)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {value.length > 0 && (
        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-dim)', marginTop: 2, textAlign: 'right' }}>
          {value.length}/300
        </div>
      )}
    </div>
  );
}
