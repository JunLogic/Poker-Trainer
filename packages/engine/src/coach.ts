import type { GameState, Action, Coach, CoachAnalysis, LegalAction } from './types.js';

/**
 * SimpleCoach: compares equity vs pot odds to judge each decision.
 *
 * This is a v1 stub. Future versions can integrate LLM-based natural-language
 * coaching by replacing this class with one that calls an external model.
 * The Coach interface is the extension point.
 */
export class SimpleCoach implements Coach {
  analyse(
    stateBefore: GameState,
    actionTaken: Action,
    equity: number,
  ): CoachAnalysis {
    // Compute pot odds at the moment of the action
    const totalPot = stateBefore.sidePots.reduce((s, p) => s + p.amount, 0);
    const player = stateBefore.players.find(p => p.id === actionTaken.playerId);
    const stack = player?.stack ?? 0;

    let potOdds = 0;
    const gap = stateBefore.bettingRound.currentBet - (player?.betThisStreet ?? 0);
    if (gap > 0 && totalPot > 0) {
      const callAmount = Math.min(gap, stack);
      potOdds = callAmount / (totalPot + callAmount);
    }

    const type = actionTaken.type;
    const evEdge = equity - potOdds;
    const THRESHOLD = 0.05;

    if (type === 'FOLD') {
      if (evEdge > THRESHOLD) {
        return {
          hint: `You folded with ${(equity * 100).toFixed(0)}% equity vs ${(potOdds * 100).toFixed(0)}% pot odds — positive EV spot.`,
          severity: 'mistake',
          suggestedAction: buildCall(gap, stack),
        };
      }
      if (evEdge > -THRESHOLD) {
        return { hint: 'Marginal fold — roughly break-even.', severity: 'neutral', suggestedAction: null };
      }
      return { hint: 'Good fold — equity was below pot odds.', severity: 'good', suggestedAction: null };
    }

    if (type === 'CALL') {
      if (evEdge < -THRESHOLD) {
        return {
          hint: `Called with ${(equity * 100).toFixed(0)}% equity but only ${(potOdds * 100).toFixed(0)}% pot odds needed — negative EV.`,
          severity: 'suboptimal',
          suggestedAction: { type: 'FOLD' },
        };
      }
      return { hint: 'Call has positive expected value.', severity: 'good', suggestedAction: null };
    }

    return { hint: 'Action recorded.', severity: 'neutral', suggestedAction: null };
  }
}

function buildCall(gap: number, stack: number): LegalAction {
  const amount = Math.min(gap, stack);
  return { type: 'CALL', amount };
}
