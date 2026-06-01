import { nanoid } from 'nanoid';
import type {
  GameState, LegalAction, PlayerId, Action, PokerBot,
} from './types.js';

/**
 * Heuristic bot implementing the PokerBot interface.
 * v1 strategy: pot-odds + Monte Carlo equity + randomised aggression.
 * Designed so a CFR bot can be dropped in by implementing PokerBot.
 */
export class HeuristicBot implements PokerBot {
  constructor(
    readonly name: string,
    readonly difficulty: 'easy' | 'medium' | 'hard',
    private readonly aggressionBias = 0.1,
  ) {}

  selectAction(
    state: GameState,
    legal: readonly LegalAction[],
    myId: PlayerId,
    equity: number,
  ): Action {
    const base = { id: nanoid(), playerId: myId, timestamp: Date.now() };

    if (legal.length === 0) throw new Error('No legal actions provided to bot');

    if (this.difficulty === 'easy') {
      return this.easyDecision(legal, base, equity);
    }
    if (this.difficulty === 'medium') {
      return this.mediumDecision(state, legal, base, equity);
    }
    return this.hardDecision(state, legal, base, equity);
  }

  private easyDecision(
    legal: readonly LegalAction[],
    base: { id: string; playerId: PlayerId; timestamp: number },
    _equity: number,
  ): Action {
    // Random-weighted: 60% call/check, 20% fold, 20% raise
    const r = Math.random();
    if (r < 0.2) {
      const fold = legal.find(a => a.type === 'FOLD');
      if (fold) return { ...base, type: 'FOLD' };
    }
    if (r < 0.4) {
      const raise = legal.find(a => a.type === 'RAISE') as { type: 'RAISE'; min: number; max: number } | undefined;
      if (raise) return { ...base, type: 'RAISE', amount: raise.min };
    }
    return this.callOrCheck(legal, base);
  }

  private mediumDecision(
    state: GameState,
    legal: readonly LegalAction[],
    base: { id: string; playerId: PlayerId; timestamp: number },
    equity: number,
  ): Action {
    const callAction = legal.find(a => a.type === 'CALL') as { type: 'CALL'; amount: number } | undefined;
    const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);
    const potOdds = callAction
      ? callAction.amount / (totalPot + callAction.amount)
      : 0;

    // Bluff occasionally
    const bluffing = Math.random() < this.aggressionBias;

    if (equity > potOdds + 0.05 || bluffing) {
      // Strong hand or bluff: prefer raise if available
      const raise = legal.find(a => a.type === 'RAISE') as { type: 'RAISE'; min: number; max: number } | undefined;
      if (raise) {
        return { ...base, type: 'RAISE', amount: raise.min };
      }
    }

    if (equity >= potOdds || equity > 0.3) {
      return this.callOrCheck(legal, base);
    }

    const fold = legal.find(a => a.type === 'FOLD');
    if (fold) return { ...base, type: 'FOLD' };
    return this.callOrCheck(legal, base);
  }

  private hardDecision(
    state: GameState,
    legal: readonly LegalAction[],
    base: { id: string; playerId: PlayerId; timestamp: number },
    equity: number,
  ): Action {
    const callAction = legal.find(a => a.type === 'CALL') as { type: 'CALL'; amount: number } | undefined;
    const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);
    const potOdds = callAction
      ? callAction.amount / (totalPot + callAction.amount)
      : 0;

    const player = state.players.find(p => p.id === base.playerId);
    const spr = player && totalPot > 0 ? player.stack / totalPot : Infinity;

    // Polarised bet sizing: large on strong/weak, small on medium
    const raise = legal.find(a => a.type === 'RAISE') as { type: 'RAISE'; min: number; max: number } | undefined;
    const bluffFreq = 0.15;
    const isBluff = Math.random() < bluffFreq;

    if ((equity > 0.65 || isBluff) && raise) {
      // Value bet or bluff: size up — 65% of pot
      const sizeBet = Math.min(
        raise.max,
        Math.max(raise.min, Math.floor(totalPot * 0.65)),
      );
      return { ...base, type: 'RAISE', amount: sizeBet };
    }

    // Shove if SPR is low and we have the best of it
    if (spr < 2 && equity > potOdds) {
      const allIn = legal.find(a => a.type === 'ALL_IN') as { type: 'ALL_IN'; amount: number } | undefined;
      if (allIn) return { ...base, type: 'ALL_IN', amount: allIn.amount };
    }

    if (equity >= potOdds || equity > 0.35) {
      return this.callOrCheck(legal, base);
    }

    const fold = legal.find(a => a.type === 'FOLD');
    if (fold) return { ...base, type: 'FOLD' };
    return this.callOrCheck(legal, base);
  }

  private callOrCheck(
    legal: readonly LegalAction[],
    base: { id: string; playerId: PlayerId; timestamp: number },
  ): Action {
    const check = legal.find(a => a.type === 'CHECK');
    if (check) return { ...base, type: 'CHECK' };
    const call = legal.find(a => a.type === 'CALL') as { type: 'CALL'; amount: number } | undefined;
    if (call) return { ...base, type: 'CALL', amount: call.amount };
    const allIn = legal.find(a => a.type === 'ALL_IN') as { type: 'ALL_IN'; amount: number } | undefined;
    if (allIn) return { ...base, type: 'ALL_IN', amount: allIn.amount };
    // Last resort
    return { ...base, type: 'FOLD' };
  }
}

/**
 * CFR bot stub — replace this class with a real CFR implementation.
 * Throws NotImplementedError so it's obvious if accidentally used.
 */
export class CfrBot implements PokerBot {
  readonly name = 'CFR Bot (stub)';
  readonly difficulty = 'hard' as const;

  selectAction(
    _state: GameState,
    _legal: readonly LegalAction[],
    _myId: PlayerId,
    _equity: number,
  ): Action {
    throw new Error(
      'CfrBot is a stub — implement counterfactual regret minimisation and replace this body.',
    );
  }
}
