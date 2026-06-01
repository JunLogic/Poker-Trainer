// ── Primitives ────────────────────────────────────────────────────────────────

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 'c' | 'd' | 'h' | 's'; // clubs, diamonds, hearts, spades

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

export type PlayerId = string;

// ── Player ────────────────────────────────────────────────────────────────────

export type PlayerStatus = 'active' | 'allin' | 'folded' | 'sitting-out';

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly stack: number;
  /** Total chips committed this entire hand — the key for side-pot calculation */
  readonly betCommitted: number;
  /** Chips committed in the current betting street only */
  readonly betThisStreet: number;
  readonly status: PlayerStatus;
  /** null in Umpire mode until REVEAL_CARDS; populated in Practice mode at deal */
  readonly holeCards: readonly [Card, Card] | null;
  readonly seatIndex: number;
}

// ── Pots ──────────────────────────────────────────────────────────────────────

export interface SidePot {
  readonly amount: number;
  readonly eligiblePlayerIds: readonly PlayerId[];
}

// ── Street / Phase ────────────────────────────────────────────────────────────

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'finished';

export type GameMode = 'umpire' | 'practice';

// ── Hand Rank (Practice mode) ─────────────────────────────────────────────────

export type HandCategory =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush';

export interface HandRank {
  readonly category: HandCategory;
  /** Big-endian tiebreaker array; lexicographic comparison determines winner */
  readonly tiebreaker: readonly number[];
  readonly bestFive: readonly [Card, Card, Card, Card, Card];
}

// ── Board ─────────────────────────────────────────────────────────────────────

export interface Board {
  readonly flop: readonly [Card, Card, Card] | null;
  readonly turn: Card | null;
  readonly river: Card | null;
}

// ── Game Config ───────────────────────────────────────────────────────────────

export interface PlayerSetup {
  readonly id: PlayerId;
  readonly name: string;
  readonly seatIndex: number;
  readonly startingStack: number;
}

export interface GameConfig {
  readonly handId: string;
  readonly mode: GameMode;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly ante: number;
  readonly dealerSeatIndex: number;
  readonly players: readonly PlayerSetup[];
  readonly startingStacks: Readonly<Record<PlayerId, number>>;
}

// ── Actions ───────────────────────────────────────────────────────────────────
// All actions share a base; the engine's action log is the source of truth.
// State = replayLog(initialState, actionLog).

export interface ActionBase {
  readonly id: string;       // nanoid — stable identifier
  readonly playerId: PlayerId;
  readonly timestamp: number; // Date.now()
}

export interface PostBlindAction extends ActionBase {
  readonly type: 'POST_BLIND';
  readonly amount: number;
  readonly blindType: 'small' | 'big' | 'straddle';
}

export interface PostAnteAction extends ActionBase {
  readonly type: 'POST_ANTE';
  readonly amount: number;
}

export interface DealHoleCardsAction extends ActionBase {
  readonly type: 'DEAL_HOLE_CARDS';
  /** null in Umpire mode (physical cards); populated in Practice mode */
  readonly cards: readonly [Card, Card] | null;
}

export interface DealBoardAction extends ActionBase {
  readonly type: 'DEAL_BOARD';
  readonly street: 'flop' | 'turn' | 'river';
  readonly cards: readonly Card[]; // 3 for flop, 1 for turn/river
}

export interface FoldAction extends ActionBase {
  readonly type: 'FOLD';
}

export interface CheckAction extends ActionBase {
  readonly type: 'CHECK';
}

export interface CallAction extends ActionBase {
  readonly type: 'CALL';
  /** Actual chips moved — may be less than the gap if player goes all-in calling */
  readonly amount: number;
}

export interface BetAction extends ActionBase {
  readonly type: 'BET';
  readonly amount: number; // total bet size (not the increment)
}

export interface RaiseAction extends ActionBase {
  readonly type: 'RAISE';
  readonly amount: number; // raise-to (total chips in), not raise-by
}

export interface AllInAction extends ActionBase {
  /** Emitted when a player commits their entire remaining stack */
  readonly type: 'ALL_IN';
  readonly amount: number; // total chips committed this hand after this action
}

export interface RevealCardsAction extends ActionBase {
  /** Umpire mode: operator enters cards at showdown */
  readonly type: 'REVEAL_CARDS';
  readonly cards: readonly [Card, Card];
}

export interface AwardPotAction extends ActionBase {
  readonly type: 'AWARD_POT';
  readonly potIndex: number;
  readonly winnerIds: readonly PlayerId[];
  readonly amount: number;
  /** Odd-chip rule: single player who receives the extra chip(s) */
  readonly oddChipWinnerId: PlayerId | null;
}

export interface MuckCardsAction extends ActionBase {
  readonly type: 'MUCK_CARDS';
}

export type Action =
  | PostBlindAction
  | PostAnteAction
  | DealHoleCardsAction
  | DealBoardAction
  | FoldAction
  | CheckAction
  | CallAction
  | BetAction
  | RaiseAction
  | AllInAction
  | RevealCardsAction
  | AwardPotAction
  | MuckCardsAction;

// ── Legal Actions (returned by legalActions()) ────────────────────────────────

export interface LegalFold   { readonly type: 'FOLD' }
export interface LegalCheck  { readonly type: 'CHECK' }
export interface LegalCall   { readonly type: 'CALL';  readonly amount: number }
export interface LegalBet    { readonly type: 'BET';   readonly min: number; readonly max: number }
export interface LegalRaise  { readonly type: 'RAISE'; readonly min: number; readonly max: number }
export interface LegalAllIn  { readonly type: 'ALL_IN'; readonly amount: number }

export type LegalAction =
  | LegalFold
  | LegalCheck
  | LegalCall
  | LegalBet
  | LegalRaise
  | LegalAllIn;

// ── Betting Round State ───────────────────────────────────────────────────────

export interface BettingRoundState {
  readonly currentBet: number;
  /** Size of the most recent raise increment — governs min-raise rule */
  readonly lastRaiseSize: number;
  readonly lastAggressorId: PlayerId | null;
  /** Pre-flop only: BB gets one extra action even if no raise occurred */
  readonly bigBlindHasOption: boolean;
  readonly actorIdsThisStreet: readonly PlayerId[];
}

// ── Full Game State ───────────────────────────────────────────────────────────

export interface GameState {
  readonly config: GameConfig;
  readonly players: readonly Player[];
  readonly board: Board;
  readonly sidePots: readonly SidePot[];
  readonly street: Street;
  readonly bettingRound: BettingRoundState;
  /** The ordered source of truth — state = replayLog(actionLog) */
  readonly actionLog: readonly Action[];
  /** Index into players[] for the player whose turn it is; null when no action needed */
  readonly activePlayerIndex: number | null;
  /** Non-null only in Practice mode */
  readonly deck: readonly Card[] | null;
  readonly isHandOver: boolean;
}

// ── Bot Interface ─────────────────────────────────────────────────────────────

export interface PokerBot {
  readonly name: string;
  readonly difficulty: 'easy' | 'medium' | 'hard';
  /**
   * Called synchronously. Equity is pre-computed by the Monte Carlo worker
   * before this function is invoked. Must return a legal action.
   */
  selectAction(
    state: GameState,
    legal: readonly LegalAction[],
    myId: PlayerId,
    equity: number,
  ): Action;
}

// ── Coach Interface (stub — not built in this version) ────────────────────────

export interface CoachAnalysis {
  readonly hint: string;
  readonly severity: 'good' | 'neutral' | 'suboptimal' | 'mistake';
  readonly suggestedAction: LegalAction | null;
}

export interface Coach {
  analyse(
    stateBefore: GameState,
    actionTaken: Action,
    equity: number,
  ): CoachAnalysis;
}

// ── Persistence ───────────────────────────────────────────────────────────────

export interface HandSummary {
  readonly playerNames: readonly string[];
  readonly winnerIds: readonly PlayerId[];
  readonly potTotal: number;
  readonly streetReached: Street;
}

export interface HandRecord {
  readonly handId: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly config: GameConfig;
  readonly actionLog: readonly Action[];
  readonly summary: HandSummary;
}
