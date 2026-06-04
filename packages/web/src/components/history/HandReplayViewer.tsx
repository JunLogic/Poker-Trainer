import { useState, useMemo, useEffect } from 'react';
import { replayLog } from '../../store/gameStore.js';
import type { HandRecord } from '@poker/engine';
import { SeatCard } from '../table/SeatCard.js';
import { PlayingCard } from '../cards/PlayingCard.js';
import { ChipDisplay } from '../common/ChipDisplay.js';
import { openHandDb, getAnnotations } from '../../db/handDb.js';
import type { HandAnnotations, ThoughtEntry } from '../../types/thoughts.js';
import { StrategyFeedbackPanel } from '../strategy/StrategyFeedbackPanel.js';

interface Props {
  record: HandRecord;
  onBack: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  FOLD: 'var(--color-fold)', CHECK: '#7f8c8d', CALL: 'var(--color-call)',
  BET: 'var(--color-raise)', RAISE: 'var(--color-raise)', ALL_IN: 'var(--color-allin)',
};

export function HandReplayViewer({ record, onBack }: Props) {
  const [step, setStep] = useState(record.actionLog.length);
  const [annotations, setAnnotations] = useState<HandAnnotations | null>(null);

  // Load annotations from IDB on mount
  useEffect(() => {
    openHandDb().then(db => getAnnotations(db, record.handId)).then(a => {
      if (a) setAnnotations(a);
    }).catch(() => {/* no annotations stored for this hand */});
  }, [record.handId]);

  const state = useMemo(
    () => replayLog(record.config, record.actionLog.slice(0, step)),
    [record, step],
  );

  const currentAction = step > 0 ? record.actionLog[step - 1] : null;
  const currentThought: ThoughtEntry | null =
    currentAction && annotations
      ? (annotations.thoughts[currentAction.id] ?? null)
      : null;
  const currentStrategyVerdict =
    currentAction && annotations
      ? (annotations.strategyVerdicts?.[currentAction.id] ?? null)
      : null;

  const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);
  const boardCards = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];
  const currentPlayerId = state.players.find(
    p => p.id === currentAction?.playerId,
  )?.name ?? currentAction?.playerId ?? '';

  return (
    <div style={{ padding: 16, maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <h2 style={{ color: 'var(--color-gold)' }}>Replay</h2>
        {annotations && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginLeft: 4 }}>
            {Object.keys(annotations.thoughts).length} thought{Object.keys(annotations.thoughts).length !== 1 ? 's' : ''} · {Object.keys(annotations.strategyVerdicts ?? {}).length} verdict{Object.keys(annotations.strategyVerdicts ?? {}).length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Current action label */}
      {currentAction && (
        <div className="panel" style={{ marginBottom: 12, fontSize: '0.85rem', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-dim)' }}>{step}/{record.actionLog.length}</span>
          <span style={{ fontWeight: 700, color: ACTION_COLORS[currentAction.type] ?? 'var(--color-text)' }}>
            {currentAction.type}
          </span>
          {'amount' in currentAction && typeof (currentAction as { amount?: number }).amount === 'number' && (
            <span>{(currentAction as { amount: number }).amount}</span>
          )}
          <span style={{ color: 'var(--color-text-dim)' }}>by</span>
          <span style={{ color: 'var(--color-gold)' }}>{currentPlayerId}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {state.street}
          </span>
        </div>
      )}

      {/* Inline thought for this step */}
      {currentThought && (
        <div style={{
          background: 'rgba(212,168,67,0.06)',
          border: '1px solid rgba(212,168,67,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 6, fontSize: '0.75rem', color: 'var(--color-text-dim)', flexWrap: 'wrap' }}>
            {currentThought.equity > 0 && (
              <span>equity {(currentThought.equity * 100).toFixed(0)}%</span>
            )}
            {currentThought.pot > 0 && <span>pot {currentThought.pot}</span>}
            {currentThought.betToCall > 0 && <span>to call {currentThought.betToCall}</span>}
          </div>
          {currentThought.thought ? (
            <div style={{
              borderLeft: '3px solid rgba(212,168,67,0.5)', paddingLeft: 10,
              fontSize: '0.85rem', color: 'var(--color-text)', fontStyle: 'italic', lineHeight: 1.5,
            }}>
              "{currentThought.thought}"
            </div>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
              — no thought logged at this decision
            </div>
          )}
        </div>
      )}

      {currentStrategyVerdict && (
        <StrategyFeedbackPanel verdict={currentStrategyVerdict} compact />
      )}

      {/* Players */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
        {state.players.map(player => (
          <SeatCard
            key={player.id}
            player={player}
            isActive={false}
            isDealer={player.seatIndex === state.config.dealerSeatIndex}
            showCards
          />
        ))}
      </div>

      {/* Board + pot */}
      <div className="panel" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ marginBottom: 8, fontSize: '0.75rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
          {state.street}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          {boardCards.map((card, i) => (
            <PlayingCard key={i} card={card} size="sm" />
          ))}
        </div>
        {totalPot > 0 && <div>Pot: <ChipDisplay amount={totalPot} /></div>}
      </div>

      {/* Playback controls */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <button className="btn-ghost" onClick={() => setStep(0)} disabled={step === 0}>⏮</button>
        <button className="btn-ghost" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', minWidth: 80, textAlign: 'center' }}>
          {step}/{record.actionLog.length}
        </span>
        <button className="btn-ghost" onClick={() => setStep(s => Math.min(record.actionLog.length, s + 1))} disabled={step === record.actionLog.length}>▶</button>
        <button className="btn-ghost" onClick={() => setStep(record.actionLog.length)} disabled={step === record.actionLog.length}>⏭</button>
      </div>
    </div>
  );
}
