import { useMemo } from 'react';
import { legalActions } from '@poker/engine';
import type { GameState, LegalAction } from '@poker/engine';

export function useLegalActions(state: GameState | null): LegalAction[] {
  return useMemo(() => {
    if (!state) return [];
    return legalActions(state);
  }, [state]);
}
