import { useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { HeuristicBot, whoseTurn, legalActions } from '@poker/engine';
import type { GameState } from '@poker/engine';
import { useGameStore } from '../store/gameStore.js';

const BOT_THINK_MS = 600;

/**
 * When autoPlay is true and it's a bot's turn, fires the bot's action
 * after BOT_THINK_MS milliseconds. Bot player IDs are passed via botIds.
 */
export function useBot(
  state: GameState | null,
  botIds: readonly string[],
  autoPlay: boolean,
  equities: readonly number[],
): void {
  const appendAction = useGameStore(s => s.appendAction);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bot = useRef(new HeuristicBot('Heuristic Bot', 'medium'));

  useEffect(() => {
    if (!autoPlay || !state || state.isHandOver) return;

    const currentId = whoseTurn(state);
    if (!currentId || !botIds.includes(currentId)) return;

    const legal = legalActions(state);
    if (legal.length === 0) return;

    const playerIdx = state.players.findIndex(p => p.id === currentId);
    const equity = equities[playerIdx] ?? 0.5;

    timerRef.current = setTimeout(() => {
      const action = bot.current.selectAction(state, legal, currentId, equity);
      appendAction({ ...action, id: nanoid(), timestamp: Date.now() });
    }, BOT_THINK_MS);

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [state, botIds, autoPlay, equities, appendAction]);
}
