import type { GameConfig, PlayerId } from './types.js';

/**
 * Match (full-game) layer — sits ABOVE the pure per-hand engine.
 *
 * It is itself pure and event-sourced: a MatchState is derived from a MatchConfig
 * plus the sequence of hands played. It NEVER mutates engine state; it only
 * produces a per-hand `GameConfig` (consumed by `createInitialState`) and folds
 * each hand's final stacks back in.
 *
 * Responsibilities:
 *  - carry stacks between hands
 *  - rotate the dealer button each hand (skipping eliminated players)
 *  - assign blinds correctly, INCLUDING the heads-up exception
 *  - eliminate busted players and detect match-over
 *
 * v1: static blinds. The `blindLevel`/`ante` seam is left for tournament levels
 * later but is intentionally not driven here.
 */

export interface MatchPlayerConfig {
  readonly id: PlayerId;
  readonly name: string;
  /** Canonical seat, stable for the whole match (used for button rotation + UI). */
  readonly seatIndex: number;
  readonly isHuman?: boolean;
  /** Opaque profile key for bot players; the match layer does not interpret it. */
  readonly botProfile?: string;
}

export interface MatchConfig {
  readonly matchId: string;
  readonly players: readonly MatchPlayerConfig[]; // 2..6
  readonly startingStack: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly ante?: number;
}

export type MatchEvent =
  | { readonly type: 'MATCH_STARTED'; readonly matchId: string; readonly timestamp: number;
      readonly players: readonly MatchPlayerConfig[]; readonly startingStack: number }
  | { readonly type: 'HAND_STARTED'; readonly handNumber: number; readonly handId: string;
      readonly buttonSeat: number; readonly timestamp: number; readonly stacks: Readonly<Record<PlayerId, number>> }
  | { readonly type: 'HAND_COMPLETED'; readonly handNumber: number; readonly handId: string;
      readonly timestamp: number; readonly stacksAfter: Readonly<Record<PlayerId, number>> }
  | { readonly type: 'PLAYER_ELIMINATED'; readonly playerId: PlayerId; readonly handNumber: number; readonly timestamp: number }
  | { readonly type: 'MATCH_COMPLETED'; readonly winnerId: PlayerId; readonly timestamp: number };

export interface MatchState {
  readonly config: MatchConfig;
  readonly stacks: Readonly<Record<PlayerId, number>>;
  /** Busted players, in elimination order (earliest first). */
  readonly eliminated: readonly PlayerId[];
  /** Canonical seat index that currently holds the button. */
  readonly buttonSeat: number;
  /** 0 before the first hand; increments as hands start. */
  readonly handNumber: number;
  readonly status: 'pending' | 'in-progress' | 'complete';
  readonly winnerId: PlayerId | null;
  readonly events: readonly MatchEvent[];
}

export interface BlindAssignment {
  readonly sbId: PlayerId;
  readonly bbId: PlayerId;
}

export interface NextHand {
  readonly state: MatchState;
  readonly handConfig: GameConfig;
  readonly blinds: BlindAssignment;
}

// ── Construction ────────────────────────────────────────────────────────────

export function createMatch(config: MatchConfig, now: number = Date.now()): MatchState {
  if (config.players.length < 2) throw new Error('A match needs at least 2 players');
  const stacks: Record<PlayerId, number> = {};
  for (const p of config.players) stacks[p.id] = config.startingStack;

  // Initial button = lowest seat index present.
  const buttonSeat = [...config.players].sort((a, b) => a.seatIndex - b.seatIndex)[0]!.seatIndex;

  return {
    config,
    stacks,
    eliminated: [],
    buttonSeat,
    handNumber: 0,
    status: 'pending',
    winnerId: null,
    events: [{
      type: 'MATCH_STARTED', matchId: config.matchId, timestamp: now,
      players: config.players, startingStack: config.startingStack,
    }],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** All players still in the match (not eliminated), sorted by canonical seat. */
export function survivingPlayers(state: MatchState): MatchPlayerConfig[] {
  const out = state.config.players.filter(p => !state.eliminated.includes(p.id));
  return out.sort((a, b) => a.seatIndex - b.seatIndex);
}

/**
 * Assign small/big blinds for a hand, honouring the heads-up exception.
 *
 *  - Heads-up (exactly 2 players): the BUTTON posts the small blind (and acts
 *    first preflop); the other player posts the big blind (acts first postflop).
 *  - 3+ handed: small blind is the seat to the LEFT of the button, big blind next.
 *
 * `survivors` must be sorted by seatIndex ascending; `buttonSeat` must be a
 * surviving seat.
 */
export function assignBlinds(
  survivors: readonly MatchPlayerConfig[],
  buttonSeat: number,
): BlindAssignment {
  if (survivors.length < 2) throw new Error('Need at least 2 players to assign blinds');
  const btnIdx = survivors.findIndex(p => p.seatIndex === buttonSeat);
  if (btnIdx < 0) throw new Error(`Button seat ${buttonSeat} is not among survivors`);

  if (survivors.length === 2) {
    const button = survivors[btnIdx]!;
    const other = survivors[(btnIdx + 1) % 2]!;
    return { sbId: button.id, bbId: other.id }; // HU: button = SB
  }

  const sb = survivors[(btnIdx + 1) % survivors.length]!;
  const bb = survivors[(btnIdx + 2) % survivors.length]!;
  return { sbId: sb.id, bbId: bb.id };
}

/**
 * Next button seat: the first surviving seat clockwise after `currentButtonSeat`.
 * Uses the full canonical seat order (including eliminated seats) so the button
 * keeps moving in the same physical direction as players bust.
 */
export function rotateButton(state: MatchState, currentButtonSeat: number): number {
  const allSeats = [...state.config.players].map(p => p.seatIndex).sort((a, b) => a - b);
  const survivors = new Set(survivingPlayers(state).map(p => p.seatIndex));
  const startPos = allSeats.indexOf(currentButtonSeat);
  for (let i = 1; i <= allSeats.length; i++) {
    const seat = allSeats[(startPos + i) % allSeats.length]!;
    if (survivors.has(seat)) return seat;
  }
  return currentButtonSeat; // only one player left
}

// ── Hand lifecycle ─────────────────────────────────────────────────────────

/**
 * Produce the GameConfig for the next hand and advance match bookkeeping.
 * The first hand keeps the initial button; subsequent hands rotate it.
 */
export function startNextHand(state: MatchState, now: number = Date.now()): NextHand {
  if (state.status === 'complete') throw new Error('Match is already complete');
  const survivors = survivingPlayers(state);
  if (survivors.length < 2) throw new Error('Not enough players to start a hand');

  const buttonSeat = state.handNumber === 0
    ? state.buttonSeat
    : rotateButton(state, state.buttonSeat);

  const handNumber = state.handNumber + 1;
  const handId = `${state.config.matchId}-h${handNumber}`;

  const startingStacks: Record<PlayerId, number> = {};
  for (const p of survivors) startingStacks[p.id] = state.stacks[p.id] ?? 0;

  const handConfig: GameConfig = {
    handId,
    mode: 'practice',
    smallBlind: state.config.smallBlind,
    bigBlind: state.config.bigBlind,
    ante: state.config.ante ?? 0,
    dealerSeatIndex: buttonSeat,
    players: survivors.map(p => ({
      id: p.id, name: p.name, seatIndex: p.seatIndex, startingStack: startingStacks[p.id]!,
    })),
    startingStacks,
  };

  const blinds = assignBlinds(survivors, buttonSeat);

  const nextState: MatchState = {
    ...state,
    buttonSeat,
    handNumber,
    status: 'in-progress',
    events: [...state.events, {
      type: 'HAND_STARTED', handNumber, handId, buttonSeat, timestamp: now, stacks: { ...startingStacks },
    }],
  };

  return { state: nextState, handConfig, blinds };
}

/**
 * Fold a finished hand's final stacks back into the match.
 * `finalStacks` covers the players who were in the hand (survivors at hand start).
 * Players who hit 0 are eliminated (multi-bust ordered by stack-at-hand-start
 * ascending — shortest stack finishes lower). When ≤1 player remains the match
 * completes and the last player standing is the winner.
 */
export function applyHandResult(
  state: MatchState,
  handId: string,
  finalStacks: Readonly<Record<PlayerId, number>>,
  now: number = Date.now(),
): MatchState {
  const stacks: Record<PlayerId, number> = { ...state.stacks };
  for (const [id, v] of Object.entries(finalStacks)) stacks[id] = v;

  const events: MatchEvent[] = [...state.events, {
    type: 'HAND_COMPLETED', handNumber: state.handNumber, handId, timestamp: now, stacksAfter: { ...stacks },
  }];

  // Determine newly-busted players (stack 0, not already eliminated).
  const startStacks = lastHandStartStacks(state);
  const newlyBusted = survivingPlayers(state)
    .filter(p => (stacks[p.id] ?? 0) <= 0)
    .sort((a, b) => (startStacks[a.id] ?? 0) - (startStacks[b.id] ?? 0))
    .map(p => p.id);

  const eliminated = [...state.eliminated];
  for (const id of newlyBusted) {
    eliminated.push(id);
    events.push({ type: 'PLAYER_ELIMINATED', playerId: id, handNumber: state.handNumber, timestamp: now });
  }

  const remaining = state.config.players.filter(p => !eliminated.includes(p.id));

  let status: MatchState['status'] = 'in-progress';
  let winnerId: PlayerId | null = state.winnerId;
  if (remaining.length <= 1) {
    status = 'complete';
    winnerId = remaining[0]?.id ?? null;
    if (winnerId) events.push({ type: 'MATCH_COMPLETED', winnerId, timestamp: now });
  }

  return { ...state, stacks, eliminated, status, winnerId, events };
}

export function isMatchOver(state: MatchState): boolean {
  return state.status === 'complete';
}

export function matchWinner(state: MatchState): PlayerId | null {
  return state.winnerId;
}

// ── internal ──────────────────────────────────────────────────────────────────

/** Stacks recorded at the start of the most recent hand (for multi-bust ordering). */
function lastHandStartStacks(state: MatchState): Record<PlayerId, number> {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]!;
    if (e.type === 'HAND_STARTED') return { ...e.stacks };
  }
  return { ...state.stacks };
}
