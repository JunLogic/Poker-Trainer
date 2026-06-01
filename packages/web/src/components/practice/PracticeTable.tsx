import { useState, useEffect, useRef, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { whoseTurn, legalActions, evaluateHand, compareHandRanks, HeuristicBot } from '@poker/engine';
import type { GameState, Action, LegalAction } from '@poker/engine';
import { PokerTableLayout } from '../table/PokerTableLayout.js';
import { BetSizingControls } from './BetSizingControls.js';
import { ThoughtInput } from './ThoughtInput.js';
import { useEquity } from '../../hooks/useEquity.js';
import { useGameStore } from '../../store/gameStore.js';
import { usePracticeStore } from '../../store/practiceStore.js';
import { useThoughtsStore } from '../../store/thoughtsStore.js';
import type { HandAnnotations } from '../../types/thoughts.js';

const BOT_THINK_MS = 700;

interface Props {
  state: GameState;
  botIds: readonly string[];
  difficulty: 'easy' | 'medium' | 'hard';
  heroId?: string;
  onHandComplete: (annotations: HandAnnotations) => void;
}

export function PracticeTable({
  state,
  botIds,
  difficulty,
  heroId = 'hero',
  onHandComplete,
}: Props) {
  const appendAction = useGameStore(s => s.appendAction);
  const boardCards = usePracticeStore(s => s.boardCards);
  const { addThought, snapshot } = useThoughtsStore();

  const [autoPlay, setAutoPlay] = useState(true);
  const [thoughtText, setThoughtText] = useState('');
  // Prevent double-awarding pots at showdown
  const awardedRef = useRef(false);
  // Prevent firing onHandComplete more than once per hand
  const completedRef = useRef(false);
  const botRef = useRef(new HeuristicBot('Bot', difficulty));

  const currentId = whoseTurn(state);
  const isHeroTurn = currentId === heroId;
  const legal = legalActions(state);

  const boardCardsList = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  const holeCards = state.players.map(p => p.holeCards);
  const { equities, isComputing } = useEquity(holeCards, boardCardsList, !state.isHandOver);

  const heroIdx = state.players.findIndex(p => p.id === heroId);
  const heroEquity = equities[heroIdx] ?? 0;
  const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);
  const currentBet = state.bettingRound.currentBet;
  const hero = state.players.find(p => p.id === heroId);
  const betToCall = hero ? Math.max(0, currentBet - hero.betThisStreet) : 0;

  // ── Action dispatch (hero path — captures thought) ────────────────────────
  const handleHeroAction = useCallback((action: Action) => {
    const actionIndex = state.actionLog.length;

    // Save thought (even if empty — preserves context for coach)
    addThought({
      actionId: action.id,
      actionIndex,
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

  // ── Bot auto-play ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoPlay || !currentId || !botIds.includes(currentId)) return;
    if (state.isHandOver) return;
    if (legal.length === 0) return;

    const playerIdx = state.players.findIndex(p => p.id === currentId);
    const equity = equities[playerIdx] ?? 0.5;

    const timer = setTimeout(() => {
      const action = botRef.current.selectAction(state, legal, currentId, equity);
      appendAction({ ...action, id: nanoid(), timestamp: Date.now() });
    }, BOT_THINK_MS);

    return () => clearTimeout(timer);
  }, [currentId, state, botIds, autoPlay, equities, legal, appendAction]);

  // ── Board dealing: deal street cards when betting round closes ────────────
  useEffect(() => {
    if (!boardCards || state.isHandOver) return;
    if (state.street === 'showdown' || state.street === 'finished') return;

    // Only deal when nobody needs to act
    if (state.activePlayerIndex !== null) return;

    const dealerId = state.config.players[0]?.id ?? 'dealer';

    let dealAction: Action | null = null;
    if (!state.board.flop) {
      dealAction = {
        id: nanoid(), playerId: dealerId, timestamp: Date.now(),
        type: 'DEAL_BOARD', street: 'flop',
        cards: [boardCards[0], boardCards[1], boardCards[2]],
      };
    } else if (!state.board.turn) {
      dealAction = {
        id: nanoid(), playerId: dealerId, timestamp: Date.now(),
        type: 'DEAL_BOARD', street: 'turn',
        cards: [boardCards[3]],
      };
    } else if (!state.board.river) {
      dealAction = {
        id: nanoid(), playerId: dealerId, timestamp: Date.now(),
        type: 'DEAL_BOARD', street: 'river',
        cards: [boardCards[4]],
      };
    }

    if (!dealAction) return;

    // Small delay gives the street transition a visual beat
    const da = dealAction;
    const timer = setTimeout(() => appendAction(da), 450);
    return () => clearTimeout(timer);
  }, [
    state.board.flop, state.board.turn, state.board.river,
    state.activePlayerIndex, state.isHandOver, state.street,
    boardCards, appendAction, state.config.players,
  ]);

  // ── Showdown: auto-evaluate and award pots ────────────────────────────────
  useEffect(() => {
    if (awardedRef.current) return;
    if (!state.board.river && state.street !== 'showdown') return;
    if (state.activePlayerIndex !== null) return;
    if (state.isHandOver) {
      // Hand ended via fold — trigger summary
      if (!completedRef.current) {
        completedRef.current = true;
        onHandComplete(snapshot(state.config.handId));
      }
      return;
    }

    const allPotsDone = state.sidePots.every(
      (_, i) => state.actionLog.some(a => a.type === 'AWARD_POT' && 'potIndex' in a && (a as { potIndex: number }).potIndex === i)
    );
    if (allPotsDone) return;

    awardedRef.current = true;

    const board = [
      ...(state.board.flop ?? []),
      ...(state.board.turn ? [state.board.turn] : []),
      ...(state.board.river ? [state.board.river] : []),
    ];

    const dealerId = state.config.players[0]?.id ?? 'dealer';

    for (let i = 0; i < state.sidePots.length; i++) {
      const pot = state.sidePots[i]!;
      const eligible = state.players.filter(p => pot.eligiblePlayerIds.includes(p.id) && p.status !== 'folded');

      if (eligible.length === 1) {
        appendAction({
          id: nanoid(), playerId: eligible[0]!.id, timestamp: Date.now(),
          type: 'AWARD_POT', potIndex: i,
          winnerIds: [eligible[0]!.id], amount: pot.amount, oddChipWinnerId: null,
        });
        continue;
      }

      const evaluated = eligible
        .filter(p => p.holeCards && board.length >= 3)
        .map(p => ({ player: p, rank: evaluateHand([...p.holeCards!, ...board]) }));

      if (evaluated.length === 0) continue;

      const best = evaluated.reduce((b, x) => compareHandRanks(x.rank, b.rank) > 0 ? x : b);
      const winners = evaluated.filter(x => compareHandRanks(x.rank, best.rank) === 0);

      appendAction({
        id: nanoid(), playerId: winners[0]!.player.id, timestamp: Date.now(),
        type: 'AWARD_POT', potIndex: i,
        winnerIds: winners.map(w => w.player.id),
        amount: pot.amount, oddChipWinnerId: null,
      });
    }
  }, [
    state.board.river, state.street, state.activePlayerIndex,
    state.isHandOver, state.sidePots, state.actionLog.length,
    state.players, appendAction, onHandComplete, snapshot, state.config,
  ]);

  // ── Detect hand complete (after all pots awarded) ─────────────────────────
  useEffect(() => {
    if (completedRef.current) return;
    if (!awardedRef.current) return;

    const allAwarded = state.sidePots.every(
      (_, i) => state.actionLog.some(a => a.type === 'AWARD_POT' && 'potIndex' in a && (a as { potIndex: number }).potIndex === i)
    );
    if (!allAwarded || state.sidePots.length === 0) return;

    completedRef.current = true;
    // Small delay so the final award is visible before overlay appears
    setTimeout(() => onHandComplete(snapshot(state.config.handId)), 800);
  }, [state.actionLog.length, state.sidePots, onHandComplete, snapshot, state.config.handId]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', paddingBottom: 24 }}>
      {/* Visual table */}
      <PokerTableLayout
        state={state}
        heroId={heroId}
        equities={equities}
        isComputingEquity={isComputing}
      />

      {/* Action area */}
      <div style={{ padding: '0 12px' }}>
        {/* Turn indicator */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 8, minHeight: 28,
        }}>
          <span style={{ fontSize: '0.85rem' }}>
            {isHeroTurn
              ? <span style={{ color: 'var(--color-gold)', fontWeight: 700 }}>Your turn</span>
              : currentId
                ? <span style={{ color: 'var(--color-text-dim)' }}>
                    {state.players.find(p => p.id === currentId)?.name ?? currentId} thinking…
                  </span>
                : null
            }
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer', color: 'var(--color-text-dim)' }}>
            <input type="checkbox" checked={autoPlay} onChange={e => setAutoPlay(e.target.checked)} />
            Auto-play bots
          </label>
        </div>

        {/* Hero action controls */}
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
