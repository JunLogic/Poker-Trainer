import { describe, expect, it } from 'vitest';
import type { Action, Card } from '../types.js';
import type { StrategyDecisionContext, TablePosition } from '../strategy/index.js';
import {
  aggregateStrategyWeaknesses,
  classifyBoardTexture,
  DEFAULT_STRATEGY_PROFILE_ID,
  getDefaultStrategyProfile,
  getStrategyProfile,
  gtoV1StrategyProfile,
  isHandInGtoV1OpeningRange,
} from '../strategy/index.js';

let seq = 0;

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

function hand(a: Card, b: Card): readonly [Card, Card] {
  return [a, b];
}

function blind(playerId: string, amount: number, blindType: 'small' | 'big'): Action {
  return { id: `a${seq++}`, playerId, timestamp: 1, type: 'POST_BLIND', amount, blindType };
}

function raise(playerId: string, amount: number): Action {
  return { id: `a${seq++}`, playerId, timestamp: 1, type: 'RAISE', amount };
}

function call(playerId: string, amount: number): Action {
  return { id: `a${seq++}`, playerId, timestamp: 1, type: 'CALL', amount };
}

function dealFlop(cards: readonly [Card, Card, Card]): Action {
  return { id: `a${seq++}`, playerId: 'dealer', timestamp: 1, type: 'DEAL_BOARD', street: 'flop', cards };
}

const blinds = () => [blind('sb', 5, 'small'), blind('bb', 10, 'big')];

function ctx(overrides: Partial<StrategyDecisionContext> = {}): StrategyDecisionContext {
  const base: StrategyDecisionContext = {
    profileId: 'gto-v1',
    difficulty: 'intermediate',
    heroId: 'hero',
    tableSize: 6,
    position: 'BTN',
    positionsByPlayerId: {
      hero: 'BTN',
      btn: 'BTN',
      sb: 'SB',
      bb: 'BB',
      co: 'CO',
      ep: 'EP',
      mp: 'MP',
    },
    street: 'preflop',
    heroHoleCards: hand(card('A', 's'), card('K', 's')),
    boardCards: [],
    potSize: 15,
    currentBetToCall: 10,
    currentBet: 10,
    smallBlind: 5,
    bigBlind: 10,
    stackSizes: {
      hero: 1000,
      btn: 1000,
      sb: 1000,
      bb: 1000,
      co: 1000,
      ep: 1000,
      mp: 1000,
    },
    previousActions: blinds(),
    preflopAggressorId: null,
    isHeadsUpPot: false,
    isMultiwayPot: false,
    userAction: 'RAISE',
    userSizing: 25,
  };
  return { ...base, ...overrides };
}

function flopContext(userSizing: number): StrategyDecisionContext {
  const flop = [card('K', 'c'), card('7', 'd'), card('2', 'h')] as const;
  return ctx({
    street: 'flop',
    position: 'BTN',
    boardCards: flop,
    potSize: 100,
    currentBet: 0,
    currentBetToCall: 0,
    previousActions: [...blinds(), raise('btn', 25), call('bb', 15), dealFlop(flop)],
    preflopAggressorId: 'hero',
    isHeadsUpPot: true,
    isMultiwayPot: false,
    userAction: 'BET',
    userSizing,
  });
}

describe('strategy registry', () => {
  it('registers gto-v1 and uses it as the default profile', () => {
    expect(DEFAULT_STRATEGY_PROFILE_ID).toBe('gto-v1');
    expect(getStrategyProfile('gto-v1')?.id).toBe('gto-v1');
    expect(getDefaultStrategyProfile().id).toBe('gto-v1');
  });
});

describe('GTO v1 preflop ranges and sizing', () => {
  it('classifies opening ranges by position', () => {
    expect(isHandInGtoV1OpeningRange('EP', hand(card('7', 's'), card('7', 'd')))).toBe(true);
    expect(isHandInGtoV1OpeningRange('EP', hand(card('6', 's'), card('6', 'd')))).toBe(false);
    expect(isHandInGtoV1OpeningRange('EP', hand(card('A', 's'), card('J', 's')))).toBe(true);
    expect(isHandInGtoV1OpeningRange('EP', hand(card('A', 's'), card('J', 'd')))).toBe(false);
    expect(isHandInGtoV1OpeningRange('MP', hand(card('A', 's'), card('J', 'd')))).toBe(true);
    expect(isHandInGtoV1OpeningRange('CO', hand(card('2', 's'), card('2', 'd')))).toBe(true);
    expect(isHandInGtoV1OpeningRange('CO', hand(card('A', 's'), card('2', 's')))).toBe(true);
    expect(isHandInGtoV1OpeningRange('CO', hand(card('9', 's'), card('8', 's')))).toBe(true);
    expect(isHandInGtoV1OpeningRange('BTN', hand(card('Q', 's'), card('8', 's')))).toBe(true);
  });

  it('scores 3-bet sizing in position at 3x the open size', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({
      position: 'BTN',
      heroHoleCards: hand(card('A', 's'), card('K', 's')),
      previousActions: [...blinds(), raise('co', 25)],
      positionsByPlayerId: { hero: 'BTN', co: 'CO', sb: 'SB', bb: 'BB' },
      userAction: 'RAISE',
      userSizing: 75,
    }));

    expect(verdict.covered).toBe(true);
    expect(verdict.actionCorrect).toBe(true);
    expect(verdict.sizingCorrect).toBe(true);
    expect(verdict.baselineSizing).toContain('3x');
  });

  it('scores 3-bet sizing out of position at 4x the open size', () => {
    const correct = gtoV1StrategyProfile.evaluateDecision(ctx({
      position: 'BB',
      heroHoleCards: hand(card('A', 's'), card('J', 'd')),
      previousActions: [...blinds(), raise('co', 25)],
      positionsByPlayerId: { hero: 'BB', co: 'CO', sb: 'SB', bb: 'BB' },
      currentBetToCall: 15,
      userAction: 'RAISE',
      userSizing: 100,
    }));
    const tooSmall = gtoV1StrategyProfile.evaluateDecision(ctx({
      position: 'BB',
      heroHoleCards: hand(card('A', 's'), card('J', 'd')),
      previousActions: [...blinds(), raise('co', 25)],
      positionsByPlayerId: { hero: 'BB', co: 'CO', sb: 'SB', bb: 'BB' },
      currentBetToCall: 15,
      userAction: 'RAISE',
      userSizing: 75,
    }));

    expect(correct.covered).toBe(true);
    expect(correct.sizingCorrect).toBe(true);
    expect(correct.baselineSizing).toContain('4x');
    expect(tooSmall.actionCorrect).toBe(true);
    expect(tooSmall.sizingCorrect).toBe(false);
    expect(tooSmall.violationTag).toBe('wrong-3bet-sizing-oop');
  });

  it('does not apply 6-max EP/MP/CO rules to heads-up spots', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({
      tableSize: 2,
      position: 'BTN/SB',
      positionsByPlayerId: { hero: 'BTN/SB', bb: 'BB' },
      previousActions: blinds(),
      userAction: 'RAISE',
      userSizing: 25,
    }));

    expect(verdict.covered).toBe(false);
    expect(verdict.explanation).toContain('Heads-up preflop strategy is not implemented');
  });
});

describe('GTO v1 board texture', () => {
  it('classifies explicit dry and wet/dynamic examples', () => {
    expect(classifyBoardTexture([card('A', 'c'), card('K', 'd'), card('4', 'h')])).toBe('dry');
    expect(classifyBoardTexture([card('K', 'c'), card('8', 'd'), card('3', 'h')])).toBe('dry');
    expect(classifyBoardTexture([card('Q', 'c'), card('7', 'd'), card('2', 'h')])).toBe('dry');

    expect(['wet', 'dynamic']).toContain(classifyBoardTexture([card('7', 'c'), card('6', 'c'), card('5', 'h')]));
    expect(['wet', 'dynamic']).toContain(classifyBoardTexture([card('9', 'c'), card('8', 'c'), card('6', 'h')]));
    expect(['wet', 'dynamic']).toContain(classifyBoardTexture([card('5', 'c'), card('4', 'c'), card('3', 'h')]));
  });
});

describe('GTO v1 flop sizing', () => {
  it('accepts a small BTN c-bet on K72 rainbow after BTN open and BB call', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(flopContext(30));

    expect(verdict.covered).toBe(true);
    expect(verdict.actionCorrect).toBe(true);
    expect(verdict.sizingCorrect).toBe(true);
    expect(verdict.score).toBe(25);
  });

  it('flags 75% pot as too large on the same dry board', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(flopContext(75));

    expect(verdict.covered).toBe(true);
    expect(verdict.actionCorrect).toBe(true);
    expect(verdict.sizingCorrect).toBe(false);
    expect(verdict.violationTag).toBe('overbets-dry-boards');
    expect(verdict.violatedRule).toContain('Dry high-card c-bets prefer 25%-33% pot');
  });
});

describe('GTO v1 coverage honesty', () => {
  it('returns uncovered for multiway postflop spots', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(flopContext(30));
    const multiway = gtoV1StrategyProfile.evaluateDecision(ctx({ ...flopContext(30), isMultiwayPot: true, isHeadsUpPot: false }));

    expect(verdict.covered).toBe(true);
    expect(multiway.covered).toBe(false);
    expect(multiway.score).toBeNull();
  });

  it('returns uncovered for limped pots', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({
      previousActions: [...blinds(), call('co', 10)],
      userAction: 'RAISE',
      userSizing: 40,
    }));

    expect(verdict.covered).toBe(false);
    expect(verdict.explanation).toContain('Limped pots are not covered');
  });

  it('returns uncovered for missing action history', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({ previousActions: [] }));

    expect(verdict.covered).toBe(false);
    expect(verdict.explanation).toContain('blind history is missing');
  });

  it('returns uncovered for unsupported table mapping', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({
      tableSize: 9,
      position: 'EP' as TablePosition,
    }));

    expect(verdict.covered).toBe(false);
    expect(verdict.explanation).toContain('9-handed');
  });
});

describe('GTO v1 turn and river polarity', () => {
  const turnBoard = [card('K', 'c'), card('7', 'd'), card('2', 'h'), card('4', 's')] as const;
  const riverBoard = [...turnBoard, card('3', 'd')] as const;

  it('flags a marginal made hand bet as not polar on the turn', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({
      street: 'turn',
      heroHoleCards: hand(card('K', 's'), card('9', 'd')),
      boardCards: turnBoard,
      potSize: 100,
      currentBet: 0,
      currentBetToCall: 0,
      previousActions: [...blinds(), raise('btn', 25), call('bb', 15), dealFlop([turnBoard[0], turnBoard[1], turnBoard[2]])],
      preflopAggressorId: 'hero',
      isHeadsUpPot: true,
      isMultiwayPot: false,
      userAction: 'BET',
      userSizing: 70,
    }));

    expect(verdict.covered).toBe(true);
    expect(verdict.violationTag).toBe('turn-not-polar');
  });

  it('returns uncovered when turn hand-strength logic is not reliable', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({
      street: 'turn',
      heroHoleCards: hand(card('J', 's'), card('8', 'd')),
      boardCards: turnBoard,
      potSize: 100,
      currentBet: 0,
      currentBetToCall: 0,
      previousActions: [...blinds(), raise('btn', 25), call('bb', 15), dealFlop([turnBoard[0], turnBoard[1], turnBoard[2]])],
      preflopAggressorId: 'hero',
      isHeadsUpPot: true,
      isMultiwayPot: false,
      userAction: 'BET',
      userSizing: 70,
    }));

    expect(verdict.covered).toBe(false);
  });

  it('flags a large river bet with medium one-pair as merged/polarity violation', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({
      street: 'river',
      heroHoleCards: hand(card('K', 's'), card('9', 'd')),
      boardCards: riverBoard,
      potSize: 100,
      currentBet: 0,
      currentBetToCall: 0,
      previousActions: [...blinds(), raise('btn', 25), call('bb', 15), dealFlop([turnBoard[0], turnBoard[1], turnBoard[2]])],
      preflopAggressorId: 'hero',
      isHeadsUpPot: true,
      isMultiwayPot: false,
      userAction: 'BET',
      userSizing: 75,
    }));

    expect(verdict.covered).toBe(true);
    expect(verdict.violationTag).toBe('river-large-bet-merged-hand');
  });

  it('returns uncovered when river blocker/hand-strength logic is not reliable', () => {
    const verdict = gtoV1StrategyProfile.evaluateDecision(ctx({
      street: 'river',
      heroHoleCards: hand(card('J', 's'), card('8', 'd')),
      boardCards: riverBoard,
      potSize: 100,
      currentBet: 0,
      currentBetToCall: 0,
      previousActions: [...blinds(), raise('btn', 25), call('bb', 15), dealFlop([turnBoard[0], turnBoard[1], turnBoard[2]])],
      preflopAggressorId: 'hero',
      isHeadsUpPot: true,
      isMultiwayPot: false,
      userAction: 'BET',
      userSizing: 75,
    }));

    expect(verdict.covered).toBe(false);
  });
});

describe('strategy weakness aggregation', () => {
  it('aggregates repeated violation tags into dashboard entries', () => {
    const a = flopContext(75);
    const b = flopContext(75);
    const uncovered = gtoV1StrategyProfile.evaluateDecision(ctx({ previousActions: [] }));
    const entries = aggregateStrategyWeaknesses([
      gtoV1StrategyProfile.evaluateDecision(a),
      gtoV1StrategyProfile.evaluateDecision(b),
      uncovered,
    ]);

    expect(entries[0]?.tag).toBe('overbets-dry-boards');
    expect(entries[0]?.count).toBe(2);
    expect(entries.some(entry => entry.tag === 'uncovered-spot')).toBe(true);
  });
});
