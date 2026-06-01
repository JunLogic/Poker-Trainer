import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { whoseTurn, legalActions, evaluateHand, compareHandRanks, makeBot } from '@poker/engine';
import type { GameState, Action, LegalAction, PlayerId, HeuristicBot } from '@poker/engine';
import { PokerTableLayout } from '../table/PokerTableLayout.js';
import { BetSizingControls } from './BetSizingControls.js';
import { ThoughtInput } from './ThoughtInput.js';
import { useEquity } from '../../hooks/useEquity.js';
import { estimateOwnEquity } from '../../hooks/equityClient.js';
import { useGameStore } from '../../store/gameStore.js';
import { usePracticeStore } from '../../store/practiceStore.js';
import { useThoughtsStore } from '../../store/thoughtsStore.js';
import type { HandAnnotations } from '../../types/thoughts.js';

const BOT_THINK_MS = 700;

interface Props {
  state: GameState;
  /** profile key per bot id, e.g. { bot1: 'nit' } */
  botProfileById: Record<string, string>;
  heroId?: string;
  showOdds?: boolean;
  onHandComplete: (annotations: HandAnnotations, finalStacks: Record<PlayerId, number>) => void;
}

export function PracticeTable({
  state,
  botProfileById,
  heroId = 'hero',
  showOdds = true,
  onHandComplete,
}: Props) {
  const appendAction = useGameStore(s => s.appendAction);
  const boardCards = usePracticeStore(s => s.boardCards);
  const { addThought, snapshot } = useThoughtsStore();

  const [autoPlay, setAutoPlay] = useState(true);
  const [thoughtText, setThoughtText] = useState('');
  const awardedRef = useRef(false);
  const completedRef = useRef(false);

  // One bot instance per bot id, rebuilt only when the profile map changes.
  const bots = useMemo(() => {
    const map: Record<string, HeuristicBot> = {};
    for (const [id, profileKey] of Object.entries(botProfileById)) {
      const name = state.players.find(p => p.id === id)?.name ?? id;
      map[id] = makeBot(profileKey, name);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(botProfileById)]);

  const currentId = whoseTurn(state);
  const isHeroTurn = currentId === heroId;
  const legal = legalActions(state);

  const boardCardsList = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  // Hero display equity (god-mode multiway, existing behaviour). Hidden when showOdds=false.
  const holeCards = state.players.map(p => p.holeCards);
  const { equities, isComputing } = useEquity(holeCards, boardCardsList, !state.isHandOver);

  const heroIdx = state.players.findIndex(p => p.id === heroId);
  const heroEquity = equities[heroIdx] ?? 0;
  const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);
  const currentBet = state.bettingRound.currentBet;
  const hero = state.players.find(p => p.id === heroId);
  const betToCall = hero ? Math.max(0, currentBet - hero.betThisStreet) : 0;

  // ── Hero action (captures thought) ─────────────────────────────────────────
  const handleHeroAction = useCallback((action: Action) => {
    addThought({
      actionId: action.id,
      actionIndex: state.actionLog.length,
      thought: thoughtText.trim(),
      equity: heroEquity,
      street: state.street,
      pot: totalPot,
      betToCall,
      takenActionType: action.type,
      timestamp: Date.now(),
    });
    appendAction(action);
    setThoughtText('');
  }, [thoughtText, heroEquity, state.street, state.actionLog.length, totalPot, betToCall, addThought, appendAction]);

  // ── Bot auto-play (sequenced; each bot estimates its OWN equity) ───────────
  useEffect(() => {
    if (!autoPlay || state.isHandOver) return;
    if (!currentId || !(currentId in bots)) return;
    if (legal.length === 0) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const me = state.players.find(p => p.id === currentId);
      const myHole = me?.holeCards ?? null;
      const opponentsInHand = state.players.filter(p => p.id !== currentId && p.status !== 'folded').length;

      let equity = 0.5;
      if (myHole) {
        try {
          equity = await estimateOwnEquity(myHole, opponentsInHand, boardCardsList, 400);
        } catch { /* fall back to 0.5 */ }
      }
      if (cancelled) return;

      const bot = bots[currentId]!;
      const action = bot.selectAction(state, legal, currentId, equity);
      appendAction({ ...action, id: nanoid(), timestamp: Date.now() });
    }, BOT_THINK_MS);

    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId, state, autoPlay, bots, legal, appendAction]);

  // ── Board dealing when a street's betting closes ───────────────────────────
  useEffect(() => {
    if (!boardCards || state.isHandOver) return;
    if (state.street === 'showdown' || state.street === 'finished') return;
    if (state.activePlayerIndex !== null) return;

    const dealerId = state.config.players[0]?.id ?? 'dealer';
    let dealAction: Action | null = null;
    if (!state.board.flop) {
      dealAction = { id: nanoid(), playerId: dealerId, timestamp: Date.now(), type: 'DEAL_BOARD', street: 'flop', cards: [boardCards[0], boardCards[1], boardCards[2]] };
    } else if (!state.board.turn) {
      dealAction = { id: nanoid(), playerId: dealerId, timestamp: Date.now(), type: 'DEAL_BOARD', street: 'turn', cards: [boardCards[3]] };
    } else if (!state.board.river) {
      dealAction = { id: nanoid(), playerId: dealerId, timestamp: Date.now(), type: 'DEAL_BOARD', street: 'river', cards: [boardCards[4]] };
    }
    if (!dealAction) return;

    const da = dealAction;
    const timer = setTimeout(() => appendAction(da), 450);
    return () => clearTimeout(timer);
  }, [
    state.board.flop, state.board.turn, state.board.river,
    state.activePlayerIndex, state.isHandOver, state.street,
    boardCards, appendAction, state.config.players,
  ]);

  // ── Showdown: auto-evaluate + award pots ───────────────────────────────────
  useEffect(() => {
    if (awardedRef.current) return;
    if (!state.board.river && state.street !== 'showdown') return;
    if (state.activePlayerIndex !== null) return;
    if (state.isHandOver) {
      if (!completedRef.current) {
        completedRef.current = true;
        const finalStacks = Object.fromEntries(state.players.map(p => [p.id, p.stack]));
        onHandComplete(snapshot(state.config.handId), finalStacks);
      }
      return;
    }

    const allPotsDone = state.sidePots.every(
      (_, i) => state.actionLog.some(a => a.type === 'AWARD_POT' && 'potIndex' in a && (a as { potIndex: number }).potIndex === i),
    );
    if (allPotsDone) return;

    awardedRef.current = true;
    const board = boardCardsList;

    for (let i = 0; i < state.sidePots.length; i++) {
      const pot = state.sidePots[i]!;
      const eligible = state.players.filter(p => pot.eligiblePlayerIds.includes(p.id) && p.status !== 'folded');
      if (eligible.length === 1) {
        appendAction({ id: nanoid(), playerId: eligible[0]!.id, timestamp: Date.now(), type: 'AWARD_POT', potIndex: i, winnerIds: [eligible[0]!.id], amount: pot.amount, oddChipWinnerId: null });
        continue;
      }
      const evaluated = eligible
        .filter(p => p.holeCards && board.length >= 3)
        .map(p => ({ player: p, rank: evaluateHand([...p.holeCards!, ...board]) }));
      if (evaluated.length === 0) continue;
      const best = evaluated.reduce((b, x) => compareHandRanks(x.rank, b.rank) > 0 ? x : b);
      const winners = evaluated.filter(x => compareHandRanks(x.rank, best.rank) === 0);
      appendAction({ id: nanoid(), playerId: winners[0]!.player.id, timestamp: Date.now(), type: 'AWARD_POT', potIndex: i, winnerIds: winners.map(w => w.player.id), amount: pot.amount, oddChipWinnerId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.board.river, state.street, state.activePlayerIndex, state.isHandOver, state.sidePots, state.actionLog.length, state.players, appendAction, onHandComplete, snapshot, state.config]);

  // ── Hand complete (after all pots awarded) ─────────────────────────────────
  useEffect(() => {
    if (completedRef.current) return;
    if (!awardedRef.current) return;
    const allAwarded = state.sidePots.every(
      (_, i) => state.actionLog.some(a => a.type === 'AWARD_POT' && 'potIndex' in a && (a as { potIndex: number }).potIndex === i),
    );
    if (!allAwarded || state.sidePots.length === 0) return;

    completedRef.current = true;
    const finalStacks = Object.fromEntries(state.players.map(p => [p.id, p.stack]));
    setTimeout(() => onHandComplete(snapshot(state.config.handId), finalStacks), 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.actionLog.length, state.sidePots, state.players, onHandComplete, snapshot, state.config.handId]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 24 }}>
      <PokerTableLayout
        state={state}
        heroId={heroId}
        equities={equities}
        isComputingEquity={isComputing}
        showOdds={showOdds}
      />

      <div style={{ padding: '0 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, minHeight: 28 }}>
          <span style={{ fontSize: '0.85rem' }}>
            {isHeroTurn
              ? <span style={{ color: 'var(--color-gold)', fontWeight: 700 }}>Your turn</span>
              : currentId
                ? <span style={{ color: 'var(--color-text-dim)' }}>{state.players.find(p => p.id === currentId)?.name ?? currentId} thinking…</span>
                : null}
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer', color: 'var(--color-text-dim)' }}>
            <input type="checkbox" checked={autoPlay} onChange={e => setAutoPlay(e.target.checked)} />
            Auto-play bots
          </label>
        </div>

        {isHeroTurn && legal.length > 0 && (
          <>
            <ThoughtInput
              equity={heroEquity}
              pot={totalPot}
              betToCall={betToCall}
              value={thoughtText}
              onChange={setThoughtText}
            />
            <BetSizingControls
              legal={legal as LegalAction[]}
              pot={totalPot}
              playerId={heroId}
              onAction={handleHeroAction}
            />
          </>
        )}
      </div>
    </div>
  );
}
