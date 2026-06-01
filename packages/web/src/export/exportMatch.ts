import type { MatchState, HandRecord, PlayerId, Action, AwardPotAction } from '@poker/engine';
import { computeAllStats, handsForMatch } from '@poker/engine';
import { replayLog } from '../store/gameStore.js';
import { openHandDb, getAnnotations } from '../db/handDb.js';
import type { HandAnnotations } from '../types/thoughts.js';

const HERO_ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);

const SUIT = { c: '♣', d: '♦', h: '♥', s: '♠' } as const;
function cardStr(c: { rank: string; suit: 'c' | 'd' | 'h' | 's' }): string { return `${c.rank}${SUIT[c.suit]}`; }

export interface TranscriptDecision {
  readonly index: number;
  readonly street: string;
  readonly board: string[];
  readonly pot: number;
  readonly toCall: number;
  readonly stacks: Record<PlayerId, number>;
  readonly actor: PlayerId;
  readonly actorName: string;
  readonly action: string;
  readonly amount: number | null;
  readonly isHero: boolean;
  readonly heroEquity: number | null;
  readonly thought: string | null;
}

/**
 * Build a human-readable transcript: for each player decision, the resolved
 * state BEFORE it (street, board, pot, stacks), the action, and — for hero —
 * the logged equity + thought. Lets an LLM read the hand without replaying.
 */
export function buildHandTranscript(
  record: HandRecord,
  annotations: HandAnnotations | undefined,
  heroId: PlayerId,
): TranscriptDecision[] {
  const out: TranscriptDecision[] = [];
  const nameOf = (id: PlayerId) => record.config.players.find(p => p.id === id)?.name ?? id;

  for (let i = 0; i < record.actionLog.length; i++) {
    const a = record.actionLog[i]!;
    if (!HERO_ACTIONS.has(a.type)) continue;

    const before = replayLog(record.config, record.actionLog.slice(0, i));
    const actor = before.players.find(p => p.id === a.playerId);
    const board = [
      ...(before.board.flop ?? []),
      ...(before.board.turn ? [before.board.turn] : []),
      ...(before.board.river ? [before.board.river] : []),
    ].map(cardStr);
    const pot = before.sidePots.reduce((s, p) => s + p.amount, 0);
    const toCall = actor ? Math.max(0, before.bettingRound.currentBet - actor.betThisStreet) : 0;
    const thought = annotations?.thoughts[a.id] ?? null;

    out.push({
      index: i,
      street: before.street,
      board,
      pot,
      toCall,
      stacks: Object.fromEntries(before.players.map(p => [p.id, p.stack])),
      actor: a.playerId,
      actorName: nameOf(a.playerId),
      action: a.type,
      amount: 'amount' in a && typeof (a as { amount?: number }).amount === 'number' ? (a as { amount: number }).amount : null,
      isHero: a.playerId === heroId,
      heroEquity: thought ? thought.equity : null,
      thought: thought?.thought ? thought.thought : null,
    });
  }
  return out;
}

export interface MatchExport {
  readonly schema: 'poker-match-export/v1';
  readonly exportedAt: string;
  readonly match: {
    matchId: string;
    smallBlind: number;
    bigBlind: number;
    ante: number;
    startingStack: number;
    players: { id: PlayerId; name: string; seatIndex: number; profile: string | null; isHuman: boolean }[];
  };
  readonly result: {
    winnerId: PlayerId | null;
    standings: PlayerId[];
    finalStacks: Record<PlayerId, number>;
    handsPlayed: number;
  };
  readonly stats: ReturnType<typeof computeAllStats>;
  readonly hands: {
    handId: string;
    handNumber: number | null;
    buttonSeat: number | null;
    actionLog: readonly Action[];
    thoughts: HandAnnotations['thoughts'];
    transcript: TranscriptDecision[];
  }[];
}

export function buildMatchExport(
  match: MatchState,
  matchHands: readonly HandRecord[],
  annotationsByHandId: Record<string, HandAnnotations | undefined>,
  heroId: PlayerId,
): MatchExport {
  // handId → { handNumber, buttonSeat } from match events
  const handMeta: Record<string, { handNumber: number; buttonSeat: number }> = {};
  for (const e of match.events) {
    if (e.type === 'HAND_STARTED') handMeta[e.handId] = { handNumber: e.handNumber, buttonSeat: e.buttonSeat };
  }

  const standings: PlayerId[] = [
    ...(match.winnerId ? [match.winnerId] : []),
    ...[...match.eliminated].reverse(),
  ];

  return {
    schema: 'poker-match-export/v1',
    exportedAt: new Date().toISOString(),
    match: {
      matchId: match.config.matchId,
      smallBlind: match.config.smallBlind,
      bigBlind: match.config.bigBlind,
      ante: match.config.ante ?? 0,
      startingStack: match.config.startingStack,
      players: match.config.players.map(p => ({
        id: p.id, name: p.name, seatIndex: p.seatIndex,
        profile: p.botProfile ?? null, isHuman: !!p.isHuman,
      })),
    },
    result: {
      winnerId: match.winnerId,
      standings,
      finalStacks: { ...match.stacks },
      handsPlayed: match.handNumber,
    },
    stats: computeAllStats(matchHands),
    hands: matchHands.map(h => ({
      handId: h.handId,
      handNumber: handMeta[h.handId]?.handNumber ?? null,
      buttonSeat: handMeta[h.handId]?.buttonSeat ?? null,
      actionLog: h.actionLog,
      thoughts: annotationsByHandId[h.handId]?.thoughts ?? {},
      transcript: buildHandTranscript(h, annotationsByHandId[h.handId], heroId),
    })),
  };
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Gather a match's hands + thought annotations (from IndexedDB), build the
 * self-contained export, and trigger a download.
 */
export async function exportMatchToFile(
  match: MatchState,
  allHands: readonly HandRecord[],
  heroId: PlayerId,
): Promise<void> {
  const matchHands = handsForMatch(allHands, match.config.matchId);
  const db = await openHandDb();
  const annotationsByHandId: Record<string, HandAnnotations | undefined> = {};
  for (const h of matchHands) {
    annotationsByHandId[h.handId] = await getAnnotations(db, h.handId);
  }
  const data = buildMatchExport(match, matchHands, annotationsByHandId, heroId);
  downloadJson(`poker-match-${match.config.matchId}.json`, data);
}
