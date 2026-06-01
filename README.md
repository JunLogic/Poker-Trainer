# Poker Umpire & Practice

A No-Limit Texas Hold'em referee tool and solo practice app. Runs as an installable PWA on iOS, Android, and desktop.

## Quick start

```bash
# Node ≥18 required. If not installed:
# curl -fsSL https://install-node.vercel.app/lts | bash -s -- --prefix=$HOME/.node --yes

npm install
npm run dev          # → http://localhost:5173
npm run test         # engine unit tests (56 tests)
npm run build        # production PWA bundle → packages/web/dist/
```

## Modes

### Umpire mode
Physical cards sit on the table. You type every action (fold, call, raise, bet). The app:
- Enforces legality and shows exactly whose turn it is and their legal options
- Tracks every stack and pot precisely, including multi-way side pots
- At showdown, enter each player's cards via the card picker — the evaluator determines the winner automatically

### Practice mode
Virtual deck, Monte Carlo equity bar, and a heuristic bot opponent:
- Your hole cards are visible; the bot's cards flip face-up at showdown
- Real-time equity bar updates on every street via a Comlink web worker (never blocks the main thread)
- SimpleCoach shows a post-action hint comparing your equity to pot odds
- Auto-play toggle lets the bot act with a 600 ms delay (human-like pacing)

### Hand history
Every completed hand is stored in IndexedDB and survives reloads. Step through any past hand action-by-action with the replay viewer.

## Installing as a PWA

1. `npm run build && npx serve packages/web/dist` (or deploy the `dist/` folder)
2. **iOS Safari**: tap the Share icon → "Add to Home Screen"
3. **Android Chrome**: tap the three-dot menu → "Add to Home Screen" / "Install App"
4. **Desktop Chrome**: click the install icon in the address bar

## Monorepo structure

```
packages/
  engine/          Pure TypeScript — zero UI deps, importable in Node for tests
    src/
      types.ts     All shared types (Card, Player, GameState, all Action variants…)
      applyAction  Pure reducer: applyAction(state, action) → GameState
      legalActions legalActions(state) → LegalAction[]
      whoseTurn    whoseTurn(state) → PlayerId | null
      sidePot      buildSidePots(players) + computeAward (odd-chip rule)
      bettingRound isBettingRoundClosed, advanceStreet, nextActiveIndex
      deck         createDeck(), shuffle(seed) — deterministic for tests
      handEvaluator evaluate(7 cards) → HandRank  [C(7,5) + comparison]
      monteCarlo   estimateEquity(holeCards, board, iters, seed?) → number[]
      bot          PokerBot interface + HeuristicBot (easy/medium/hard)
      coach        Coach interface + SimpleCoach stub
      state        createInitialState(config) → GameState
  web/             React + Vite PWA
    src/
      store/       Zustand: gameStore (actionLog only), settingsStore, historyStore
      db/          idb: openHandDb, saveHand, listHands
      hooks/       useGameState (memoised replay), useLegalActions, useEquity, useBot
      workers/     equity.worker.ts — Comlink-wrapped Monte Carlo
      components/  Umpire, Practice, History, common UI
```

## Architecture: event sourcing

The action log is the single source of truth. `GameState` is never persisted directly — it is always derived by replaying the log:

```typescript
function replayLog(config, log) {
  let state = createInitialState(config);
  for (const action of log) state = applyAction(state, action);
  return state;
}
```

This gives hand-history replay for free: pass `actionLog.slice(0, step)` to get state at any point in time.

## Extension points

### CFR bot (drop-in replacement)
Replace `HeuristicBot` with any class implementing `PokerBot`:

```typescript
// packages/engine/src/bot.ts
export class CfrBot implements PokerBot {
  selectAction(state, legal, myId, equity): Action {
    // Implement counterfactual regret minimisation here
  }
}
```

No changes required in the engine or UI.

### Post-hand coach (LLM integration)
`packages/engine/src/coach.ts` exports the `Coach` interface:

```typescript
export interface Coach {
  analyse(stateBefore: GameState, actionTaken: Action, equity: number): CoachAnalysis;
}
```

Replace `SimpleCoach` with an implementation that calls an LLM with the serialised hand log and equity at each decision point. Wire it into `PracticeTable.tsx`.

## Running tests

```bash
npm run test                        # all tests, single run
npm run test:watch --workspace=packages/engine   # watch mode
npm run test:coverage --workspace=packages/engine # coverage report
```

Key test scenarios covered:
- **Side pots**: single all-in, two all-ins at different levels, three-way cascade, odd-chip rule
- **Betting round closure**: pre-flop BB option, all-in shortstack, post-flop multi-way
- **Min-raise rule**: full raise updates `lastRaiseSize`; incomplete all-in does not
- **Legal actions**: check/bet with no open bet, fold/call/raise with bet, all-in when stack insufficient
- **Hand evaluator**: all nine hand categories + kicker resolution + wheel straight
- **Monte Carlo equity**: AA vs KK ≈ 81%, sum-to-1 invariant, deterministic seeds
