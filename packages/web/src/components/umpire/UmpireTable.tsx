import { whoseTurn } from '@poker/engine';
import type { GameState, Card } from '@poker/engine';
import { PlayerSeat } from '../common/PlayerSeat.js';
import { PlayingCard } from '../cards/PlayingCard.js';
import { useLegalActions } from '../../hooks/useLegalActions.js';
import { ChipDisplay } from '../common/ChipDisplay.js';
import { ShowdownPanel } from './ShowdownPanel.js';
import { BettingControls } from './BettingControls.js';

interface Props {
  state: GameState;
}

export function UmpireTable({ state }: Props) {
  const legal = useLegalActions(state);
  const currentPlayerId = whoseTurn(state);
  const currentPlayer = state.players.find(p => p.id === currentPlayerId);
  const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);

  const boardCards: Card[] = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  return (
    <div style={{ padding: 'var(--space-4)', maxWidth: 720, margin: '0 auto' }}>
      {/* Players grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', justifyContent: 'center', marginBottom: 'var(--space-5)' }}>
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
      <div className="panel" style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
          {state.street.toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center', marginBottom: 'var(--space-2)', minHeight: 56, alignItems: 'center' }}>
          {boardCards.length === 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No community cards yet</span>
          )}
          {boardCards.map((card, i) => <PlayingCard key={i} card={card} size="md" />)}
        </div>
        {totalPot > 0 && (
          <div className="tnum" style={{ fontSize: 'var(--text-md)' }}>
            Pot: <ChipDisplay amount={totalPot} />
            {state.sidePots.length > 1 && (
              <span style={{ fontSize: 'var(--text-xs)', marginLeft: 'var(--space-2)', color: 'var(--text-muted)' }}>
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
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <span style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>{currentPlayer.name}</span>
            {' '}'s turn — legal options:
          </div>
          <BettingControls state={state} legal={legal} currentPlayer={currentPlayer} />
        </div>
      ) : state.street !== 'finished' && !state.isHandOver && (
        <div className="panel" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          Waiting for next street action…
        </div>
      )}

      {(state.isHandOver || state.street === 'finished') && (
        <div className="panel" style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Hand Complete</div>
        </div>
      )}
    </div>
  );
}
