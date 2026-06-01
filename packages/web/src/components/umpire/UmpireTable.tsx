import { whoseTurn } from '@poker/engine';
import type { GameState } from '@poker/engine';
import { PlayerSeat } from '../common/PlayerSeat.js';
import { ActionButtons } from '../common/ActionButtons.js';
import { useLegalActions } from '../../hooks/useLegalActions.js';
import { ChipDisplay } from '../common/ChipDisplay.js';
import { ShowdownPanel } from './ShowdownPanel.js';
import { BettingControls } from './BettingControls.js';

interface Props {
  state: GameState;
}

const SUIT_SYMBOLS: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_COLORS: Record<string, string> = {
  h: 'var(--suit-hearts)', d: 'var(--suit-diamonds)',
  c: 'var(--suit-clubs)', s: 'var(--suit-spades)',
};

function BoardCard({ card }: { card: { rank: string; suit: string } }) {
  return (
    <div style={{
      background: 'var(--color-card-bg)',
      border: '1px solid var(--color-card-border)',
      borderRadius: 6,
      padding: '6px 10px',
      fontSize: '1.1rem',
      fontWeight: 700,
      color: SUIT_COLORS[card.suit],
      boxShadow: 'var(--shadow-card)',
    }}>
      {card.rank}{SUIT_SYMBOLS[card.suit]}
    </div>
  );
}

export function UmpireTable({ state }: Props) {
  const legal = useLegalActions(state);
  const currentPlayerId = whoseTurn(state);
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);
  const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);

  const boardCards = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  return (
    <div style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      {/* Players grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 }}>
        {state.players.map(player => (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={player.id === currentPlayerId}
            isDealer={player.seatIndex === state.config.dealerSeatIndex}
          />
        ))}
      </div>

      {/* Board */}
      <div className="panel" style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ marginBottom: 8, fontSize: '0.8rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
          {state.street.toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
          {boardCards.length === 0 && (
            <span style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>No community cards yet</span>
          )}
          {boardCards.map((card, i) => <BoardCard key={i} card={card} />)}
        </div>
        {totalPot > 0 && (
          <div style={{ fontSize: '1rem' }}>
            Pot: <ChipDisplay amount={totalPot} />
            {state.sidePots.length > 1 && (
              <span style={{ fontSize: '0.75rem', marginLeft: 8, color: 'var(--color-text-dim)' }}>
                ({state.sidePots.map((p, i) => `P${i}: ${p.amount}`).join(', ')})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action area */}
      {state.street === 'showdown' ? (
        <ShowdownPanel state={state} />
      ) : currentPlayer && legal.length > 0 ? (
        <div className="panel">
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: 'var(--color-gold)', fontWeight: 700 }}>{currentPlayer.name}</span>
            {' '}'s turn — legal options:
          </div>
          <BettingControls state={state} legal={legal} currentPlayer={currentPlayer} />
        </div>
      ) : state.street !== 'finished' && !state.isHandOver && (
        <div className="panel" style={{ textAlign: 'center', color: 'var(--color-text-dim)' }}>
          Waiting for next street action…
        </div>
      )}

      {(state.isHandOver || state.street === 'finished') && (
        <div className="panel" style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ color: 'var(--color-gold)', fontWeight: 700, marginBottom: 8 }}>Hand Complete</div>
        </div>
      )}
    </div>
  );
}
