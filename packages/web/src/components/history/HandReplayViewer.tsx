import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft20Regular,
  Previous20Filled,
  ChevronLeft20Filled,
  ChevronRight20Filled,
  Next20Filled,
} from '@fluentui/react-icons';
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
  FOLD: 'var(--danger)', CHECK: 'var(--text-muted)', CALL: 'var(--success)',
  BET: 'var(--accent-strong)', RAISE: 'var(--accent-strong)', ALL_IN: 'var(--allin)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <button className="btn-ghost" onClick={onBack}><ArrowLeft20Regular /> Back</button>
        <h2>Replay</h2>
        {annotations && (
          <span className="tnum" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 4 }}>
            {Object.keys(annotations.thoughts).length} thought{Object.keys(annotations.thoughts).length !== 1 ? 's' : ''} · {Object.keys(annotations.strategyVerdicts ?? {}).length} verdict{Object.keys(annotations.strategyVerdicts ?? {}).length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Current action label */}
      {currentAction && (
        <div className="panel tnum" style={{ marginBottom: 'var(--space-3)', fontSize: 'var(--text-sm)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)' }}>{step}/{record.actionLog.length}</span>
          <span style={{ fontWeight: 600, color: ACTION_COLORS[currentAction.type] ?? 'var(--text-primary)' }}>
            {currentAction.type}
          </span>
          {'amount' in currentAction && typeof (currentAction as { amount?: number }).amount === 'number' && (
            <span>{(currentAction as { amount: number }).amount}</span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>by</span>
          <span style={{ color: 'var(--accent-strong)' }}>{currentPlayerId}</span>
          <span className="eyebrow" style={{ marginLeft: 'auto' }}>
            {state.street}
          </span>
        </div>
      )}

      {/* Inline thought for this step */}
      {currentThought && (
        <div style={{
          background: 'var(--accent-softer)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
        }}>
          <div className="tnum" style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            {currentThought.equity > 0 && (
              <span>equity {(currentThought.equity * 100).toFixed(0)}%</span>
            )}
            {currentThought.pot > 0 && <span>pot {currentThought.pot}</span>}
            {currentThought.betToCall > 0 && <span>to call {currentThought.betToCall}</span>}
          </div>
          {currentThought.thought ? (
            <div style={{
              borderLeft: '2px solid var(--accent)', paddingLeft: 'var(--space-3)',
              fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 'var(--leading-normal)',
            }}>
              "{currentThought.thought}"
            </div>
          ) : (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-faint)', fontStyle: 'italic' }}>
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
      <div className="panel" style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
          {state.street}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', marginBottom: 'var(--space-2)', minHeight: 56, alignItems: 'center' }}>
          {boardCards.map((card, i) => (
            <PlayingCard key={i} card={card} size="sm" />
          ))}
        </div>
        {totalPot > 0 && <div className="tnum">Pot: <ChipDisplay amount={totalPot} /></div>}
      </div>

      {/* Playback controls */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', alignItems: 'center' }}>
        <button className="btn-ghost" aria-label="First" onClick={() => setStep(0)} disabled={step === 0}><Previous20Filled /></button>
        <button className="btn-ghost" aria-label="Previous" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft20Filled /></button>
        <span className="tnum" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', minWidth: 80, textAlign: 'center' }}>
          {step}/{record.actionLog.length}
        </span>
        <button className="btn-ghost" aria-label="Next" onClick={() => setStep(s => Math.min(record.actionLog.length, s + 1))} disabled={step === record.actionLog.length}><ChevronRight20Filled /></button>
        <button className="btn-ghost" aria-label="Last" onClick={() => setStep(record.actionLog.length)} disabled={step === record.actionLog.length}><Next20Filled /></button>
      </div>
    </div>
  );
}
