import { useState, useMemo } from 'react';
import { replayLog } from '../../store/gameStore.js';
import type { HandRecord } from '@poker/engine';
import { PlayerSeat } from '../common/PlayerSeat.js';
import { ChipDisplay } from '../common/ChipDisplay.js';

interface Props {
  record: HandRecord;
  onBack: () => void;
}

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS: Record<string, string> = {
  h: 'var(--suit-hearts)', d: 'var(--suit-diamonds)',
  c: 'var(--suit-clubs)', s: 'var(--suit-spades)',
};

export function HandReplayViewer({ record, onBack }: Props) {
  const [step, setStep] = useState(record.actionLog.length);

  const state = useMemo(
    () => replayLog(record.config, record.actionLog.slice(0, step)),
    [record, step],
  );

  const currentAction = step > 0 ? record.actionLog[step - 1] : null;
  const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);
  const boardCards = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <h2 style={{ color: 'var(--color-gold)' }}>Hand Replay</h2>
      </div>

      {/* Action breadcrumb */}
      {currentAction && (
        <div className="panel" style={{ marginBottom: 12, fontSize: '0.85rem' }}>
          Step {step}/{record.actionLog.length}:{' '}
          <strong>{currentAction.type}</strong> by{' '}
          <span style={{ color: 'var(--color-gold)' }}>
            {state.players.find(p => p.id === currentAction.playerId)?.name ?? currentAction.playerId}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
        {state.players.map(player => (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={false}
            isDealer={player.seatIndex === state.config.dealerSeatIndex}
            showCards={true}
          />
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ marginBottom: 8, fontSize: '0.8rem', color: 'var(--color-text-dim)', textTransform: 'uppercase' }}>
          {state.street}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          {boardCards.map((card, i) => (
            <div key={i} style={{
              background: 'var(--color-card-bg)',
              border: '1px solid var(--color-card-border)',
              borderRadius: 6, padding: '6px 10px',
              fontSize: '1.1rem', fontWeight: 700,
              color: SUIT_COLORS[card.suit],
            }}>
              {card.rank}{SUIT_SYMBOLS[card.suit]}
            </div>
          ))}
        </div>
        {totalPot > 0 && <div>Pot: <ChipDisplay amount={totalPot} /></div>}
      </div>

      {/* Controls */}
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
