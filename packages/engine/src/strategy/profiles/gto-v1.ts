import { RANK_VALUE } from '../../constants.js';
import { evaluateHand } from '../../handEvaluator.js';
import type { Action, Card, HandCategory, PlayerId, Rank } from '../../types.js';
import type {
  StrategyAdvice,
  StrategyAdviceContext,
  StrategyDecisionContext,
  StrategyProfile,
  StrategyVerdict,
  TablePosition,
  WeaknessTag,
} from '../types.js';

type BoardTexture = 'dry' | 'semi-wet' | 'wet' | 'dynamic';
type RangeAdvantage = 'pfr' | 'caller' | 'neutral';

const PROFILE_ID = 'gto-v1';
const PROFILE_NAME = 'GTO v1';
const MAX_SCORE = 25 as const;
const VOLUNTARY_ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);

export const gtoV1StrategyProfile: StrategyProfile = {
  id: PROFILE_ID,
  name: PROFILE_NAME,
  version: '1.0.0',
  description: 'Simplified beginner/intermediate tight-aggressive baseline with honest spot coverage.',
  supportedTableSizes: [2, 3, 4, 5, 6],
  difficultyLayers: ['beginner', 'intermediate', 'advanced'],
  evaluateDecision: evaluateGtoV1Decision,
  getPreActionAdvice: getGtoV1PreActionAdvice,
};

export function evaluateGtoV1Decision(context: StrategyDecisionContext): StrategyVerdict {
  if (!gtoV1StrategyProfile.supportedTableSizes.includes(context.tableSize)) {
    return uncovered(context, `This ${context.tableSize}-handed table is not covered by ${PROFILE_NAME}.`, 'Coverage honesty', 'high');
  }
  if (!gtoV1StrategyProfile.difficultyLayers.includes(context.difficulty)) {
    return uncovered(context, `Difficulty layer ${context.difficulty} is not available in ${PROFILE_NAME}.`, 'Coverage honesty', 'high');
  }
  if (!hasSupportedStackDepth(context)) {
    return uncovered(context, `${PROFILE_NAME} currently covers normal stack depths of roughly 40bb-250bb.`, 'Coverage honesty', 'medium');
  }

  switch (context.street) {
    case 'preflop':
      return evaluatePreflop(context);
    case 'flop':
      return evaluateFlop(context);
    case 'turn':
      return evaluateTurn(context);
    case 'river':
      return evaluateRiver(context);
  }
}

export function getGtoV1PreActionAdvice(context: StrategyAdviceContext): StrategyAdvice {
  const profileBase = {
    covered: false,
    profileId: PROFILE_ID,
    profileName: PROFILE_NAME,
    difficulty: context.difficulty,
    street: context.street,
    confidence: 'medium' as const,
  };

  const withPosition = (advice: Omit<StrategyAdvice, 'position'>): StrategyAdvice => ({
    ...advice,
    ...(context.position ? { position: context.position } : {}),
  });

  if (context.street === 'preflop') {
    if (!hasBlindHistory(context.previousActions)) {
      return withPosition({
        ...profileBase,
        advice: 'No strategy advice: GTO v1 needs the blind/opening history for this preflop spot.',
        conceptTrained: 'Coverage honesty',
      });
    }
    if (context.tableSize === 2) {
      return withPosition({
        ...profileBase,
        advice: 'Heads-up preflop charts are not implemented in GTO v1, so this spot is advice-only uncovered.',
        conceptTrained: 'Coverage honesty',
      });
    }
    const actions = preflopVoluntaryActions(context.previousActions);
    if (nonFoldActions(actions).length === 0 && context.position && context.heroHoleCards) {
      const inRange = isHandInGtoV1OpeningRange(context.position, context.heroHoleCards);
      return withPosition({
        ...profileBase,
        covered: context.position !== 'SB' && context.position !== 'BB',
        advice: inRange
          ? `${context.position}: open this hand to about 2.5bb if action folds to you.`
          : `${context.position}: this hand is outside the GTO v1 first-in opening range.`,
        conceptTrained: 'Tight-aggressive preflop ranges',
        confidence: 'medium',
      });
    }
  }

  if (context.street === 'flop' && context.boardCards.length >= 3) {
    const texture = classifyBoardTexture(context.boardCards.slice(0, 3));
    return withPosition({
      ...profileBase,
      covered: false,
      advice: `${boardLabel(context.boardCards.slice(0, 3))} is ${texture}. If you were the preflop raiser in a heads-up single-raised pot, size c-bets by texture.`,
      conceptTrained: 'Board texture and c-bet sizing',
      confidence: 'medium',
    });
  }

  return withPosition({
    ...profileBase,
    advice: `${PROFILE_NAME} will give an adherence verdict after you act if this spot is covered.`,
    conceptTrained: 'Coverage honesty',
  });
}

function evaluatePreflop(context: StrategyDecisionContext): StrategyVerdict {
  if (!context.heroHoleCards) {
    return uncovered(context, 'Hero hole cards are unavailable, so preflop range evaluation is not covered.', 'Coverage honesty', 'high');
  }
  if (!context.position) {
    return uncovered(context, 'Hero position could not be mapped, so no preflop verdict is given.', 'Coverage honesty', 'high');
  }
  if (!hasBlindHistory(context.previousActions)) {
    return uncovered(context, 'Preflop blind history is missing, so GTO v1 cannot identify the action sequence.', 'Coverage honesty', 'high');
  }
  if (context.tableSize === 2) {
    return uncovered(
      context,
      'Heads-up preflop strategy is not implemented in GTO v1; EP/MP/CO rules are deliberately not applied.',
      'Heads-up coverage honesty',
      'high',
    );
  }

  const actions = preflopVoluntaryActions(context.previousActions);
  const nonFolds = nonFoldActions(actions);
  const firstNonFold = nonFolds[0];
  if (firstNonFold?.type === 'CALL') {
    return uncovered(context, 'Limped pots are not covered by GTO v1, so no adherence verdict is given.', 'Coverage honesty', 'high');
  }

  const raises = nonFolds.filter(a => a.type === 'RAISE' || a.type === 'BET' || a.type === 'ALL_IN');
  if (raises.length === 0) return evaluateRaiseFirstIn(context);
  if (raises.length === 1) return evaluateFacingSingleOpen(context, raises[0]!);

  return uncovered(context, 'Multi-raise preflop lines are not covered by GTO v1.', 'Coverage honesty', 'medium');
}

function evaluateRaiseFirstIn(context: StrategyDecisionContext): StrategyVerdict {
  const position = context.position;
  if (!position || position === 'SB' || position === 'BB' || position === 'BTN/SB') {
    return uncovered(context, `Raise-first-in rules for ${position ?? 'unknown'} are not covered by GTO v1.`, 'Coverage honesty', 'medium');
  }

  const inRange = isHandInGtoV1OpeningRange(position, context.heroHoleCards!);
  const target = 2.5 * context.bigBlind;
  const actionCorrect = inRange ? context.userAction === 'RAISE' : context.userAction === 'FOLD';
  const sizingCorrect = inRange && context.userAction === 'RAISE'
    ? isNear(context.userSizing, target, context.bigBlind * 0.25)
    : inRange
      ? null
      : context.userAction === 'FOLD';

  const tag = preflopOpeningViolationTag(position, inRange, context.userAction);
  const violatedRule = actionCorrect && sizingCorrect !== false
    ? null
    : inRange
      ? `${PROFILE_NAME} opens ${handLabel(context.heroHoleCards!)} from ${position} to 2.5bb first in.`
      : `${PROFILE_NAME} does not open ${handLabel(context.heroHoleCards!)} from ${position}.`;

  return covered(context, {
    baselineAction: inRange ? 'RAISE' : 'FOLD',
    ...(inRange ? { baselineSizing: `2.5bb (${formatAmount(target)})` } : {}),
    actionCorrect,
    sizingCorrect,
    violatedRule,
    violationTag: tag,
    explanation: inRange
      ? `${position} first-in range includes ${handLabel(context.heroHoleCards!)}. GTO v1 prefers opening to 2.5bb because tight-aggressive ranges pressure the blinds without risking excess chips. Concept: tight-aggressive preflop ranges.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`
      : `${position} first-in range excludes ${handLabel(context.heroHoleCards!)}. GTO v1 prefers folding because this position must pass through too many players with stronger continuing ranges. Concept: position-aware opening ranges.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
    conceptTrained: 'Tight-aggressive preflop ranges',
    confidence: 'medium',
  });
}

function evaluateFacingSingleOpen(context: StrategyDecisionContext, openAction: Action): StrategyVerdict {
  if (!context.position) {
    return uncovered(context, 'Hero position could not be mapped for the facing-open spot.', 'Coverage honesty', 'high');
  }

  const openerPosition = context.positionsByPlayerId[openAction.playerId];
  const openSize = actionAmount(openAction);
  if (!openerPosition || openSize === undefined) {
    return uncovered(context, 'The opener position or open size is missing, so GTO v1 cannot evaluate the 3-bet spot.', 'Coverage honesty', 'high');
  }

  const actions = preflopVoluntaryActions(context.previousActions);
  const callsAfterOpen = actions.filter(a => a.type === 'CALL');
  if (callsAfterOpen.length > 0) {
    return uncovered(context, 'Cold-call or multiway preflop lines after an open are not covered by GTO v1.', 'Coverage honesty', 'medium');
  }

  const heroHand = context.heroHoleCards!;
  const isBbDefense = context.position === 'BB' && ['EP', 'MP', 'CO', 'BTN', 'SB'].includes(openerPosition);
  const continueCandidate = isBbDefense
    ? isBigBlindDefenseCandidate(openerPosition, heroHand)
    : isThreeBetValueCandidate(heroHand);
  const threeBetCandidate = isBbDefense
    ? isBigBlindDefenseCandidate(openerPosition, heroHand)
    : isThreeBetValueCandidate(heroHand);

  const inPosition = isInPosition(context.position, openerPosition);
  const target = openSize * (inPosition ? 3 : 4);
  const sizingTag: WeaknessTag = inPosition ? 'wrong-3bet-sizing-ip' : 'wrong-3bet-sizing-oop';
  const sizingRule = `GTO v1 sizes 3-bets ${inPosition ? 'in position to 3x' : 'out of position to 4x'} the open.`;

  if (context.userAction === 'RAISE') {
    const actionCorrect = threeBetCandidate;
    const sizingCorrect = actionCorrect
      ? isNear(context.userSizing, target, Math.max(1, context.bigBlind * 0.5))
      : null;
    const violatedRule = !actionCorrect
      ? `${handLabel(heroHand)} is not in the simplified value-heavy 3-bet/defend range.`
      : sizingCorrect
        ? null
        : `${sizingRule} Facing ${formatAmount(openSize)}, prefer about ${formatAmount(target)}.`;

    return covered(context, {
      baselineAction: isBbDefense ? 'Continue or selective 3-bet' : '3-bet value-heavy',
      baselineSizing: `${inPosition ? '3x' : '4x'} open (${formatAmount(target)})`,
      actionCorrect,
      sizingCorrect,
      violatedRule,
      violationTag: violatedRule ? (actionCorrect ? sizingTag : 'too-loose-facing-open') : null,
      explanation: `Facing a ${formatAmount(openSize)} open from ${openerPosition}, ${context.position} is ${inPosition ? 'in position' : 'out of position'}. GTO v1 is value-heavy when 3-betting and prefers ${inPosition ? '3x' : '4x'} sizing because ${inPosition ? 'position improves equity realization' : 'out-of-position raises need more fold equity'}. Concept: position-aware 3-bet sizing.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
      conceptTrained: 'Position-aware 3-bet sizing',
      confidence: 'medium',
    });
  }

  if (context.userAction === 'CALL') {
    const actionCorrect = continueCandidate && isBbDefense;
    const violatedRule = actionCorrect
      ? null
      : `${PROFILE_NAME} only covers BB calls as simplified defends versus single opens.`;
    return covered(context, {
      baselineAction: isBbDefense && continueCandidate ? 'CALL or selective 3-bet' : 'FOLD',
      actionCorrect,
      sizingCorrect: true,
      violatedRule,
      violationTag: violatedRule ? 'too-loose-facing-open' : null,
      explanation: actionCorrect
        ? `${context.position} has already invested the blind and ${handLabel(heroHand)} is a plausible continue versus a ${openerPosition} open. GTO v1 allows calling or a selective 3-bet, with 4x open preferred if 3-betting out of position. Concept: defend playable hands without guessing.`
        : `${handLabel(heroHand)} is not covered as a profitable call here. GTO v1 avoids loose calls against opens unless the hand can clearly continue. Concept: disciplined preflop defence.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
      conceptTrained: 'Disciplined preflop defence',
      confidence: 'medium',
    });
  }

  const actionCorrect = !continueCandidate;
  const violatedRule = actionCorrect
    ? null
    : `${handLabel(heroHand)} is a plausible continue candidate versus this open.`;
  return covered(context, {
    baselineAction: continueCandidate ? (isBbDefense ? 'CALL or selective 3-bet' : '3-bet value-heavy') : 'FOLD',
    actionCorrect,
    sizingCorrect: true,
    violatedRule,
    violationTag: violatedRule ? (context.position === 'BB' ? 'under-defends-bb' : 'too-tight-button') : null,
    explanation: actionCorrect
      ? `${handLabel(heroHand)} is outside the simplified continue range facing a ${openerPosition} open. GTO v1 prefers folding and preserving chips. Concept: disciplined preflop defence.`
      : `${handLabel(heroHand)} can continue versus a ${openerPosition} open. GTO v1 prefers defending rather than over-folding, especially from the big blind with chips already posted. Concept: disciplined preflop defence.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
    conceptTrained: 'Disciplined preflop defence',
    confidence: 'medium',
  });
}

function evaluateFlop(context: StrategyDecisionContext): StrategyVerdict {
  if (!context.isHeadsUpPot || context.isMultiwayPot) {
    return uncovered(context, 'Multiway postflop pots are not covered by GTO v1, so no adherence verdict is given.', 'Coverage honesty', 'high');
  }
  if (context.boardCards.length < 3) {
    return uncovered(context, 'Flop cards are missing, so board texture cannot be evaluated.', 'Coverage honesty', 'high');
  }
  const singleRaised = singleRaisedHeadsUpPot(context.previousActions);
  if (!singleRaised.covered) {
    return uncovered(context, singleRaised.reason, 'Coverage honesty', 'high');
  }
  if (context.preflopAggressorId !== context.heroId) {
    return uncovered(context, 'GTO v1 currently evaluates flop c-bet spots only when hero was the preflop raiser.', 'Coverage honesty', 'medium');
  }
  if (hasPriorPostflopAggression(context.previousActions, 'flop', context.heroId)) {
    return uncovered(context, 'Flop spots facing a lead or raise are not covered by GTO v1.', 'Coverage honesty', 'medium');
  }

  const flop = context.boardCards.slice(0, 3);
  const texture = classifyBoardTexture(flop);
  const advantage = simpleRangeAdvantage(texture, flop);
  if (advantage === 'neutral') {
    return uncovered(context, `${boardLabel(flop)} is not a clear range-advantage board for GTO v1.`, 'Coverage honesty', 'medium');
  }

  const ratio = betRatio(context);
  const isBet = context.userAction === 'BET' || context.userAction === 'RAISE' || context.userAction === 'ALL_IN';

  if (texture === 'dry' && advantage === 'pfr') {
    const actionCorrect = isBet;
    const sizingCorrect = isBet ? ratio !== null && ratio >= 0.24 && ratio <= 0.36 : null;
    const violatedRule = actionCorrect && sizingCorrect !== false
      ? null
      : actionCorrect
        ? `Dry high-card c-bets prefer 25%-33% pot; ${formatRatio(ratio)} is too large.`
        : 'Dry high-card boards usually allow the preflop raiser to make a small continuation bet.';
    return covered(context, {
      baselineAction: 'BET',
      baselineSizing: '25%-33% pot',
      actionCorrect,
      sizingCorrect,
      violatedRule,
      violationTag: violatedRule ? 'overbets-dry-boards' : null,
      explanation: `${boardLabel(flop)} is ${texture}. The preflop raiser has range advantage on this high-card dry board; nut advantage is relevant because the raiser has more strong Broadway hands. GTO v1 prefers a 25%-33% c-bet because the raiser can pressure the caller cheaply. Concept: small c-bets on favourable dry boards.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
      conceptTrained: 'Small c-bets on favourable dry boards',
      confidence: 'high',
    });
  }

  if (texture === 'wet' || texture === 'dynamic') {
    const actionCorrect = isBet;
    const sizingCorrect = isBet ? ratio !== null && ratio >= 0.5 && ratio <= 0.75 : null;
    const violatedRule = actionCorrect && sizingCorrect !== false
      ? null
      : actionCorrect
        ? `Wet connected boards prefer 50%-75% sizing when betting; ${formatRatio(ratio)} does not fit.`
        : 'Wet connected boards should be bet more selectively and for larger sizing when betting.';
    return covered(context, {
      baselineAction: 'BET selectively',
      baselineSizing: '50%-75% pot',
      actionCorrect,
      sizingCorrect,
      violatedRule,
      violationTag: violatedRule ? 'over-cbets-wet-boards' : null,
      explanation: `${boardLabel(flop)} is ${texture}. The caller has more board interaction, so range advantage is neutral or caller-leaning and nut advantage matters more. GTO v1 does not use an automatic tiny c-bet here; when betting, it prefers 50%-75% pot. Concept: larger bets on wet boards.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
      conceptTrained: 'Larger bets on wet boards',
      confidence: 'medium',
    });
  }

  return uncovered(context, `${boardLabel(flop)} is ${texture}, but GTO v1 does not define a confident c-bet rule for it.`, 'Coverage honesty', 'medium');
}

function evaluateTurn(context: StrategyDecisionContext): StrategyVerdict {
  if (!context.isHeadsUpPot || context.isMultiwayPot) {
    return uncovered(context, 'Multiway turn pots are not covered by GTO v1.', 'Coverage honesty', 'high');
  }
  if (!context.heroHoleCards || context.boardCards.length < 4) {
    return uncovered(context, 'Turn hand-strength inputs are missing, so GTO v1 cannot score the action.', 'Coverage honesty', 'high');
  }
  const singleRaised = singleRaisedHeadsUpPot(context.previousActions);
  if (!singleRaised.covered) {
    return uncovered(context, singleRaised.reason, 'Coverage honesty', 'high');
  }

  const strength = classifyTurnStrength(context.heroHoleCards, context.boardCards.slice(0, 4));
  if (strength.kind === 'unreliable') {
    return uncovered(context, strength.reason, 'Coverage honesty', 'medium');
  }

  const isBet = context.userAction === 'BET' || context.userAction === 'RAISE' || context.userAction === 'ALL_IN';
  const ratio = betRatio(context);
  if (strength.kind === 'medium-made') {
    const actionCorrect = !isBet;
    const violatedRule = actionCorrect
      ? null
      : 'Turn betting becomes polar; medium-strength one-pair hands should usually check rather than bet as value.';
    return covered(context, {
      baselineAction: 'CHECK',
      actionCorrect,
      sizingCorrect: actionCorrect,
      violatedRule,
      violationTag: violatedRule ? 'turn-not-polar' : null,
      explanation: `The turn hand is medium-strength one pair. Range construction becomes more polar on the turn, so GTO v1 prefers checking this hand rather than betting it as if it were strong value. Concept: turn betting becomes more polar than flop betting.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
      conceptTrained: 'Turn betting becomes more polar than flop betting',
      confidence: 'medium',
    });
  }

  const actionCorrect = isBet;
  const sizingCorrect = isBet ? ratio !== null && ratio >= 0.6 && ratio <= 0.75 : null;
  const violatedRule = actionCorrect && sizingCorrect !== false
    ? null
    : actionCorrect
      ? `Turn polar bets prefer 60%-75% pot; ${formatRatio(ratio)} is outside the band.`
      : 'Strong value and strong draws should usually keep betting on the turn.';
  return covered(context, {
    baselineAction: 'BET',
    baselineSizing: '60%-75% pot',
    actionCorrect,
    sizingCorrect,
    violatedRule,
    violationTag: violatedRule ? 'turn-not-polar' : null,
    explanation: `The turn hand is ${strength.label}. GTO v1 keeps betting strong value and strong draws for 60%-75% pot because the turn range is more polar than the flop range. Concept: turn betting becomes more polar than flop betting.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
    conceptTrained: 'Turn betting becomes more polar than flop betting',
    confidence: 'medium',
  });
}

function evaluateRiver(context: StrategyDecisionContext): StrategyVerdict {
  if (!context.isHeadsUpPot || context.isMultiwayPot) {
    return uncovered(context, 'Multiway river pots are not covered by GTO v1.', 'Coverage honesty', 'high');
  }
  if (!context.heroHoleCards || context.boardCards.length < 5) {
    return uncovered(context, 'River hand-strength inputs are missing, so GTO v1 cannot score the action.', 'Coverage honesty', 'high');
  }
  const singleRaised = singleRaisedHeadsUpPot(context.previousActions);
  if (!singleRaised.covered) {
    return uncovered(context, singleRaised.reason, 'Coverage honesty', 'high');
  }

  const strength = classifyRiverStrength(context.heroHoleCards, context.boardCards.slice(0, 5));
  if (strength.kind === 'unreliable') {
    return uncovered(context, strength.reason, 'Coverage honesty', 'medium');
  }

  const isBet = context.userAction === 'BET' || context.userAction === 'RAISE' || context.userAction === 'ALL_IN';
  const ratio = betRatio(context);

  if (strength.kind === 'medium-one-pair') {
    const largeBet = isBet && ratio !== null && ratio >= 0.6;
    const actionCorrect = !largeBet;
    const sizingCorrect = isBet ? ratio !== null && ratio >= 0.2 && ratio <= 0.45 : true;
    const violatedRule = actionCorrect && sizingCorrect
      ? null
      : 'Large river bets should be polar; medium one-pair hands belong in check or thin-value sizing.';
    return covered(context, {
      baselineAction: 'CHECK or small thin-value bet',
      baselineSizing: '20%-45% pot when betting thin',
      actionCorrect,
      sizingCorrect,
      violatedRule,
      violationTag: violatedRule ? 'river-large-bet-merged-hand' : null,
      explanation: `The river hand is medium-strength one pair. Large river bets represent a polar range, and this hand is too merged for that story. GTO v1 prefers checking or a small thin-value bet. Concept: large river bets are polar.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
      conceptTrained: 'Large river bets are polar',
      confidence: 'medium',
    });
  }

  const actionCorrect = isBet;
  const sizingCorrect = isBet ? ratio !== null && ratio >= 0.6 && ratio <= 1.0 : null;
  const violatedRule = actionCorrect && sizingCorrect !== false
    ? null
    : actionCorrect
      ? `Strong river value can use large polar sizing; ${formatRatio(ratio)} is outside the 60%-100% band.`
      : 'Strong river value should usually bet for value.';
  return covered(context, {
    baselineAction: 'BET',
    baselineSizing: '60%-100% pot',
    actionCorrect,
    sizingCorrect,
    violatedRule,
    violationTag: violatedRule ? 'river-large-bet-merged-hand' : null,
    explanation: `The river hand is ${strength.label}. GTO v1 uses large bets with polar value because weaker bluff-catchers are pressured. Concept: large river bets are polar.${violatedRule ? ` Violated rule: ${violatedRule}` : ''}`,
    conceptTrained: 'Large river bets are polar',
    confidence: 'medium',
  });
}

export function classifyBoardTexture(cards: readonly Card[]): BoardTexture {
  const flop = cards.slice(0, 3);
  if (flop.length < 3) return 'dynamic';

  const values = flop.map(cardValue).sort((a, b) => b - a);
  const unique = [...new Set(values)].sort((a, b) => a - b);
  const suitCounts = new Map<string, number>();
  for (const card of flop) suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  const maxSuitCount = Math.max(...suitCounts.values());
  const paired = unique.length < 3;
  const span = unique[unique.length - 1]! - unique[0]!;
  const gaps = [values[0]! - values[1]!, values[1]! - values[2]!];
  const connectedLowMid = values[0]! <= 10 && span <= 4 && gaps.every(gap => gap <= 2);
  const highCard = values[0]! >= 12;
  const disconnected = gaps.some(gap => gap >= 4) || span >= 6;

  if (maxSuitCount === 3) return 'dynamic';
  if (maxSuitCount === 2 && connectedLowMid) return 'wet';
  if (connectedLowMid) return 'dynamic';
  if (paired && disconnected) return 'dry';
  if (maxSuitCount === 2) return highCard && disconnected ? 'semi-wet' : 'wet';
  if (highCard && disconnected) return 'dry';
  return disconnected ? 'dry' : 'semi-wet';
}

export function isHandInGtoV1OpeningRange(position: TablePosition, cards: readonly [Card, Card]): boolean {
  const hand = describeHand(cards);
  switch (position) {
    case 'EP':
      return pairAtLeast(hand, 7)
        || suitedAceAtLeast(hand, 11)
        || offsuitAceAtLeast(hand, 12)
        || exactCombo(hand, 'K', 'Q', true);
    case 'MP':
      return pairAtLeast(hand, 5)
        || suitedAceAtLeast(hand, 10)
        || offsuitAceAtLeast(hand, 11)
        || exactCombo(hand, 'K', 'Q', false)
        || suitedKingAtLeast(hand, 11);
    case 'CO':
      return hand.pair
        || (hand.suited && hand.highRank === 'A')
        || isBroadway(hand)
        || isSuitedConnector(hand);
    case 'BTN':
      return hand.pair
        || hand.highRank === 'A'
        || isBroadway(hand)
        || isSuitedConnector(hand)
        || (hand.suited && hand.highValue >= 11)
        || (!hand.suited && hand.highValue >= 13 && hand.lowValue >= 9)
        || (hand.suited && hand.gap <= 2 && hand.highValue >= 9);
    case 'SB':
    case 'BB':
    case 'BTN/SB':
      return false;
  }
}

function isBigBlindDefenseCandidate(openerPosition: TablePosition, cards: readonly [Card, Card]): boolean {
  const hand = describeHand(cards);
  const lateOpen = openerPosition === 'CO' || openerPosition === 'BTN' || openerPosition === 'SB';
  if (hand.pair) return true;
  if (hand.highRank === 'A' && (hand.suited || hand.lowValue >= (lateOpen ? 9 : 11))) return true;
  if (isBroadway(hand)) return true;
  if (hand.suited && (isSuitedConnector(hand) || hand.highValue >= 11)) return true;
  return lateOpen && !hand.suited && hand.highValue >= 12 && hand.lowValue >= 10;
}

function isThreeBetValueCandidate(cards: readonly [Card, Card]): boolean {
  const hand = describeHand(cards);
  return pairAtLeast(hand, 11)
    || (hand.highRank === 'A' && hand.lowRank === 'K')
    || (hand.suited && hand.highRank === 'A' && hand.lowValue >= 12);
}

function classifyTurnStrength(
  holeCards: readonly [Card, Card],
  boardCards: readonly Card[],
): { kind: 'strong-or-draw'; label: string } | { kind: 'medium-made'; label: string } | { kind: 'unreliable'; reason: string } {
  const category = evaluateHand([...holeCards, ...boardCards]).category;
  if (isStrongMadeHand(category) || isOverpair(holeCards, boardCards)) {
    return { kind: 'strong-or-draw', label: labelForCategory(category) };
  }
  if (category === 'pair') return { kind: 'medium-made', label: 'one pair' };
  if (hasFlushDraw(holeCards, boardCards) || hasOpenEndedStraightDraw(holeCards, boardCards)) {
    return { kind: 'strong-or-draw', label: 'a strong draw' };
  }
  return { kind: 'unreliable', reason: 'GTO v1 cannot reliably classify this turn hand as value, draw, or bluff candidate.' };
}

function classifyRiverStrength(
  holeCards: readonly [Card, Card],
  boardCards: readonly Card[],
): { kind: 'strong-value'; label: string } | { kind: 'medium-one-pair'; label: string } | { kind: 'unreliable'; reason: string } {
  const category = evaluateHand([...holeCards, ...boardCards]).category;
  if (isStrongMadeHand(category) || isOverpair(holeCards, boardCards)) {
    return { kind: 'strong-value', label: labelForCategory(category) };
  }
  if (category === 'pair') return { kind: 'medium-one-pair', label: 'one pair' };
  return { kind: 'unreliable', reason: 'GTO v1 does not score river air/bluff-catcher spots without blocker logic.' };
}

function covered(
  context: StrategyDecisionContext,
  input: {
    readonly baselineAction: string;
    readonly baselineSizing?: string;
    readonly actionCorrect: boolean;
    readonly sizingCorrect: boolean | null;
    readonly violatedRule: string | null;
    readonly violationTag: WeaknessTag | null;
    readonly explanation: string;
    readonly conceptTrained: string;
    readonly confidence: 'high' | 'medium' | 'low';
  },
): StrategyVerdict {
  const score = scoreDecision(input.actionCorrect, input.sizingCorrect);
  return {
    covered: true,
    profileId: PROFILE_ID,
    profileName: PROFILE_NAME,
    difficulty: context.difficulty,
    street: context.street,
    ...(context.position ? { position: context.position } : {}),
    baselineAction: input.baselineAction,
    ...(input.baselineSizing ? { baselineSizing: input.baselineSizing } : {}),
    userAction: context.userAction,
    ...(context.userSizing !== undefined ? { userSizing: formatAmount(context.userSizing) } : {}),
    userMatched: input.actionCorrect && input.sizingCorrect !== false,
    actionCorrect: input.actionCorrect,
    sizingCorrect: input.sizingCorrect,
    score,
    maxScore: MAX_SCORE,
    violatedRule: input.violatedRule,
    violationTag: input.violationTag,
    explanation: input.explanation,
    conceptTrained: input.conceptTrained,
    confidence: input.confidence,
  };
}

function uncovered(
  context: StrategyDecisionContext,
  explanation: string,
  conceptTrained: string,
  confidence: 'high' | 'medium' | 'low',
): StrategyVerdict {
  return {
    covered: false,
    profileId: PROFILE_ID,
    profileName: PROFILE_NAME,
    difficulty: context.difficulty,
    street: context.street,
    ...(context.position ? { position: context.position } : {}),
    userAction: context.userAction,
    ...(context.userSizing !== undefined ? { userSizing: formatAmount(context.userSizing) } : {}),
    userMatched: null,
    actionCorrect: null,
    sizingCorrect: null,
    score: null,
    maxScore: MAX_SCORE,
    violatedRule: null,
    violationTag: null,
    explanation: `${explanation} This spot is not covered by GTO v1, so no adherence verdict is given.`,
    conceptTrained,
    confidence,
  };
}

function scoreDecision(actionCorrect: boolean, sizingCorrect: boolean | null): number {
  let score = 0;
  if (actionCorrect) score += 10;
  if (sizingCorrect === true) score += 5;
  if (actionCorrect && sizingCorrect !== false) score += 10;
  return score;
}

function hasSupportedStackDepth(context: StrategyDecisionContext | StrategyAdviceContext): boolean {
  const heroStack = context.stackSizes[context.heroId];
  if (heroStack === undefined || context.bigBlind <= 0) return false;
  const stackBb = (heroStack + context.currentBetToCall) / context.bigBlind;
  return stackBb >= 40 && stackBb <= 250;
}

function hasBlindHistory(actions: readonly Action[]): boolean {
  return actions.some(action => action.type === 'POST_BLIND' && action.blindType === 'big');
}

function preflopVoluntaryActions(actions: readonly Action[]): Action[] {
  const out: Action[] = [];
  for (const action of actions) {
    if (action.type === 'DEAL_BOARD' && action.street === 'flop') break;
    if (VOLUNTARY_ACTIONS.has(action.type)) out.push(action);
  }
  return out;
}

function nonFoldActions(actions: readonly Action[]): Action[] {
  return actions.filter(action => action.type !== 'FOLD');
}

function singleRaisedHeadsUpPot(actions: readonly Action[]): { covered: true } | { covered: false; reason: string } {
  if (!hasBlindHistory(actions)) {
    return { covered: false, reason: 'Action history is missing blind posts, so the single-raised pot cannot be identified.' };
  }
  const preflop = preflopVoluntaryActions(actions);
  const nonFolds = nonFoldActions(preflop);
  if (nonFolds[0]?.type === 'CALL') {
    return { covered: false, reason: 'Limped pots are not covered by GTO v1.' };
  }
  const raises = nonFolds.filter(a => a.type === 'RAISE' || a.type === 'BET' || a.type === 'ALL_IN');
  const calls = nonFolds.filter(a => a.type === 'CALL');
  if (raises.length !== 1 || calls.length !== 1) {
    return { covered: false, reason: 'GTO v1 postflop rules currently require a heads-up single-raised pot with exactly one caller.' };
  }
  return { covered: true };
}

function hasPriorPostflopAggression(
  actions: readonly Action[],
  street: 'flop' | 'turn' | 'river',
  heroId: PlayerId,
): boolean {
  let current: 'preflop' | 'flop' | 'turn' | 'river' = 'preflop';
  for (const action of actions) {
    if (action.type === 'DEAL_BOARD') {
      current = action.street;
      continue;
    }
    if (current !== street || action.playerId === heroId) continue;
    if (action.type === 'BET' || action.type === 'RAISE' || action.type === 'ALL_IN') return true;
  }
  return false;
}

function simpleRangeAdvantage(texture: BoardTexture, flop: readonly Card[]): RangeAdvantage {
  const values = flop.map(cardValue).sort((a, b) => b - a);
  const highCard = values[0]! >= 12;
  const lowConnected = values[0]! <= 10 && values[0]! - values[2]! <= 4;
  if (texture === 'dry' && highCard) return 'pfr';
  if ((texture === 'wet' || texture === 'dynamic') && lowConnected) return 'caller';
  return 'neutral';
}

function betRatio(context: StrategyDecisionContext): number | null {
  if (context.userSizing === undefined || context.potSize <= 0) return null;
  return context.userSizing / context.potSize;
}

function preflopOpeningViolationTag(
  position: TablePosition,
  inRange: boolean,
  userAction: StrategyDecisionContext['userAction'],
): WeaknessTag | null {
  if (inRange && userAction === 'FOLD' && position === 'BTN') return 'too-tight-button';
  if (!inRange && userAction !== 'FOLD' && (position === 'EP' || position === 'MP')) return 'too-loose-early-position';
  if (!inRange && userAction !== 'FOLD') return 'too-loose-facing-open';
  return null;
}

function isInPosition(heroPosition: TablePosition, villainPosition: TablePosition): boolean {
  return postflopOrder(heroPosition) > postflopOrder(villainPosition);
}

function postflopOrder(position: TablePosition): number {
  switch (position) {
    case 'SB':
      return 1;
    case 'BB':
      return 2;
    case 'EP':
      return 3;
    case 'MP':
      return 4;
    case 'CO':
      return 5;
    case 'BTN':
    case 'BTN/SB':
      return 6;
  }
}

function hasFlushDraw(holeCards: readonly [Card, Card], boardCards: readonly Card[]): boolean {
  const cards = [...holeCards, ...boardCards];
  return holeCards.some(hole => cards.filter(card => card.suit === hole.suit).length === 4);
}

function hasOpenEndedStraightDraw(holeCards: readonly [Card, Card], boardCards: readonly Card[]): boolean {
  const values = new Set([...holeCards, ...boardCards].flatMap(card => {
    const value = cardValue(card);
    return value === 14 ? [14, 1] : [value];
  }));

  for (let start = 1; start <= 10; start++) {
    const window = [start, start + 1, start + 2, start + 3, start + 4];
    const present = window.filter(value => values.has(value));
    if (present.length !== 4) continue;
    const missing = window.find(value => !values.has(value));
    if (missing === start || missing === start + 4) return true;
  }
  return false;
}

function isStrongMadeHand(category: HandCategory): boolean {
  return category === 'two-pair'
    || category === 'three-of-a-kind'
    || category === 'straight'
    || category === 'flush'
    || category === 'full-house'
    || category === 'four-of-a-kind'
    || category === 'straight-flush';
}

function isOverpair(holeCards: readonly [Card, Card], boardCards: readonly Card[]): boolean {
  return holeCards[0].rank === holeCards[1].rank
    && cardValue(holeCards[0]) > Math.max(...boardCards.map(cardValue));
}

function labelForCategory(category: HandCategory): string {
  return category.replaceAll('-', ' ');
}

interface HandDescription {
  readonly highRank: Rank;
  readonly lowRank: Rank;
  readonly highValue: number;
  readonly lowValue: number;
  readonly suited: boolean;
  readonly pair: boolean;
  readonly gap: number;
}

function describeHand(cards: readonly [Card, Card]): HandDescription {
  const [a, b] = cards;
  const av = cardValue(a);
  const bv = cardValue(b);
  const high = av >= bv ? a : b;
  const low = av >= bv ? b : a;
  return {
    highRank: high.rank,
    lowRank: low.rank,
    highValue: Math.max(av, bv),
    lowValue: Math.min(av, bv),
    suited: a.suit === b.suit,
    pair: a.rank === b.rank,
    gap: Math.abs(av - bv),
  };
}

function pairAtLeast(hand: HandDescription, minPairValue: number): boolean {
  return hand.pair && hand.highValue >= minPairValue;
}

function suitedAceAtLeast(hand: HandDescription, minKickerValue: number): boolean {
  return hand.suited && hand.highRank === 'A' && hand.lowValue >= minKickerValue;
}

function offsuitAceAtLeast(hand: HandDescription, minKickerValue: number): boolean {
  return !hand.suited && hand.highRank === 'A' && hand.lowValue >= minKickerValue;
}

function suitedKingAtLeast(hand: HandDescription, minKickerValue: number): boolean {
  return hand.suited && hand.highRank === 'K' && hand.lowValue >= minKickerValue;
}

function exactCombo(hand: HandDescription, high: Rank, low: Rank, suited: boolean): boolean {
  return hand.highRank === high && hand.lowRank === low && hand.suited === suited;
}

function isBroadway(hand: HandDescription): boolean {
  return hand.highValue >= 10 && hand.lowValue >= 10;
}

function isSuitedConnector(hand: HandDescription): boolean {
  return hand.suited && hand.gap === 1 && hand.lowValue >= 4;
}

function handLabel(cards: readonly [Card, Card]): string {
  const hand = describeHand(cards);
  if (hand.pair) return `${hand.highRank}${hand.lowRank}`;
  return `${hand.highRank}${hand.lowRank}${hand.suited ? 's' : 'o'}`;
}

function boardLabel(cards: readonly Card[]): string {
  const ranks = cards.map(c => c.rank).join('');
  const suits = new Set(cards.map(c => c.suit));
  const suitText = suits.size === 1 ? 'monotone' : suits.size === 2 ? 'two-tone' : 'rainbow';
  return `${ranks} ${suitText}`;
}

function cardValue(card: Card): number {
  return RANK_VALUE[card.rank];
}

function actionAmount(action: Action): number | undefined {
  return 'amount' in action && typeof action.amount === 'number'
    ? action.amount
    : undefined;
}

function isNear(value: number | undefined, target: number, tolerance: number): boolean {
  return value !== undefined && Math.abs(value - target) <= tolerance;
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function formatRatio(ratio: number | null): string {
  return ratio === null ? 'no sizing' : `${Math.round(ratio * 100)}% pot`;
}
