import { useState } from 'react';
import { nanoid } from 'nanoid';
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
            Fold
          </button>
        )}
        {check && (
          <button className="btn-check" onClick={() => dispatch({ ...makeBase(), type: 'CHECK' })}>
            Check
          </button>
        )}
        {call && (
          <button className="btn-call" onClick={() => dispatch({ ...makeBase(), type: 'CALL', amount: call.amount })}>
            Call {call.amount}
          </button>
        )}
        {/* All-in when no raise option available */}
        {allIn && !betRaise && (
          <button className="btn-allin" onClick={() => dispatch({ ...makeBase(), type: 'ALL_IN', amount: allIn.amount })}>
            All In ({allIn.amount})
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
            {betRaise.type === 'RAISE' ? 'Raise' : 'Bet'} to {currentAmount}
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
                    padding: '4px 10px', fontSize: '0.78rem', borderRadius: 6,
                    background: currentAmount === v ? 'rgba(212,168,67,0.3)' : 'rgba(255,255,255,0.07)',
                    border: currentAmount === v ? '1px solid var(--color-gold)' : '1px solid rgba(255,255,255,0.15)',
                    color: disabled ? '#555' : 'var(--color-text)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
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
                  padding: '4px 10px', fontSize: '0.78rem', borderRadius: 6,
                  background: 'rgba(142,68,173,0.2)',
                  border: '1px solid rgba(142,68,173,0.5)',
                  color: 'var(--color-allin)', cursor: 'pointer',
                }}
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
