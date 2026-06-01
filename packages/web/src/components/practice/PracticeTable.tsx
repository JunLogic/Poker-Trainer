import { useState } from 'react';
import { whoseTurn } from '@poker/engine';
import type { GameState, CoachAnalysis, Action } from '@poker/engine';
import { SimpleCoach } from '@poker/engine';
import { PlayerSeat } from '../common/PlayerSeat.js';
import { ActionButtons } from '../common/ActionButtons.js';
import { EquityBar } from './EquityBar.js';
import { CoachPanel } from './CoachPanel.js';
import { useLegalActions } from '../../hooks/useLegalActions.js';
import { useEquity } from '../../hooks/useEquity.js';
import { useBot } from '../../hooks/useBot.js';
import { ChipDisplay } from '../common/ChipDisplay.js';

interface Props {
  state: GameState;
  botIds: readonly string[];
  heroId?: string;
}

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS: Record<string, string> = {
  h: 'var(--suit-hearts)', d: 'var(--suit-diamonds)',
  c: 'var(--suit-clubs)', s: 'var(--suit-spades)',
};

const coach = new SimpleCoach();

export function PracticeTable({ state, botIds, heroId = 'hero' }: Props) {
  const legal = useLegalActions(state);
  const currentPlayerId = whoseTurn(state);
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);
  const isHeroTurn = currentPlayerId === heroId;
  const [autoPlay, setAutoPlay] = useState(true);
  const [lastAnalysis, setLastAnalysis] = useState<CoachAnalysis | null>(null);

  const boardCards = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  const holeCards = state.players.map(p => p.holeCards);
  const { equities, isComputing } = useEquity(holeCards, boardCards, !state.isHandOver);

  useBot(state, botIds, autoPlay && !state.isHandOver, equities);

  const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      {/* Players */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
        {state.players.map(player => (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={player.id === currentPlayerId}
            isDealer={player.seatIndex === state.config.dealerSeatIndex}
            showCards={true}
          />
        ))}
      </div>

      {/* Equity bar */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <EquityBar players={state.players} equities={equities} isComputing={isComputing} />
        {/* Board */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          {boardCards.length === 0 && (
            <span style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>No community cards yet</span>
          )}
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
        {totalPot > 0 && <div style={{ textAlign: 'center' }}>Pot: <ChipDisplay amount={totalPot} /></div>}
      </div>

      {/* Controls */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: '0.85rem' }}>
            {isHeroTurn ? (
              <span style={{ color: 'var(--color-gold)', fontWeight: 700 }}>Your turn</span>
            ) : currentPlayer ? (
              <span style={{ color: 'var(--color-text-dim)' }}>{currentPlayer.name} thinking…</span>
            ) : null}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoPlay} onChange={e => setAutoPlay(e.target.checked)} />
            Auto-play bots
          </label>
        </div>

        {isHeroTurn && legal.length > 0 && (
          <ActionButtons legal={legal} playerId={heroId} />
        )}
      </div>

      <CoachPanel analysis={lastAnalysis} />

      {state.isHandOver && (
        <div className="panel" style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ color: 'var(--color-gold)', fontWeight: 700 }}>Hand Complete</div>
        </div>
      )}
    </div>
  );
}
