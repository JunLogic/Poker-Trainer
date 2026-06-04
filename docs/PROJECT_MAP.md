# PROJECT MAP — Poker Umpire & Practice

Handoff document for resuming work cold. Everything below is derived from the actual
codebase at the commit noted at the bottom. Where the brief that requested this doc
described features that do not exist, the reality is documented and flagged **⚠️ drift**.

---

## Purpose & modes

A No-Limit Texas Hold'em **referee + practice** app, shipped as an installable PWA.
Two modes share one pure rules engine:

- **Umpire mode** — physical cards on a real table. No virtual deck, no card visuals for
  hole cards, no equity. You type each action; the app enforces legality, tracks stacks/pots
  (incl. multiway side pots), shows whose turn it is and legal options, and at showdown you
  enter the players' cards so the evaluator can pick the winner.
- **Practice mode** — virtual shuffled deck, on-screen CSS-rendered cards, **multiway match
  vs bots** (hero + 1–5 bots), Monte-Carlo equity, per-decision "thoughts log".
  ⚠️ drift: practice is **multiway (2–6 players)**, not heads-up-only; heads-up is just the
  default (1 bot).

---

## Monorepo structure

npm workspaces (root `package.json`, `workspaces: ["packages/*"]`).

| Package | Owns | Build output |
|---|---|---|
| `packages/engine` (`@poker/engine`) | Pure TS rules engine + match/stats/bot/coach logic. Zero UI/DOM deps. Only runtime dep: `nanoid`. | `packages/engine/dist` (tsc) |
| `packages/web` (`@poker/web`) | React 18 + Vite PWA. Consumes `@poker/engine`. | `packages/web/dist` (tsc + vite) |

Engine is importable in Node for tests (Vitest). Web is the only package with DOM deps
(react, zustand, idb, comlink, vite-plugin-pwa).

---

## Engine architecture (pure state machine)

The engine **never does I/O** — no printing, no network, no storage, no `Date`-driven
control flow in rule logic. It is a set of pure functions over immutable `GameState`.
All files under `packages/engine/src/`.

Three public entry points (consumed by the UI and bots):
- `applyAction(state, action) => GameState` — `applyAction.ts` (the reducer)
- `legalActions(state) => LegalAction[]` — `legalActions.ts`
- `whoseTurn(state) => PlayerId | null` — `whoseTurn.ts`

Supporting pure modules:
- `state.ts` — `createInitialState(config)` builds the pre-deal `GameState`.
- `bettingRound.ts` — `isBettingRoundClosed`, `isHandForfeited`, `getActivePlayers`,
  `nextStreet`, `nextActiveIndex`, `resetStreetBets`.
- `sidePot.ts` — `buildSidePots(players)`, `computeAward(input)` (odd-chip rule).
- `handEvaluator.ts` — `evaluateHand(cards) => HandRank`, `compareHandRanks(a,b)`.
- `deck.ts` — `createDeck()`, `shuffle(deck, seed?)` (seedable LCG for determinism).
- `monteCarlo.ts` — `estimateEquity(holeCards, board, iterations?, deadCards?, seed?) => number[]`.
- `constants.ts` — `RANKS`, `SUITS`, `RANK_VALUE`, `HAND_CATEGORY_RANK`.
- `types.ts` — all shared types (single source of truth; see below).
- `match.ts`, `stats.ts`, `bot.ts`, `coach.ts` — documented in their own sections.

Re-exports: `packages/engine/src/index.ts` is the barrel; the web app imports everything
from `@poker/engine`.

Core types (`types.ts`): `Card`, `Rank`, `Suit`, `PlayerId`, `PlayerStatus`, `Player`,
`SidePot`, `Street`, `GameMode`, `Board`, `PlayerSetup`, `GameConfig`, `BettingRoundState`,
`GameState`, the `Action` union (`POST_BLIND`, `POST_ANTE`, `DEAL_HOLE_CARDS`, `DEAL_BOARD`,
`FOLD`, `CHECK`, `CALL`, `BET`, `RAISE`, `ALL_IN`, `REVEAL_CARDS`, `AWARD_POT`, `MUCK_CARDS`),
the `LegalAction` union, `HandRank`/`HandCategory`, `PokerBot`, `Coach`/`CoachAnalysis`,
`HandSummary`, `HandRecord`.

---

## Event-sourcing model

The **ordered action log is the single source of truth.** `GameState` is never stored;
it is always derived by replaying the log from the initial state:

```ts
// packages/web/src/store/gameStore.ts
export function replayLog(config, log) {
  let state = createInitialState(config);
  for (const action of log) state = applyAction(state, action);
  return state;
}
```

- Live state lives only as `{ config, actionLog }` in `gameStore`; the derived `GameState`
  is memoised in `useGameState()` (`hooks/useGameState.ts`).
- Replay is free: `replayLog(config, log.slice(0, step))` yields state at any point — this
  powers the hand-replay viewer and the export transcript.
- **Determinism is load-bearing.** Every action carries a `nanoid` `id` + `timestamp`, but
  rule outcomes depend only on the action contents, not wall-clock time. Do not introduce
  nondeterminism into replay.

---

## Action-log & annotation system

User reasoning ("thoughts log") attaches to actions through a **parallel annotation map**,
NOT inside the engine's action types.

- Shape: `packages/web/src/types/thoughts.ts`
  - `ThoughtEntry { actionId, actionIndex, thought, equity, street, pot, betToCall, takenActionType, timestamp }`
  - `HandAnnotations { handId, thoughts: Record<actionId, ThoughtEntry>, strategyVerdicts?: Record<actionId, StrategyVerdict> }`
- **Key scheme:** both `thoughts` and `strategyVerdicts` are keyed by the engine `Action.id`
  (the `nanoid` on the action the annotation concerns). `actionIndex` additionally records the
  position in `actionLog` for thoughts.
- In-memory store: `store/thoughtsStore.ts` (`thoughts`, `strategyVerdicts`,
  `latestStrategyVerdictId`, `addThought`, `addStrategyVerdict`, `clearThoughts`,
  `snapshot(handId) => HandAnnotations`).
- Capture point: `PracticeTable` calls `addThought(...)` and `addStrategyVerdict(...)` when the
  hero acts (see practice flow).
- Engine `Action` types remain unchanged; strategy feedback is annotation-only.

---

## Persistence (IndexedDB)

Module: `packages/web/src/db/handDb.ts` (via `idb`). Database `poker-app`, **version 2**.

| Object store | keyPath | Indexes | Contents |
|---|---|---|---|
| `hands` | `handId` | `by-date` → `startedAt` | `HandRecord` (config + full actionLog + summary) |
| `annotations` | `handId` | — | `HandAnnotations` (thoughts + optional strategy verdict maps for that hand) |

API: `openHandDb()`, `saveHand(db, record)`, `listHands(db, limit=50)`, `getHand(db, id)`,
`saveAnnotations(db, ann)`, `getAnnotations(db, id)`.
Store wrapper: `store/historyStore.ts` (`hands`, `db`, `openDb`, `saveRecord(record, ann?)`,
`refresh()`). Settings persist separately to `localStorage` via `store/settingsStore.ts`
(zustand `persist`, key `poker-settings`), including `showOdds`, `showStrategyAdvice`,
`strategyProfileId`, and `strategyDifficulty`.

---

## Practice mode flow

Entry: `App.tsx` (`mode === 'practice'`) → `components/practice/PracticeMatch.tsx` (orchestrator).

`PracticeMatch` phases:
1. **Setup** — `MatchSetup.tsx`: choose 1–5 opponents, per-seat bot profile, stacks, blinds,
   odds toggle, strategy profile, difficulty, and pre-action advice toggle. Builds a
   `MatchConfig` → `matchStore.startMatch(...)`.
2. **Hand** — `beginNextHand()` calls engine `startNextHand(matchState)`, then
   `practiceFlow.ts:dealHand(handConfig, blinds)` (single shuffle → hole cards + 5 board cards
   + blind posts), seeds `gameStore.loadHand(config, actions)` and `practiceStore.setBoardCards`.
   `PracticeTable.tsx` renders the table and drives play:
   - `PokerTableLayout.tsx` + `SeatCard.tsx` + `cards/PlayingCard.tsx` (CSS cards).
   - Hero input: `ThoughtInput.tsx` + `BetSizingControls.tsx` (quick-size ½/¾/pot/all-in,
     slider/number bounded by engine min/max). Hero actions first build a pure
     `StrategyDecisionContext`, evaluate the selected strategy profile, store the verdict
     annotation, then flow through engine `legalActions` → `gameStore.appendAction`; thoughts are
     captured in the same hero-action callback.
   - Bots: an effect inside `PracticeTable` computes each bot's **own** equity via
     `hooks/equityClient.ts:estimateOwnEquity(myHole, opponents, board, iters)` (public info
     only), then calls `makeBot(profile).selectAction(...)`; sequenced with a delay.
   - Board streets dealt automatically when the betting round closes; showdown auto-evaluated
     via `evaluateHand`/`compareHandRanks`, pots awarded via `AWARD_POT` actions.
   - Hero display equity: `hooks/useEquity.ts` (Comlink worker) → `EquityBar`/strip
     (hidden when `settingsStore.showOdds` is false; still computed).
   - Strategy UI: `components/strategy/StrategyAdvicePanel.tsx` (only when
     `showStrategyAdvice` is on), `StrategyFeedbackPanel.tsx` after each hero action, and
     `StrategyWeaknessDashboard.tsx` for current-hand score/accuracy/weakness tags.
3. **Interstitial** — `MatchInterstitial.tsx`: per-hand result, stack deltas, eliminations,
   hero decisions + thoughts + strategy verdict summaries; persists the hand
   (`historyStore.saveRecord(record, annotations)`) and folds stacks back via engine
   `applyHandResult`.
4. **Results** — `MatchResults.tsx`: final standings, `StatsPanel.tsx` (session stats),
   "Export JSON" (`export/exportMatch.ts`), "New Match".

Stores used: `gameStore`, `matchStore`, `practiceStore`, `thoughtsStore`, `historyStore`,
`settingsStore`.

## Umpire mode flow

Entry: `App.tsx` (`mode === 'umpire'`) → `config && state ? UmpireTable : UmpireSetup`.
- `UmpireSetup.tsx` builds the `GameConfig` and posts blinds into `gameStore`.
- `UmpireTable.tsx` uses `useLegalActions(state)` + `whoseTurn`, renders `PlayerSeat`
  (no hole cards), `BettingControls.tsx` (wraps `common/ActionButtons.tsx`).
- Showdown: `ShowdownPanel.tsx` uses `CardPicker.tsx` to enter physical cards, then
  `evaluateHand`/`buildSidePots`/`computeAward` to award. No bot, no equity, no virtual deck.

## Hand replay flow

`App.tsx` keeps `replayRecord`; the **History** tab renders `HandHistoryList.tsx`
(from `historyStore`), and selecting a hand renders `HandReplayViewer.tsx`, which steps the
action log via `replayLog(config, actionLog.slice(0, step))` and shows the thought plus any
strategy verdict (loaded from IndexedDB `getAnnotations`) inline at each hero decision.

---

## Bot architecture

Interface (`types.ts`): `PokerBot { name; difficulty; selectAction(state, legal, myId, equity) => Action }`.
Bots receive only public `GameState` + a **pre-computed equity number** — they never read
opponents' hole cards.

Implementation: `packages/engine/src/bot.ts`
- `HeuristicBot` (v1) — config object `BotProfile { key, label, epsilon, equityNoiseStd,
  tightness, aggression, bluffFreq, sizingMin, sizingMax }` + injectable `rng` (for tests).
  Logic = Monte-Carlo equity vs pot odds, with: ε error rate + Gaussian equity noise (skill),
  tightness/aggression/bluff thresholds (style), **mixed strategy** in the equity≈pot-odds
  indifference zone, and **bet-size jitter** within the profile band clamped to legal min/max.
- Presets: `BOT_PROFILES` (`nit`, `station`, `maniac`, `tag`), `DEFAULT_PROFILE_KEYS`,
  factory `makeBot(profileKey, name?, rng?)`.
- `CfrBot` — **stub** implementing `PokerBot` that throws; the documented CFR drop-in point.
- ⚠️ drift / orphan: `hooks/useBot.ts` exists but is **not used**; `PracticeTable` has its own
  inline bot-driving effect. Treat `useBot.ts` as dead code.

---

## Strategy trainer architecture

Built as a pure engine subsystem under `packages/engine/src/strategy/` and a thin web
annotation/UI integration.

Engine modules:
- `strategy/types.ts` — public profile/context/verdict/advice/weakness/scoring types.
- `strategy/context.ts` — pure `buildStrategyDecisionContext(state, action, options)` and
  `buildStrategyAdviceContext(state, options)` helpers. They derive position, table size,
  street, hero cards, board, pot, bet to call, stack map, previous actions, preflop aggressor,
  heads-up/multiway flags, and action sizing from pre-action `GameState`.
- `strategy/registry.ts` — profile registry with default `DEFAULT_STRATEGY_PROFILE_ID =
  "gto-v1"`, `listStrategyProfiles()`, `getStrategyProfile()`, and `getDefaultStrategyProfile()`.
- `strategy/profiles/gto-v1.ts` — first strategy profile.
- `strategy/weaknesses.ts` — `aggregateStrategyWeaknesses(verdicts)` and
  `summarizeStrategyPerformance(verdicts)` for score, street accuracy, position accuracy,
  covered/uncovered counts, and recurring weakness tags.

Web integration:
- `PracticeTable` evaluates the selected profile when the hero acts, stores the returned
  `StrategyVerdict` in `HandAnnotations.strategyVerdicts[action.id]`, then appends the engine
  action normally. The trainer never blocks play, rewinds, or mutates engine state.
- `StrategyFeedbackPanel` shows the latest verdict after action; `StrategyAdvicePanel` shows
  optional pre-action guidance; `StrategyWeaknessDashboard` summarizes current-hand mistakes
  and uncovered spots.
- `MatchInterstitial` and `HandReplayViewer` read verdicts from annotations alongside thoughts.
- `settingsStore` persists `showStrategyAdvice` (default OFF), `strategyProfileId` (default
  `gto-v1`), and `strategyDifficulty` (default `intermediate`).

**Coverage honesty is load-bearing:** if a spot is not covered, the verdict has
`covered:false`, `score:null`, `userMatched:null`, `actionCorrect:null`,
`sizingCorrect:null`, `violatedRule:null`, and `violationTag:null`. The explanation states why
the spot is uncovered. Do not fabricate a recommendation for unsupported spots.

## GTO v1 strategy-profile design

`gto-v1` is a simplified educational baseline, not a solver and not complete GTO.

Implemented coverage:
- Normal stack depths of roughly 40bb-250bb.
- 2-6 handed table-size recognition, but heads-up preflop strategy deliberately returns
  `covered:false` rather than reusing 6-max EP/MP/CO ranges.
- Preflop raise-first-in ranges for EP/MP/CO/BTN; first-in blind spots are uncovered.
- Facing one clear open: value-heavy 3-bets, 3x open size in position, 4x open size out of
  position, plus conservative BB defence candidates such as AJo versus a CO open.
- Board texture classifier: dry, semi-wet, wet, dynamic. Explicitly tested examples include
  AK4/K83/Q72 rainbow as dry and 765/986/543 two-tone as wet/dynamic.
- Flop heads-up single-raised c-bet spots where hero was PFR: dry high-card boards prefer
  25%-33% pot; wet/dynamic connected boards prefer more selective 50%-75% bets.
- Simple range-advantage explanations for high-card dry boards favoring PFR and low connected
  boards favoring caller/neutral.
- Turn heads-up single-raised spots with reliable hand-strength classification: strong
  value/draws bet 60%-75%; medium one-pair hands are flagged when bet as polar value.
- River heads-up single-raised spots with reliable hand-strength classification: medium one-pair
  large bets are flagged as merged/polarity violations; strong value can use large polar sizing.

Known uncovered examples:
- Limped pots, cold-call/multiway preflop lines, multi-raise/3-bet pots beyond the first
  facing-open rule, multiway postflop pots, ambiguous or missing action histories, unsupported
  table/position mappings, unsupported stack depths, first-in SB/BB spots, most heads-up
  preflop spots, postflop spots where hero is not the PFR, postflop leads/raises faced before
  hero acts, and turn/river hands where the simplified strength/draw/blocker logic is not
  reliable.

---

## Key files & their roles

### Engine (`packages/engine/src/`)
| Path | Responsibility |
|---|---|
| `index.ts` | Barrel re-exporting the public engine API |
| `types.ts` | All shared types + the `Action`/`LegalAction` unions |
| `state.ts` | `createInitialState(config)` |
| `applyAction.ts` | Pure reducer `applyAction(state, action)` |
| `legalActions.ts` | `legalActions(state)` |
| `whoseTurn.ts` | `whoseTurn(state)` |
| `bettingRound.ts` | Round-close, street advance, seat iteration helpers |
| `sidePot.ts` | `buildSidePots`, `computeAward` (odd-chip rule) |
| `handEvaluator.ts` | `evaluateHand`, `compareHandRanks` |
| `deck.ts` | `createDeck`, seedable `shuffle` |
| `monteCarlo.ts` | `estimateEquity` (pure; wrapped by a worker in web) |
| `match.ts` | Multiway match layer: `createMatch`, `startNextHand`, `applyHandResult`, `assignBlinds` (heads-up exception), `rotateButton`, `survivingPlayers`, `isMatchOver`, `matchWinner` |
| `stats.ts` | `computePlayerStats`, `computeAllStats`, `handsForMatch` (VPIP/PFR/AF/net) |
| `bot.ts` | `HeuristicBot`, `BOT_PROFILES`, `makeBot`, `CfrBot` stub |
| `coach.ts` | `SimpleCoach` stub (not wired into UI) |
| `strategy/types.ts` | Strategy profile/context/verdict/advice/weakness/scoring types |
| `strategy/context.ts` | Pure strategy context derivation from pre-action `GameState` + action |
| `strategy/registry.ts` | Strategy profile registry and default profile plumbing |
| `strategy/profiles/gto-v1.ts` | Simplified GTO v1 baseline profile + board texture/range helpers |
| `strategy/weaknesses.ts` | Weakness aggregation and strategy performance summaries |
| `constants.ts` | Rank/suit tables |
| `__tests__/*.test.ts` | Vitest suites (engine only) |

### Web (`packages/web/src/`)
| Path | Responsibility |
|---|---|
| `main.tsx` / `App.tsx` | Mount; top-level mode router (home / umpire / practice / history) |
| `store/gameStore.ts` | `{config, actionLog}` + `replayLog()` (source of truth) |
| `store/matchStore.ts` | Current `MatchState` + bot profile map + heroId |
| `store/practiceStore.ts` | Pre-dealt board cards for the active practice hand |
| `store/thoughtsStore.ts` | In-memory thoughts + strategy verdict annotation maps + `snapshot()` |
| `store/historyStore.ts` | IndexedDB-backed hand history (`saveRecord`, `refresh`) |
| `store/settingsStore.ts` | Persisted blinds/stacks/odds + strategy trainer settings |
| `db/handDb.ts` | IndexedDB schema + accessors (`hands`, `annotations`) |
| `hooks/useGameState.ts` | Memoised `replayLog` → `GameState` |
| `hooks/useLegalActions.ts` | Memoised `legalActions` (used by `UmpireTable`) |
| `hooks/useEquity.ts` | Hero display equity via Comlink worker |
| `hooks/equityClient.ts` | Shared worker client; bot's own-equity estimate |
| `hooks/useBot.ts` | ⚠️ orphan (unused) |
| `workers/equity.worker.ts` | Comlink-exposed `estimateEquity` |
| `export/exportMatch.ts` | Self-contained match JSON + human-readable transcript + download |
| `components/practice/PracticeMatch.tsx` | Practice/match orchestrator |
| `components/practice/MatchSetup.tsx` | Opponent/profile/blinds setup |
| `components/practice/practiceFlow.ts` | `dealHand()` — deck shuffle, hole/board/blind actions |
| `components/practice/PracticeTable.tsx` | Live practice table + hero/bot action driving |
| `components/practice/BetSizingControls.tsx` | Quick-size + slider bet UI |
| `components/practice/ThoughtInput.tsx` | Per-decision reasoning capture |
| `components/practice/MatchInterstitial.tsx` | Per-hand result/eliminations/decisions |
| `components/practice/MatchResults.tsx` | Final standings + stats + export |
| `components/practice/StatsPanel.tsx` | VPIP/PFR/AF/net table |
| `components/practice/EquityBar.tsx` | Equity bar display |
| `components/practice/CoachPanel.tsx` | ⚠️ orphan (unused) |
| `components/strategy/StrategyAdvicePanel.tsx` | Optional concise pre-action strategy advice |
| `components/strategy/StrategyFeedbackPanel.tsx` | Post-action strategy verdict display, also reused in replay |
| `components/strategy/StrategyWeaknessDashboard.tsx` | Score/accuracy/weakness dashboard for verdict collections |
| `components/table/PokerTableLayout.tsx` | Responsive oval/stacked table (2–6 seats) |
| `components/table/SeatCard.tsx` | Per-seat stack/bet/status/cards |
| `components/cards/PlayingCard.tsx` | Pure-CSS playing card (no image assets) |
| `components/umpire/UmpireSetup.tsx` | Umpire game config + blind posting |
| `components/umpire/UmpireTable.tsx` | Umpire table + turn/legal display |
| `components/umpire/BettingControls.tsx` | Umpire action wrapper |
| `components/umpire/ShowdownPanel.tsx` | Enter physical cards, award pots |
| `components/history/HandHistoryList.tsx` | List saved hands |
| `components/history/HandReplayViewer.tsx` | Step-through replay + inline thoughts and strategy verdicts |
| `components/history/HandSummaryView.tsx` | ⚠️ orphan (superseded by MatchInterstitial) |
| `components/common/ActionButtons.tsx` | Shared action buttons + raise input |
| `components/common/CardPicker.tsx` | 52-card picker (umpire showdown) |
| `components/common/PlayerSeat.tsx` | Umpire seat row |
| `components/common/ChipDisplay.tsx` | Chip formatting |
| `components/cards/suits.ts` | Suit glyphs + `suitInk()` color token (2-color / 4-color deck) |
| `styles/tokens.css` | **Design-token source of truth** (CSS custom properties) |
| `styles/global.css` | Base/reset, button system, inputs, panel, utilities (`.tnum`, `.eyebrow`) |
| `styles/theme.ts` | Typed `var(--token)` accessors for inline styles (color/radius/shadow/space/font/iconSize/motion) |
| `scripts/gen-icons.mjs` (repo root `scripts/`) | Dependency-free PWA icon generator |

---

## Design system (presentational layer)

Matte, calm, modern — "poker as a serious analytical activity," not a casino. **No green
felt, no leather, no neon, no glossy chrome.** Surfaces are distinguished by subtle
background steps + hairline borders first, soft diffuse shadows second.

**Styling approach.** No CSS framework. Styling is (1) a single design-token layer in
`styles/tokens.css`, (2) base/utility classes in `styles/global.css`, (3) component-level
inline `style={{}}` that consume `var(--token)` references (optionally via the typed
`styles/theme.ts` helper). There are **no scattered hardcoded hex/shadow values** in the
refactored components.

**Tokens (`styles/tokens.css`)** — the single source of truth. Layers:
- *Primitives:* cool-gray neutral ramp (`--gray-50…--gray-950`, ~13 steps), one restrained
  desaturated-indigo accent ramp (`--accent-300…--accent-700`), low-saturation semantic
  colors (`--green/red/blue/amber/violet-500` + `*-soft` tints), playing-card inks.
- *Semantic aliases (theme-mapped):* surfaces (`--bg-app/surface/raised/elevated/hover/
  input/inset`), table surface (`--table-surface-from/to`, `--table-rail`), borders
  (`--border-subtle/border/strong`), text (`--text-primary/secondary/muted/faint`), state
  (`--accent`, `--success`, `--danger`, `--info`, `--caution`, `--allin`), elevation
  (`--shadow-sm/md/lg/pop/card` — low opacity, large blur, no bevel/inner-glow), radius
  (`--radius-xs…xl/pill`), spacing (`--space-1…8`, 8pt-based), type scale
  (`--text-xs…2xl`, weights, `--font-sans` Inter-or-system / `--font-mono`), icon sizes
  (`--icon-sm/md/lg`), motion (`--ease-out`, `--dur-fast/dur/dur-slow`).
- *Legacy aliases:* the old `--color-*` / `--suit-*` / `--spacing-*` names are re-pointed at
  the new matte palette, so any not-yet-refactored code still renders matte.
- **Theme:** default is **matte dark** (Offsuit-spirit, matches PWA `theme_color`). A light
  theme mirrors every semantic token via `:root[data-theme="light"]` and
  `@media (prefers-color-scheme: light)`. Nothing toggles it yet — extension point.

**Tabular figures.** Every element rendering numbers (stacks, pot, bets, equity %, scores,
counts) carries `.tnum` / `font-variant-numeric: tabular-nums` so digits don't jitter.

**Iconography.** `@fluentui/react-icons` (Microsoft Teams style). **Regular (outline)** weight
for idle/default, **Filled** for active/selected/emphasis (e.g. nav tabs swap
`Gavel20Regular`↔`Gavel20Filled`). Sizes follow the icon tokens (16/20/24). Wired into:
App nav + home cards, action buttons (`ActionButtons`, `BetSizingControls`), Practice turn
indicator, strategy panels (Lightbulb / CheckmarkCircle / DismissCircle / DataTrending),
MatchSetup/Results (Target / Play / Trophy / Download), Umpire setup/showdown (Gavel / Play),
History list + replay transport controls. All prior emoji/glyph icons removed.

**Playing cards (`components/cards/PlayingCard.tsx`).** Crisp matte vector card: clean
rank+suit typography, hairline border, soft corner radius, soft card shadow (no gloss
gradient). Face-down = accent-tinted hatch. Public API is unchanged
(`card`, `faceDown`, `size`); two **additive optional** props were added — `fourColor`
(4-color deck: clubs green, diamonds blue) and `highlight` (winning/selected ring). Suit
colors come from `suitInk()` in `components/cards/suits.ts`.

**Deferred (later pass):** orphaned components `history/HandSummaryView.tsx` and
`practice/CoachPanel.tsx` were left untouched (they are unused; they still inherit the matte
palette through the legacy token aliases). No light-theme toggle UI yet.

## Run locally / Test / Build & deploy

Commands verified against `package.json` (root unless noted). Node ≥18; this environment uses
Node at `~/.node/bin` (`export PATH="$HOME/.node/bin:$PATH"` if `npm` isn't found).

```bash
npm install            # install all workspaces
npm run dev            # vite dev server (web) → http://localhost:5173
npm run dev:host       # vite --host (LAN / phone testing)
npm run test           # engine Vitest suite (runs packages/engine tests only)
npm run build          # build all workspaces (engine tsc → web tsc+vite)
npm run gen:icons      # regenerate PWA icons (scripts/gen-icons.mjs)
# web-only: npm run build --workspace=packages/web ; npm run preview --workspace=packages/web
# engine-only watch/coverage: npm run test:watch / test:coverage --workspace=packages/engine
```

Build output: `packages/web/dist` (what Pages publishes).

**GitHub Pages deploy** — live at **https://JunLogic.github.io/Poker-Trainer/**
(remote `origin` = `github.com/JunLogic/Poker-Trainer`).
- Vite `base` is build-time conditional in `packages/web/vite.config.ts`:
  `/Poker-Trainer/` for `build`, `/` for dev. PWA `manifest.start_url`/`scope`/icon paths all
  derive from that base.
- Workflow: `.github/workflows/deploy-pages.yml` (triggers on push to `main`). Steps: checkout →
  setup-node 20 (`cache: npm`) → `npm ci` → `npm run test` → `npm run build` → write `.nojekyll`
  + copy `index.html`→`404.html` (SPA fallback) → `actions/configure-pages@v5`
  (`enablement: true`) → `upload-pages-artifact@v3` (path `packages/web/dist`) →
  `deploy-pages@v4`. Pages **source = GitHub Actions** (auto-enabled by the workflow token).
- `package-lock.json` is committed (required by `npm ci`).

---

## Known limitations (real)

- **GTO v1 is intentionally incomplete** — it is an educational baseline with explicit
  `covered:false` behavior. It does not cover limped pots, multiway postflop pots, most
  heads-up preflop spots, 3-bet pots beyond the simple facing-open sizing rule, unsupported
  stack depths, ambiguous action histories, or turn/river spots requiring real blocker logic.
- **Strategy dashboard scope** — live dashboard summaries are current-hand/interstitial
  annotations. Persisted verdicts are replayable, but there is not yet a cross-session
  historical trainer analytics page.
- **AI coach is a stub** — `SimpleCoach` is equity-vs-pot-odds only and is **not wired into the
  UI**; `CoachPanel` is orphaned. No LLM/natural-language coaching.
- **Hero display equity is "god-mode"** — `useEquity` computes hero equity from all known hole
  cards (exact), whereas bots correctly use public-info-only estimates. Fine for a trainer but
  not a realistic "what you'd know" number.
- **Orphaned modules** present: `hooks/useBot.ts`, `components/practice/CoachPanel.tsx`,
  `components/history/HandSummaryView.tsx` are defined but unused.
- **Monte-Carlo cost** — up to 5 bots each run an equity estimate per decision in the worker;
  iteration count / pacing are the perf knobs (`equityClient.ts`, bot think-delay in
  `PracticeTable`).
- **Practice is multiway but UI is tuned for small tables** (2–6 seats); no true 6-max ring
  styling beyond the oval layout's positions.

---

## Safe extension points (do these WITHOUT touching the engine's rule files)

- **CFR / smarter bot** — implement `PokerBot` (replace/extend `CfrBot` in `bot.ts`); wire via
  `makeBot`/`PracticeTable`. The interface already passes only public state + equity.
- **New strategy profile** — implement `StrategyProfile` in `packages/engine/src/strategy/`
  (usually `profiles/<id>.ts`), register it in `strategy/registry.ts`, then it appears in the
  Practice setup profile selector. Keep profile logic pure and return `covered:false` for any
  unsupported spot.
- **GTO v1 expansion** — add rules inside `profiles/gto-v1.ts` and tests in
  `__tests__/strategy.test.ts`. Prefer adding coverage gates before adding recommendations.
- **Trainer analytics** — use persisted `HandAnnotations.strategyVerdicts` from IndexedDB to
  build cross-session weakness/accuracy dashboards. Do not alter engine action logs.
- **Strategy trainer / coach UI** — continue using annotations keyed by `Action.id`; never add
  fields to engine `Action` types.
- **6-max / full-ring table UI** — extend `PokerTableLayout`/`SeatCard` seat positions; the
  engine + match layer already support N players.
- **New drill modes** — new components under `components/practice/` + a setup screen; reuse
  `gameStore`/`replayLog`, `legalActions`, and the annotation pattern.
- **Export/analysis** — extend `export/exportMatch.ts` (already produces a replay-free transcript).

---

## ⚠️ Do NOT modify

- **Engine purity** — no I/O (DOM, network, storage, logging, time-based branching) in any
  `packages/engine` rule module. Keep side effects in `packages/web`.
- **Engine `Action` types** (`types.ts`) — annotations (thoughts, future verdicts) live in the
  **parallel annotation map keyed by `Action.id`**, never inside the action union. Adding fields
  to actions breaks the event-log contract and persisted history.
- **Replay determinism** — `state = replayLog(config, actionLog)` must be pure and reproducible.
  Do not let rule outcomes depend on wall-clock time, `Math.random` (use the seedable `shuffle`/
  injectable bot `rng`), or external state.
- **The three public engine functions' signatures** (`applyAction`, `legalActions`, `whoseTurn`)
  — the entire UI and bot layer depend on them.
- **IndexedDB schema migrations** — bump the version in `handDb.ts` and migrate; don't silently
  change `keyPath`/stores (breaks existing saved hands).

---

_Last updated for the Strategy Adherence Trainer implementation on 2026-06-04._
