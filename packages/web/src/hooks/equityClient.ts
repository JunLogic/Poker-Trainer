import { wrap } from 'comlink';
import type { Card } from '@poker/engine';

/**
 * Shared singleton Comlink worker for on-demand equity estimates.
 *
 * Used for BOT decisions: a bot estimates its OWN equity from its hole cards vs
 * N random opponents (public info only), at a reduced iteration count so up to
 * 5 bots never stall the UI. Hero's display equity has its own hook (useEquity).
 */
interface EquityApi {
  estimateEquity(
    holeCards: readonly (readonly [Card, Card] | null)[],
    board: readonly Card[],
    iterations: number,
  ): Promise<number[]>;
}

let api: EquityApi | null = null;

function getApi(): EquityApi {
  if (!api) {
    const worker = new Worker(new URL('../workers/equity.worker.ts', import.meta.url), { type: 'module' });
    api = wrap<EquityApi>(worker);
  }
  return api;
}

/**
 * Estimate the equity of `myHole` against `opponents` unknown hands on `board`.
 * Returns a probability in [0,1]. Reduced default iterations keep it phone-fast.
 */
export async function estimateOwnEquity(
  myHole: readonly [Card, Card],
  opponents: number,
  board: readonly Card[],
  iterations = 400,
): Promise<number> {
  const hole = [myHole, ...Array<null>(Math.max(1, opponents)).fill(null)];
  const res = await getApi().estimateEquity(hole, board, iterations);
  return res[0] ?? 0.5;
}
