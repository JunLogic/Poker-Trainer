# Poker Umpire & Practice

A No-Limit Texas Hold'em referee tool and solo practice app. Runs as an installable PWA on iOS, Android, and desktop.

## Quick start

```bash
# Node ≥18 required. If not installed:
# curl -fsSL https://install-node.vercel.app/lts | bash -s -- --prefix=$HOME/.node --yes

npm install
npm run dev          # → http://localhost:5173
npm run dev:host     # → expose on your LAN for phone testing (vite --host)
npm run test         # engine unit tests (83 tests)
npm run build        # production PWA bundle → packages/web/dist/
npm run gen:icons    # regenerate PWA app icons (felt + gold spade)
```

## Modes

### Umpire mode
Physical cards sit on the table. You type every action (fold, call, raise, bet). The app:
- Enforces legality and shows exactly whose turn it is and their legal options
- Tracks every stack and pot precisely, including multi-way side pots
- At showdown, enter each player's cards via the card picker — the evaluator determines the winner automatically

### Practice mode — multiway matches
Practice mode plays a **full match**: hero + 1–5 bots, hands played in sequence until one
player remains.
- **Match layer** carries each player's stack into the next hand, rotates the dealer button,
  posts blinds correctly for both multiway and the **heads-up exception** (button is SB and
  acts first preflop; BB acts first postflop), eliminates busted players, and declares a winner.
  It's a pure, event-sourced module (`packages/engine/src/match.ts`) that composes the
  per-hand engine — it never mutates engine state.
- Visual table (responsive — oval felt on desktop, stacked column on mobile): pure-CSS
  rendered cards, your hole cards face-up, bots' face-down until showdown, community cards
  revealed street-by-street.
- Live **equity** display (your win % via Monte Carlo in a web worker). Hide it with the
  **odds toggle** in match setup — equity is still computed (bots and future coaching need it),
  just not shown.
- Action controls driven entirely by the engine's `legalActions()`: quick-size buttons
  (½ pot, ¾ pot, pot, all-in) plus a slider/numeric input bounded by min-raise and all-in.
- Bots act on a short delay so the table is followable in multiway. Each bot estimates its
  **own** equity (its hole cards vs random opponents — public info only), never peeking at
  others' cards.
- After each hand: an **interstitial** shows the result, stack changes, eliminations, and
  your decisions + thoughts. After the match: a **results** screen with final standings,
  **session stats**, and **JSON export**.
- **Thoughts log**: before committing each of your decisions, an optional field lets you jot
  your reasoning (equity %, pot, and pot-odds shown automatically). Never required — skip and
  play proceeds.

### Opponent profiles
Bots are modelled on two independent axes plus an error model
(`packages/engine/src/bot.ts`, behind the `PokerBot` interface):
- **Skill** — error rate ε (chance of deviating from the intended line) + Gaussian noise on
  the bot's equity read. Lower ε = sharper play.
- **Style** — tightness (how much equity it needs to continue), aggression (raise-vs-call),
  bluff frequency, and a pot-fraction **sizing band** (bets/raises are jittered within it,
  always clamped to legal min/max). Near the equity≈pot-odds indifference point the bot
  **mixes** instead of playing a hard line.

Four presets, selectable per opponent in setup:

| Profile | Feel |
|---|---|
| **The Nit** | very tight / passive, low error |
| **The Calling Station** | loose / passive, over-calls |
| **The Maniac** | loose / hyper-aggressive, bluffs and over-bets |
| **The TAG Reg** | tight-aggressive, low error, near-solid |

A CFR bot can still be dropped in later by implementing `PokerBot` — no engine or UI changes.

### Session stats & export
- The **results** screen shows VPIP, PFR, Aggression Factor, hands played, and net chips per
  player, computed purely from the action log (`packages/engine/src/stats.ts`).
- **Export JSON** downloads one self-contained file for the match: config, every hand's action
  log, your thought annotations, final results, session stats, **and a human-readable
  transcript** per decision (street, board, pot, stacks, action taken, your equity + thought) —
  structured so you can paste it into an LLM for review without replaying the engine.

### Thoughts log — how to use
1. Play a practice hand. When it's your turn, a text area appears above the action buttons showing your equity and pot odds.
2. Type your reasoning (or leave it blank and click an action to skip).
3. When the hand ends the **interstitial** shows every one of your decisions: street, pot, action taken, and your logged thought, alongside the stack changes and any eliminations.
4. In **Hand History → Replay**, step through any past hand. At each of your decision steps a gold quote block appears inline showing the thought you logged at that moment plus the equity and pot context.

The thoughts are stored as a parallel annotation map (keyed by `Action.id`) — completely separate from the engine's pure action types. They're persisted in IndexedDB alongside the hand record.

### Hand history
Every completed hand is stored in IndexedDB and survives reloads. Step through any past hand action-by-action with the replay viewer.

## Installing as a PWA

App icons (192/512 + maskable) live in `packages/web/public/icons/` and are generated by
`npm run gen:icons`. To test install on a phone over your LAN:

1. `npm run dev:host` and open the printed `http://<your-ip>:5173` on the phone (same Wi-Fi),
   or ship a build: `npm run build && npx serve packages/web/dist`.
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
      match        createMatch / startNextHand / applyHandResult / assignBlinds (HU-aware)
      stats        computePlayerStats / computeAllStats (VPIP/PFR/AF/net)
      bot          PokerBot interface + HeuristicBot(BotProfile) + BOT_PROFILES + CfrBot stub
      coach        Coach interface + SimpleCoach stub
      state        createInitialState(config) → GameState
  web/             React + Vite PWA
    src/
      types/       thoughts.ts — ThoughtEntry + HandAnnotations (parallel annotation layer)
      store/       Zustand: gameStore (actionLog), matchStore, thoughtsStore, practiceStore, historyStore
      db/          idb v2: hands + annotations object stores
      hooks/       useGameState, useLegalActions, useEquity, equityClient (bot worker)
      workers/     equity.worker.ts — Comlink-wrapped Monte Carlo
      export/      exportMatch.ts — self-contained match JSON + transcript
      components/
        cards/     PlayingCard — pure CSS/HTML, no image assets, 4 sizes
        table/     PokerTableLayout (responsive oval, 2–6 seats), SeatCard
        practice/  PracticeMatch (orchestrator), MatchSetup, PracticeTable, MatchInterstitial,
                   MatchResults, StatsPanel, BetSizingControls, ThoughtInput, practiceFlow
        history/   HandHistoryList, HandReplayViewer (thoughts inline), HandSummaryView
        umpire/    UmpireTable, UmpireSetup, ShowdownPanel, BettingControls
        common/    ActionButtons, CardPicker, ChipDisplay, PlayerSeat
  scripts/
    gen-icons.mjs  dependency-free PWA icon generator (192/512 PNG + svg)
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
Bots are configured by a `BotProfile` and constructed via `makeBot(profileKey)`, all behind
the `PokerBot` interface. Drop in a CFR bot by implementing that interface:

```typescript
// packages/engine/src/bot.ts
export class CfrBot implements PokerBot {
  selectAction(state, legal, myId, equity): Action {
    // Implement counterfactual regret minimisation here
  }
}
```

No changes required in the engine or UI. Each bot receives only public state + its own
pre-computed equity, so it cannot peek at opponents' cards.

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

Key test scenarios covered (83 tests):
- **Side pots**: single all-in, two all-ins at different levels, three-way cascade, odd-chip rule
- **Betting round closure**: pre-flop BB option, all-in shortstack, post-flop multi-way
- **Min-raise rule**: full raise updates `lastRaiseSize`; incomplete all-in does not
- **Legal actions**: check/bet with no open bet, fold/call/raise with bet, all-in when stack insufficient
- **Hand evaluator**: all nine hand categories + kicker resolution + wheel straight
- **Monte Carlo equity**: AA vs KK ≈ 81%, sum-to-1 invariant, deterministic seeds
- **Match layer**: stack carryover, button rotation skipping eliminations, heads-up vs 3-handed
  blind posting + first-to-act verified through the real engine, elimination/match-over
- **Bots**: ε=0 plays best action, ε=1 deviates, calling-station continues > nit, sizing stays
  within legal bounds + varies, never reads opponents' hole cards
- **Session stats**: VPIP/PFR fractions, aggression factor, zero-sum net chips, match filtering
