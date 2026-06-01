import { useMemo } from 'react';
import { useGameStore, replayLog } from '../store/gameStore.js';
import type { GameState } from '@poker/engine';

/**
 * Derives current GameState by replaying the action log.
 * Memoised — only re-computes when config or actionLog changes.
 */
export function useGameState(): GameState | null {
  const config = useGameStore(s => s.config);
  const actionLog = useGameStore(s => s.actionLog);

  return useMemo(() => {
    if (!config) return null;
    return replayLog(config, actionLog);
  }, [config, actionLog]);
}
