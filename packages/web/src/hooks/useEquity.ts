import { useEffect, useRef, useState } from 'react';
import { wrap } from 'comlink';
import type { Card } from '@poker/engine';

interface EquityWorker {
  estimateEquity(
    holeCards: readonly (readonly [Card, Card] | null)[],
    board: readonly Card[],
    iterations: number,
  ): Promise<number[]>;
}

interface EquityState {
  equities: number[];
  isComputing: boolean;
}

/**
 * Runs Monte Carlo equity estimation off the main thread via a Comlink worker.
 * Re-computes whenever holeCards or board changes.
 * Uses a generation counter to discard stale results.
 */
export function useEquity(
  holeCards: readonly (readonly [Card, Card] | null)[],
  board: readonly Card[],
  enabled = true,
  iterations = 2000,
): EquityState {
  const workerRef = useRef<EquityWorker | null>(null);
  const generationRef = useRef(0);
  const [state, setState] = useState<EquityState>({ equities: [], isComputing: false });

  // Initialise worker once
  useEffect(() => {
    const worker = new Worker(new URL('../workers/equity.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = wrap<EquityWorker>(worker);
    return () => worker.terminate();
  }, []);

  // Run equity computation when inputs change
  useEffect(() => {
    if (!enabled || holeCards.length === 0 || !workerRef.current) return;

    const gen = ++generationRef.current;
    setState(s => ({ ...s, isComputing: true }));

    workerRef.current
      .estimateEquity(holeCards, board, iterations)
      .then(equities => {
        if (gen === generationRef.current) {
          setState({ equities, isComputing: false });
        }
      })
      .catch(() => {
        if (gen === generationRef.current) {
          setState(s => ({ ...s, isComputing: false }));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Deep-compare via JSON serialisation (holeCards/board are small arrays)
    JSON.stringify(holeCards),
    JSON.stringify(board),
    enabled,
    iterations,
  ]);

  return state;
}
