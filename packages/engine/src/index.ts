export type {
  Rank, Suit, Card, PlayerId,
  PlayerStatus, Player,
  SidePot,
  Street, GameMode,
  HandCategory, HandRank,
  Board,
  PlayerSetup, GameConfig,
  ActionBase,
  PostBlindAction, PostAnteAction, DealHoleCardsAction, DealBoardAction,
  FoldAction, CheckAction, CallAction, BetAction, RaiseAction, AllInAction,
  RevealCardsAction, AwardPotAction, MuckCardsAction,
  Action,
  LegalFold, LegalCheck, LegalCall, LegalBet, LegalRaise, LegalAllIn,
  LegalAction,
  BettingRoundState,
  GameState,
  PokerBot,
  CoachAnalysis, Coach,
  HandSummary, HandRecord,
} from './types.js';

export { RANKS, SUITS, RANK_VALUE, HAND_CATEGORY_RANK } from './constants.js';

export { applyAction } from './applyAction.js';
export { legalActions } from './legalActions.js';
export { whoseTurn } from './whoseTurn.js';
export { buildSidePots, computeAward } from './sidePot.js';
export { createInitialState } from './state.js';
export { createDeck, shuffle } from './deck.js';
export { evaluateHand, compareHandRanks } from './handEvaluator.js';
export { estimateEquity } from './monteCarlo.js';
export { HeuristicBot, CfrBot, makeBot, BOT_PROFILES, DEFAULT_PROFILE_KEYS } from './bot.js';
export type { BotProfile } from './bot.js';
export { SimpleCoach } from './coach.js';

export {
  createMatch, startNextHand, applyHandResult, assignBlinds, rotateButton,
  survivingPlayers, isMatchOver, matchWinner,
} from './match.js';
export type {
  MatchPlayerConfig, MatchConfig, MatchEvent, MatchState, BlindAssignment, NextHand,
} from './match.js';

export { computePlayerStats, computeAllStats, handsForMatch } from './stats.js';
export type { PlayerStats } from './stats.js';

export type {
  StrategyProfileId,
  DifficultyLevel,
  StrategyStreet,
  StrategyActionType,
  StrategyConfidence,
  WeaknessTag,
  TablePosition,
  StrategyViolation,
  StrategyDecisionContext,
  StrategyAdviceContext,
  StrategyAdvice,
  StrategyVerdict,
  StrategyProfile,
  StrategyWeaknessDashboardEntry,
  StrategyPerformanceSummary,
} from './strategy/index.js';
export {
  buildStrategyDecisionContext,
  buildStrategyAdviceContext,
  derivePositionsByPlayerId,
  inferPreflopAggressor,
  DEFAULT_STRATEGY_PROFILE_ID,
  registerStrategyProfile,
  getStrategyProfile,
  getDefaultStrategyProfile,
  listStrategyProfiles,
  gtoV1StrategyProfile,
  classifyBoardTexture,
  isHandInGtoV1OpeningRange,
  aggregateStrategyWeaknesses,
  summarizeStrategyPerformance,
} from './strategy/index.js';
