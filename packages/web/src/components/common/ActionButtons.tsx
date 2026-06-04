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
import { useGameStore } from '../../store/gameStore.js';

interface Props {
  legal: LegalAction[];
  playerId: PlayerId;
  /**
   * Optional intercept. When provided, called instead of dispatching directly
   * to the store — lets a parent (e.g. PracticeTable) capture a thought first.
   * When absent, falls back to direct appendAction (umpire mode behaviour).
   */
  onAction?: (action: Action) => void;
}

export function ActionButtons({ legal, playerId, onAction }: Props) {
  const appendAction = useGameStore(s => s.appendAction);
  const [raiseAmount, setRaiseAmount] = useState<number | null>(null);

  const base = { id: nanoid(), playerId, timestamp: Date.now() };

  const fold = legal.find(a => a.type === 'FOLD');
  const check = legal.find(a => a.type === 'CHECK');
  const call = legal.find(a => a.type === 'CALL') as { type: 'CALL'; amount: number } | undefined;
  const bet = legal.find(a => a.type === 'BET') as { type: 'BET'; min: number; max: number } | undefined;
  const raise = legal.find(a => a.type === 'RAISE') as { type: 'RAISE'; min: number; max: number } | undefined;
  const allIn = legal.find(a => a.type === 'ALL_IN') as { type: 'ALL_IN'; amount: number } | undefined;

  const betRaise = raise ?? bet;
  const defaultRaise = betRaise?.min ?? 0;
  const currentRaise = raiseAmount ?? defaultRaise;

  function dispatch(action: Action) {
    if (onAction) {
      onAction(action);
    } else {
      appendAction(action);
    }
    setRaiseAmount(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {fold && (
          <button className="btn-fold" onClick={() => dispatch({ ...base, type: 'FOLD' })}>
            <Dismiss20Regular /> Fold
          </button>
        )}
        {check && (
          <button className="btn-check" onClick={() => dispatch({ ...base, type: 'CHECK' })}>
            <Checkmark20Regular /> Check
          </button>
        )}
        {call && (
          <button className="btn-call" onClick={() => dispatch({ ...base, type: 'CALL', amount: call.amount })}>
            <Money20Regular /> Call <span className="tnum">{call.amount}</span>
          </button>
        )}
        {allIn && !raise && !bet && (
          <button className="btn-allin" onClick={() => dispatch({ ...base, type: 'ALL_IN', amount: allIn.amount })}>
            <Flash20Filled /> All In (<span className="tnum">{allIn.amount}</span>)
          </button>
        )}
        {betRaise && (
          <button
            className="btn-raise"
            onClick={() => dispatch({
              ...base,
              type: betRaise.type === 'RAISE' ? 'RAISE' : 'BET',
              amount: currentRaise,
            } as Action)}
          >
            <ArrowUp20Filled /> {betRaise.type === 'RAISE' ? 'Raise' : 'Bet'} to <span className="tnum">{currentRaise}</span>
          </button>
        )}
        {betRaise && allIn && currentRaise >= betRaise.max && (
          <button className="btn-allin" onClick={() => dispatch({ ...base, type: 'ALL_IN', amount: allIn.amount })}>
            <Flash20Filled /> All In (<span className="tnum">{allIn.amount}</span>)
          </button>
        )}
      </div>

      {betRaise && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="range" min={betRaise.min} max={betRaise.max} step={1}
            value={currentRaise}
            onChange={e => setRaiseAmount(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <input
            type="number" min={betRaise.min} max={betRaise.max}
            value={currentRaise}
            onChange={e => {
              const v = Math.max(betRaise.min, Math.min(betRaise.max, Number(e.target.value)));
              setRaiseAmount(v);
            }}
            style={{ width: 80 }}
          />
        </div>
      )}
    </div>
  );
}
