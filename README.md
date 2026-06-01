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
Visual poker table UI (responsive — oval felt on desktop, stacked column on mobile):
- Rendered playing cards (pure CSS, scales crisply, no image assets): your hole cards face-up, bot's face-down until showdown
- Community cards revealed street-by-street with a short visual pause; board auto-dealt, blinds auto-posted
- Live equity bar (your win % via Monte Carlo, runs in a web worker off the main thread)
- Action controls driven by the engine's `legalActions()`: quick-size buttons (½ pot, ¾ pot, pot, all-in) plus a slider and numeric input bounded by the engine's min-raise and all-in
- Bot auto-plays with a 700 ms delay so moves are readable; toggle off to step through manually
- **Thoughts log**: before (or just after) each of your decisions, an optional text field lets you jot your reasoning. Equity %, pot, and pot-odds context are shown automatically. Thoughts are never required — skip and play proceeds immediately.

### Thoughts log — how to use
1. Play a practice hand. When it's your turn, a text area appears above the action buttons showing your equity and pot odds.
2. Type your reasoning (or leave it blank and click an action to skip).
3. When the hand ends a **Hand Summary** overlay shows every one of your decisions in a table: street, pot, equity, action taken, and your logged thought.
4. In **Hand History → Replay**, step through any past hand. At each of your decision steps a gold quote block appears inline showing the thought you logged at that moment plus the equity and pot context.

The thoughts are stored as a parallel annotation map (keyed by `Action.id`) — completely separate from the engine's pure action types. They're persisted in IndexedDB alongside the hand record.

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
      types/       thoughts.ts — ThoughtEntry + HandAnnotations (parallel annotation layer)
      store/       Zustand: gameStore (actionLog), thoughtsStore, practiceStore, historyStore
      db/          idb v2: hands + annotations object stores
      hooks/       useGameState (memoised replay), useLegalActions, useEquity
      workers/     equity.worker.ts — Comlink-wrapped Monte Carlo
      components/
        cards/     PlayingCard — pure CSS/HTML, no image assets, 4 sizes
        table/     PokerTableLayout (responsive oval), SeatCard
        practice/  PracticeTable, BetSizingControls (quick-size buttons), ThoughtInput
        history/   HandHistoryList, HandReplayViewer (thoughts inline), HandSummaryView
        umpire/    UmpireTable, UmpireSetup, ShowdownPanel, BettingControls
        common/    ActionButtons, CardPicker, ChipDisplay, PlayerSeat
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
