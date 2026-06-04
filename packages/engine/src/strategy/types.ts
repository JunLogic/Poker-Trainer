import type { Action, Card, PlayerId, Street } from '../types.js';

export type StrategyProfileId = string;

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type StrategyStreet = Extract<Street, 'preflop' | 'flop' | 'turn' | 'river'>;

export type StrategyActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

export type StrategyConfidence = 'high' | 'medium' | 'low';

export type WeaknessTag =
  | 'overbets-dry-boards'
  | 'wrong-3bet-sizing-oop'
  | 'wrong-3bet-sizing-ip'
  | 'too-loose-early-position'
  | 'too-tight-button'
  | 'under-defends-bb'
  | 'over-cbets-wet-boards'
  | 'turn-not-polar'
  | 'river-large-bet-merged-hand'
  | 'river-random-bluff'
  | 'too-loose-facing-open'
  | 'uncovered-spot';

export type TablePosition = 'EP' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB' | 'BTN/SB';

export interface StrategyViolation {
  readonly rule: string;
  readonly tag: WeaknessTag;
}

export interface StrategyDecisionContext {
  readonly profileId: StrategyProfileId;
  readonly difficulty: DifficultyLevel;
  readonly heroId: PlayerId;
  readonly tableSize: number;
  readonly position?: TablePosition;
  readonly positionsByPlayerId: Readonly<Record<PlayerId, TablePosition>>;
  readonly street: StrategyStreet;
  readonly heroHoleCards: readonly [Card, Card] | null;
  readonly boardCards: readonly Card[];
  readonly potSize: number;
  readonly currentBetToCall: number;
  readonly currentBet: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly stackSizes: Readonly<Record<PlayerId, number>>;
  readonly previousActions: readonly Action[];
  readonly preflopAggressorId: PlayerId | null;
  readonly isHeadsUpPot: boolean;
  readonly isMultiwayPot: boolean;
  readonly userAction: StrategyActionType;
  readonly userSizing?: number;
}

export interface StrategyAdviceContext {
  readonly profileId: StrategyProfileId;
  readonly difficulty: DifficultyLevel;
  readonly heroId: PlayerId;
  readonly tableSize: number;
  readonly position?: TablePosition;
  readonly positionsByPlayerId: Readonly<Record<PlayerId, TablePosition>>;
  readonly street: StrategyStreet;
  readonly heroHoleCards: readonly [Card, Card] | null;
  readonly boardCards: readonly Card[];
  readonly potSize: number;
  readonly currentBetToCall: number;
  readonly currentBet: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly stackSizes: Readonly<Record<PlayerId, number>>;
  readonly previousActions: readonly Action[];
  readonly preflopAggressorId: PlayerId | null;
  readonly isHeadsUpPot: boolean;
  readonly isMultiwayPot: boolean;
}

export interface StrategyAdvice {
  readonly covered: boolean;
  readonly profileId: StrategyProfileId;
  readonly profileName: string;
  readonly difficulty: DifficultyLevel;
  readonly street: StrategyStreet;
  readonly position?: string;
  readonly advice: string;
  readonly conceptTrained: string;
  readonly confidence: StrategyConfidence;
}

export type StrategyVerdict = {
  readonly covered: boolean;
  readonly profileId: string;
  readonly profileName: string;
  readonly difficulty: DifficultyLevel;
  readonly street: StrategyStreet;
  readonly position?: string;
  readonly baselineAction?: string;
  readonly baselineSizing?: string;
  readonly userAction: string;
  readonly userSizing?: string;
  readonly userMatched: boolean | null;
  readonly actionCorrect: boolean | null;
  readonly sizingCorrect: boolean | null;
  readonly score: number | null;
  readonly maxScore: 25;
  readonly violatedRule: string | null;
  readonly violationTag: WeaknessTag | null;
  readonly explanation: string;
  readonly conceptTrained: string;
  readonly confidence: StrategyConfidence;
};

export interface StrategyProfile {
  readonly id: StrategyProfileId;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly supportedTableSizes: readonly number[];
  readonly difficultyLayers: readonly DifficultyLevel[];
  evaluateDecision(context: StrategyDecisionContext): StrategyVerdict;
  getPreActionAdvice?(context: StrategyAdviceContext): StrategyAdvice;
}

export interface StrategyWeaknessDashboardEntry {
  readonly tag: WeaknessTag;
  readonly label: string;
  readonly count: number;
  readonly explanation: string;
  readonly suggestedFocus: string;
}

export interface StrategyPerformanceSummary {
  readonly coveredCount: number;
  readonly uncoveredCount: number;
  readonly maxScore: number;
  readonly score: number;
  readonly overallAccuracy: number | null;
  readonly streetAccuracy: Partial<Record<StrategyStreet, number>>;
  readonly positionAccuracy: Record<string, number>;
}
