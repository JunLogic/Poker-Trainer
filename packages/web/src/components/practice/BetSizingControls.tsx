import { useState } from 'react';
import { nanoid } from 'nanoid';
import {
  Dismiss20Regular,
  Checkmark20Regular,
  Money20Regular,
  ArrowUp20Filled,
  Flash20Filled,
} from '@fluentui/react-icons';
import type { LegalAction, Action, PlayerId } from '@poker/engine';

interface Props {
  legal: readonly LegalAction[];
  pot: number;
  playerId: PlayerId;
  /** Called instead of dispatching directly — lets the parent capture a thought first */
  onAction: (action: Action) => void;
}

export function BetSizingControls({ legal, pot, playerId, onAction }: Props) {
  const fold = legal.find(a => a.type === 'FOLD');
  const check = legal.find(a => a.type === 'CHECK');
  const call = legal.find(a => a.type === 'CALL') as { type: 'CALL'; amount: number } | undefined;
  const bet = legal.find(a => a.type === 'BET') as { type: 'BET'; min: number; max: number } | undefined;
  const raise = legal.find(a => a.type === 'RAISE') as { type: 'RAISE'; min: number; max: number } | undefined;
  const allIn = legal.find(a => a.type === 'ALL_IN') as { type: 'ALL_IN'; amount: number } | undefined;

  const betRaise = raise ?? bet;
  const [amount, setAmount] = useState<number | null>(null);
  const currentAmount = amount ?? betRaise?.min ?? 0;

  function dispatch(action: Action) {
    onAction(action);
    setAmount(null);
  }

  function makeBase() {
    return { id: nanoid(), playerId, timestamp: Date.now() } as const;
  }

  function clamp(v: number) {
    if (!betRaise) return v;
    return Math.max(betRaise.min, Math.min(betRaise.max, v));
  }

  function quickSize(fraction: number): number {
    return clamp(Math.floor(pot * fraction));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Primary action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {fold && (
          <button className="btn-fold" onClick={() => dispatch({ ...makeBase(), type: 'FOLD' })}>
            <Dismiss20Regular /> Fold
          </button>
        )}
        {check && (
          <button className="btn-check" onClick={() => dispatch({ ...makeBase(), type: 'CHECK' })}>
            <Checkmark20Regular /> Check
          </button>
        )}
        {call && (
          <button className="btn-call" onClick={() => dispatch({ ...makeBase(), type: 'CALL', amount: call.amount })}>
            <Money20Regular /> Call <span className="tnum">{call.amount}</span>
          </button>
        )}
        {/* All-in when no raise option available */}
        {allIn && !betRaise && (
          <button className="btn-allin" onClick={() => dispatch({ ...makeBase(), type: 'ALL_IN', amount: allIn.amount })}>
            <Flash20Filled /> All In (<span className="tnum">{allIn.amount}</span>)
          </button>
        )}
        {betRaise && (
          <button
            className="btn-raise"
            onClick={() => dispatch({
              ...makeBase(),
              type: betRaise.type === 'RAISE' ? 'RAISE' : 'BET',
              amount: currentAmount,
            } as Action)}
          >
            <ArrowUp20Filled /> {betRaise.type === 'RAISE' ? 'Raise' : 'Bet'} to <span className="tnum">{currentAmount}</span>
          </button>
        )}
      </div>

      {/* Sizing controls — only when bet/raise is legal */}
      {betRaise && (
        <>
          {/* Quick-size buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {([ ['½ pot', 0.5], ['¾ pot', 0.75], ['Pot', 1.0] ] as [string, number][]).map(([label, frac]) => {
              const v = quickSize(frac);
              const disabled = v < betRaise.min || v > betRaise.max;
              return (
                <button
                  key={label}
                  disabled={disabled}
                  onClick={() => setAmount(v)}
                  style={{
                    padding: '4px 12px', fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-pill)',
                    background: currentAmount === v ? 'var(--accent-soft)' : 'var(--bg-raised)',
                    border: currentAmount === v ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: disabled ? 'var(--text-faint)' : currentAmount === v ? 'var(--accent-strong)' : 'var(--text-secondary)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {label}
                </button>
              );
            })}
            {allIn && (
              <button
                onClick={() => dispatch({ ...makeBase(), type: 'ALL_IN', amount: allIn.amount })}
                style={{
                  padding: '4px 12px', fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-pill)',
                  background: 'var(--violet-soft)',
                  border: '1px solid rgba(138,123,192,0.42)',
                  color: 'var(--allin)', cursor: 'pointer', fontWeight: 600,
                }}
                className="tnum"
              >
                All In ({allIn.amount})
              </button>
            )}
          </div>

          {/* Slider + numeric input */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="range" min={betRaise.min} max={betRaise.max} step={1}
              value={currentAmount}
              onChange={e => setAmount(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <input
              type="number" min={betRaise.min} max={betRaise.max}
              value={currentAmount}
              onChange={e => setAmount(clamp(Number(e.target.value)))}
              style={{ width: 80 }}
            />
          </div>
        </>
      )}
    </div>
  );
}
