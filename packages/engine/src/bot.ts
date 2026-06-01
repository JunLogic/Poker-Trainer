import { nanoid } from 'nanoid';
import type {
  GameState, LegalAction, PlayerId, Action, PokerBot,
} from './types.js';

/**
 * Opponent model on two independent axes plus an error model.
 *
 *  SKILL   — epsilon (error rate) + equityNoiseStd (misreads its own strength).
 *            Higher skill ⇒ lower epsilon, tighter noise.
 *  STYLE   — tightness (how much equity it needs to continue),
 *            aggression (raise-vs-call propensity),
 *            bluffFreq (how often it bets/raises weak),
 *            sizing band (pot-fraction range for its bets/raises).
 *
 * A bot reasons ONLY from public info + its OWN equity (passed in). It never
 * inspects opponents' hole cards.
 */
export interface BotProfile {
  readonly key: string;
  readonly label: string;
  readonly epsilon: number;        // 0..1 probability of deviating from intended line
  readonly equityNoiseStd: number; // std-dev of Gaussian noise on equity (in error branch)
  readonly tightness: number;      // 0..1 — higher folds more
  readonly aggression: number;     // 0..1 — higher raises more
  readonly bluffFreq: number;      // 0..1 — frequency of weak-hand aggression
  readonly sizingMin: number;      // bet/raise target, lower bound as pot fraction
  readonly sizingMax: number;      // bet/raise target, upper bound as pot fraction
}

export const BOT_PROFILES: Record<string, BotProfile> = {
  nit: {
    key: 'nit', label: 'The Nit',
    epsilon: 0.03, equityNoiseStd: 0.04,
    tightness: 0.80, aggression: 0.25, bluffFreq: 0.02,
    sizingMin: 0.40, sizingMax: 0.66,
  },
  station: {
    key: 'station', label: 'The Calling Station',
    epsilon: 0.18, equityNoiseStd: 0.10,
    tightness: 0.22, aggression: 0.15, bluffFreq: 0.03,
    sizingMin: 0.30, sizingMax: 0.55,
  },
  maniac: {
    key: 'maniac', label: 'The Maniac',
    epsilon: 0.22, equityNoiseStd: 0.12,
    tightness: 0.18, aggression: 0.90, bluffFreq: 0.45,
    sizingMin: 0.70, sizingMax: 1.15,
  },
  tag: {
    key: 'tag', label: 'The TAG Reg',
    epsilon: 0.05, equityNoiseStd: 0.05,
    tightness: 0.60, aggression: 0.70, bluffFreq: 0.16,
    sizingMin: 0.50, sizingMax: 0.85,
  },
};

export const DEFAULT_PROFILE_KEYS = ['tag', 'nit', 'station', 'maniac'] as const;

/** Width of the equity≈potOdds zone where the bot mixes instead of playing a hard line. */
const INDIFFERENCE_MARGIN = 0.08;

type Base = { id: string; playerId: PlayerId; timestamp: number };

export class HeuristicBot implements PokerBot {
  readonly name: string;
  readonly profile: BotProfile;
  /** Mapped to the engine's PokerBot.difficulty union for interface compliance. */
  readonly difficulty: 'easy' | 'medium' | 'hard';
  private readonly rng: () => number;

  constructor(name: string, profile: BotProfile, rng: () => number = Math.random) {
    this.name = name;
    this.profile = profile;
    this.rng = rng;
    this.difficulty = profile.epsilon <= 0.06 ? 'hard' : profile.epsilon <= 0.15 ? 'medium' : 'easy';
  }

  selectAction(
    state: GameState,
    legal: readonly LegalAction[],
    myId: PlayerId,
    equity: number,
  ): Action {
    if (legal.length === 0) throw new Error('No legal actions provided to bot');
    const base: Base = { id: nanoid(), playerId: myId, timestamp: Date.now() };

    // ── SKILL: error branch ────────────────────────────────────────────────
    // With probability epsilon the bot deviates: half the time a random
    // suboptimal legal action, half the time it acts on a noised equity read.
    if (this.profile.epsilon > 0 && this.rng() < this.profile.epsilon) {
      if (this.rng() < 0.5) {
        return this.randomSuboptimal(state, legal, base, equity);
      }
      const noised = clamp01(equity + gaussian(this.rng) * this.profile.equityNoiseStd);
      return this.decide(state, legal, base, noised);
    }

    return this.decide(state, legal, base, equity);
  }

  // ── Core policy ────────────────────────────────────────────────────────────
  private decide(
    state: GameState,
    legal: readonly LegalAction[],
    base: Base,
    equity: number,
  ): Action {
    const pot = state.sidePots.reduce((s, p) => s + p.amount, 0);
    const call = find(legal, 'CALL') as { type: 'CALL'; amount: number } | undefined;
    const check = find(legal, 'CHECK');
    const fold = find(legal, 'FOLD');
    const potOdds = call ? call.amount / (pot + call.amount) : 0;
    const { aggression, tightness, bluffFreq } = this.profile;

    // No bet to face → check or bet
    if (!call) {
      const valueThreshold = 0.52 - aggression * 0.12; // aggressive bots value-bet thinner
      const wantsValue = equity >= valueThreshold;
      const wantsBluff = equity < 0.35 && this.rng() < bluffFreq;
      if ((wantsValue || wantsBluff) && this.canAggress(legal)) {
        return this.sizedAggression(state, legal, base, pot);
      }
      if (check) return { ...base, type: 'CHECK' };
      // no check available (shouldn't happen without a call) → fall through
    }

    // Facing a bet → fold / call / raise
    const edge = equity - potOdds;

    // Mixed strategy near indifference
    if (Math.abs(edge) < INDIFFERENCE_MARGIN) {
      const continueProb = clamp01(0.5 + edge / (2 * INDIFFERENCE_MARGIN));
      if (this.rng() < continueProb) {
        // continue: sometimes raise (scaled by aggression + closeness to ahead)
        const raiseProb = aggression * clamp01(0.5 + edge / INDIFFERENCE_MARGIN);
        if (this.canAggress(legal) && this.rng() < raiseProb) {
          return this.sizedAggression(state, legal, base, pot);
        }
        return this.callOrCheck(legal, base);
      }
      return fold ? { ...base, type: 'FOLD' } : this.callOrCheck(legal, base);
    }

    // Clearly ahead → value raise (by aggression) else call
    if (edge >= INDIFFERENCE_MARGIN) {
      const strong = equity > 0.66;
      const raiseProb = strong ? Math.max(aggression, 0.5) : aggression;
      if (this.canAggress(legal) && this.rng() < raiseProb) {
        return this.sizedAggression(state, legal, base, pot);
      }
      return this.callOrCheck(legal, base);
    }

    // Clearly behind → mostly fold; loose bots still call within slack; rare bluff-raise
    const callSlack = (1 - tightness) * 0.25;
    if (equity >= potOdds - callSlack) {
      return this.callOrCheck(legal, base);
    }
    if (this.canAggress(legal) && this.rng() < bluffFreq) {
      return this.sizedAggression(state, legal, base, pot);
    }
    return fold ? { ...base, type: 'FOLD' } : this.callOrCheck(legal, base);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  private canAggress(legal: readonly LegalAction[]): boolean {
    return !!(find(legal, 'BET') || find(legal, 'RAISE') || find(legal, 'ALL_IN'));
  }

  /** Build a bet/raise sized within the profile band, clamped to legal min/max. */
  private sizedAggression(
    state: GameState,
    legal: readonly LegalAction[],
    base: Base,
    pot: number,
  ): Action {
    const bet = find(legal, 'BET') as { type: 'BET'; min: number; max: number } | undefined;
    const raise = find(legal, 'RAISE') as { type: 'RAISE'; min: number; max: number } | undefined;
    const target = raise ?? bet;
    const allIn = find(legal, 'ALL_IN') as { type: 'ALL_IN'; amount: number } | undefined;

    if (!target) {
      if (allIn) return { ...base, type: 'ALL_IN', amount: allIn.amount };
      return this.callOrCheck(legal, base);
    }

    const { sizingMin, sizingMax } = this.profile;
    const frac = sizingMin + this.rng() * (sizingMax - sizingMin);
    const raw = Math.round(pot * frac);
    const amount = clampInt(raw, target.min, target.max);

    // If our band points at (or above) max, just shove via the all-in action when present.
    if (allIn && amount >= target.max) {
      return { ...base, type: 'ALL_IN', amount: allIn.amount };
    }
    return { ...base, type: target.type, amount } as Action;
  }

  private randomSuboptimal(
    state: GameState,
    legal: readonly LegalAction[],
    base: Base,
    equity: number,
  ): Action {
    const intended = this.decide(state, legal, base, equity);
    const others = legal.filter(a => a.type !== intended.type);
    const pick = others.length > 0 ? others[Math.floor(this.rng() * others.length)]! : legal[0]!;
    switch (pick.type) {
      case 'FOLD': return { ...base, type: 'FOLD' };
      case 'CHECK': return { ...base, type: 'CHECK' };
      case 'CALL': return { ...base, type: 'CALL', amount: pick.amount };
      case 'ALL_IN': return { ...base, type: 'ALL_IN', amount: pick.amount };
      case 'BET':
      case 'RAISE': {
        const pot = state.sidePots.reduce((s, p) => s + p.amount, 0);
        return this.sizedAggression(state, legal, base, pot);
      }
    }
  }

  private callOrCheck(legal: readonly LegalAction[], base: Base): Action {
    const check = find(legal, 'CHECK');
    if (check) return { ...base, type: 'CHECK' };
    const call = find(legal, 'CALL') as { type: 'CALL'; amount: number } | undefined;
    if (call) return { ...base, type: 'CALL', amount: call.amount };
    const allIn = find(legal, 'ALL_IN') as { type: 'ALL_IN'; amount: number } | undefined;
    if (allIn) return { ...base, type: 'ALL_IN', amount: allIn.amount };
    return { ...base, type: 'FOLD' };
  }
}

/** Construct a bot from a profile key (falls back to TAG). */
export function makeBot(profileKey: string, name?: string, rng?: () => number): HeuristicBot {
  const profile = BOT_PROFILES[profileKey] ?? BOT_PROFILES.tag!;
  return new HeuristicBot(name ?? profile.label, profile, rng);
}

// ── pure numeric helpers ──────────────────────────────────────────────────────

function find(legal: readonly LegalAction[], type: LegalAction['type']) {
  return legal.find(a => a.type === type);
}
function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }
function clampInt(x: number, lo: number, hi: number): number {
  const v = Math.round(x); return v < lo ? lo : v > hi ? hi : v;
}
/** Standard-normal sample via Box–Muller, driven by the injected rng. */
function gaussian(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * CFR bot stub — implement counterfactual regret minimisation and drop in here.
 * Same PokerBot interface, so neither the engine nor the UI changes.
 */
export class CfrBot implements PokerBot {
  readonly name = 'CFR Bot (stub)';
  readonly difficulty = 'hard' as const;
  selectAction(_s: GameState, _l: readonly LegalAction[], _id: PlayerId, _e: number): Action {
    throw new Error('CfrBot is a stub — implement CFR and replace this body.');
  }
}
