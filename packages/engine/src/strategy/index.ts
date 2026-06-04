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
} from './types.js';

export {
  buildStrategyDecisionContext,
  buildStrategyAdviceContext,
  derivePositionsByPlayerId,
  inferPreflopAggressor,
} from './context.js';
export type { StrategyContextOptions } from './context.js';

export {
  DEFAULT_STRATEGY_PROFILE_ID,
  registerStrategyProfile,
  getStrategyProfile,
  getDefaultStrategyProfile,
  listStrategyProfiles,
} from './registry.js';

export {
  gtoV1StrategyProfile,
  classifyBoardTexture,
  isHandInGtoV1OpeningRange,
} from './profiles/gto-v1.js';

export {
  aggregateStrategyWeaknesses,
  summarizeStrategyPerformance,
} from './weaknesses.js';
