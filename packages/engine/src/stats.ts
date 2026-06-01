import type { HandRecord, PlayerId, Action } from './types.js';
import { createInitialState } from './state.js';
import { applyAction } from './applyAction.js';

/**
 * Session statistics derived purely from the event-sourced hand records.
 * Read-only over the action log; adds no engine state.
 *
 *  VPIP — % of hands where the player voluntarily put money in preflop
 *         (CALL/BET/RAISE/ALL_IN preflop; posting blinds/antes does NOT count).
 *  PFR  — % of hands where the player made a preflop raise/bet.
 *  AF   — Aggression Factor = (bets + raises + all-ins) / calls across all streets
 *         (calls = 0 ⇒ the raw aggressive-action count).
 *  net  — net chips across the session (final stack − starting stack each hand).
 */
export interface PlayerStats {
  readonly playerId: PlayerId;
  readonly name: string;
  readonly handsPlayed: number;
  readonly vpip: number;             // 0..1
  readonly pfr: number;              // 0..1
  readonly aggressionFactor: number;
  readonly net: number;
  readonly vpipHands: number;
  readonly pfrHands: number;
  readonly aggressiveActions: number;
  readonly calls: number;
}

const AGGRESSIVE = new Set(['BET', 'RAISE', 'ALL_IN']);
const VOLUNTARY = new Set(['CALL', 'BET', 'RAISE', 'ALL_IN']);

function replay(config: HandRecord['config'], log: readonly Action[]) {
  let s = createInitialState(config);
  for (const a of log) s = applyAction(s, a);
  return s;
}

/** Index of the first DEAL_BOARD action — everything before it is preflop. */
function preflopEnd(log: readonly Action[]): number {
  const i = log.findIndex(a => a.type === 'DEAL_BOARD');
  return i === -1 ? log.length : i;
}

export function computePlayerStats(
  hands: readonly HandRecord[],
  playerId: PlayerId,
): PlayerStats {
  let handsPlayed = 0;
  let vpipHands = 0;
  let pfrHands = 0;
  let aggressiveActions = 0;
  let calls = 0;
  let net = 0;
  let name = playerId;

  for (const hand of hands) {
    if (!hand.config.players.some(p => p.id === playerId)) continue;
    handsPlayed++;
    name = hand.config.players.find(p => p.id === playerId)?.name ?? name;

    const pfEnd = preflopEnd(hand.actionLog);
    let didVpip = false;
    let didPfr = false;

    hand.actionLog.forEach((a, idx) => {
      if (a.playerId !== playerId) return;
      const isPreflop = idx < pfEnd;
      if (AGGRESSIVE.has(a.type)) aggressiveActions++;
      if (a.type === 'CALL') calls++;
      if (isPreflop && VOLUNTARY.has(a.type)) didVpip = true;
      if (isPreflop && (a.type === 'BET' || a.type === 'RAISE' || a.type === 'ALL_IN')) didPfr = true;
    });

    if (didVpip) vpipHands++;
    if (didPfr) pfrHands++;

    const start = hand.config.startingStacks[playerId] ?? 0;
    const final = replay(hand.config, hand.actionLog).players.find(p => p.id === playerId)?.stack ?? start;
    net += final - start;
  }

  return {
    playerId,
    name,
    handsPlayed,
    vpip: handsPlayed ? vpipHands / handsPlayed : 0,
    pfr: handsPlayed ? pfrHands / handsPlayed : 0,
    aggressionFactor: calls > 0 ? aggressiveActions / calls : aggressiveActions,
    net,
    vpipHands,
    pfrHands,
    aggressiveActions,
    calls,
  };
}

/** Stats for every player appearing across the given hands. */
export function computeAllStats(hands: readonly HandRecord[]): PlayerStats[] {
  const ids = new Set<PlayerId>();
  for (const h of hands) for (const p of h.config.players) ids.add(p.id);
  return [...ids].map(id => computePlayerStats(hands, id));
}

/** Filter hand records to a single match by handId prefix (`${matchId}-h*`). */
export function handsForMatch(hands: readonly HandRecord[], matchId: string): HandRecord[] {
  return hands.filter(h => h.handId.startsWith(`${matchId}-h`));
}
