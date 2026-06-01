import type { GameState, LegalAction, Player } from '@poker/engine';
import { ActionButtons } from '../common/ActionButtons.js';

interface Props {
  state: GameState;
  legal: LegalAction[];
  currentPlayer: Player;
}

function formatLegal(action: LegalAction): string {
  switch (action.type) {
    case 'FOLD': return 'Fold';
    case 'CHECK': return 'Check';
    case 'CALL': return `Call ${action.amount}`;
    case 'BET': return `Bet ${action.min}–${action.max}`;
    case 'RAISE': return `Raise to ${action.min}–${action.max}`;
    case 'ALL_IN': return `All In (${action.amount})`;
    default: return '';
  }
}

export function BettingControls({ state, legal, currentPlayer }: Props) {
  return (
    <div>
      <div style={{ marginBottom: 10, fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
        Legal options: {legal.map(formatLegal).join(' / ')}
      </div>
      <ActionButtons legal={legal} playerId={currentPlayer.id} />
    </div>
  );
}
