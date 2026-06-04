import type {
  StrategyPerformanceSummary,
  StrategyStreet,
  StrategyVerdict,
  StrategyWeaknessDashboardEntry,
  WeaknessTag,
} from './types.js';

const WEAKNESS_COPY: Record<WeaknessTag, Omit<StrategyWeaknessDashboardEntry, 'tag' | 'count'>> = {
  'overbets-dry-boards': {
    label: 'Over-bets dry boards',
    explanation: 'Dry, static boards usually do not need large continuation bets from the range-advantaged player.',
    suggestedFocus: 'On dry high-card boards as PFR, prefer 25%-33% pot rather than 75% pot.',
  },
  'wrong-3bet-sizing-oop': {
    label: 'Wrong 3-bet sizing OOP',
    explanation: 'Out-of-position 3-bets need more fold equity and give callers worse immediate odds.',
    suggestedFocus: 'When 3-betting out of position, use about 4x the open size.',
  },
  'wrong-3bet-sizing-ip': {
    label: 'Wrong 3-bet sizing IP',
    explanation: 'In-position 3-bets can apply pressure with a smaller size because position realizes equity better.',
    suggestedFocus: 'When 3-betting in position, use about 3x the open size.',
  },
  'too-loose-early-position': {
    label: 'Too loose early position',
    explanation: 'Early-position opens must pass through the entire table, so the baseline range is tight.',
    suggestedFocus: 'In EP, open strong pairs, strong suited aces, AQo+, and KQs.',
  },
  'too-tight-button': {
    label: 'Too tight on the button',
    explanation: 'The button acts last postflop and can profitably open many more hands.',
    suggestedFocus: 'Look for more BTN opens with playable broadways, suited aces, pairs, and suited connectors.',
  },
  'under-defends-bb': {
    label: 'Under-defends big blind',
    explanation: 'The big blind has already invested chips and often gets a price to continue versus late opens.',
    suggestedFocus: 'Versus late-position opens, continue with broadways, pairs, suited aces, and suited connectors.',
  },
  'over-cbets-wet-boards': {
    label: 'Auto c-bets wet boards',
    explanation: 'Wet connected boards interact strongly with the caller and should not be treated as tiny range bets.',
    suggestedFocus: 'On wet connected boards, use more selective betting and prefer 50%-75% sizing when betting.',
  },
  'turn-not-polar': {
    label: 'Turn range not polar',
    explanation: 'Turn betting should lean toward strong value, strong draws, and credible bluffs.',
    suggestedFocus: 'Check medium one-pair hands more often; bet strong value and strong draws for 60%-75%.',
  },
  'river-large-bet-merged-hand': {
    label: 'Large river bet with merged hand',
    explanation: 'Large river bets should be polar; medium one-pair hands are not strong enough for that size.',
    suggestedFocus: 'Use small thin-value sizing or check with medium one-pair river hands.',
  },
  'river-random-bluff': {
    label: 'Random river bluff',
    explanation: 'River bluffs need blockers or a credible story, which GTO v1 only handles conservatively.',
    suggestedFocus: 'Avoid large river bluffs without clear blocker or line credibility.',
  },
  'too-loose-facing-open': {
    label: 'Too loose facing an open',
    explanation: 'Continuing against a raise requires a hand that can realize equity or apply pressure.',
    suggestedFocus: 'Tighten calls and 3-bets against opens, especially out of position.',
  },
  'uncovered-spot': {
    label: 'Uncovered spot',
    explanation: 'GTO v1 intentionally skips spots it has not encoded with enough confidence.',
    suggestedFocus: 'Use these as candidates for future study rather than treating them as mistakes.',
  },
};

export function aggregateStrategyWeaknesses(
  verdicts: readonly StrategyVerdict[],
  limit = 5,
): StrategyWeaknessDashboardEntry[] {
  const counts = new Map<WeaknessTag, number>();
  for (const verdict of verdicts) {
    const tag = verdict.covered ? verdict.violationTag : 'uncovered-spot';
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count, ...WEAKNESS_COPY[tag] }));
}

export function summarizeStrategyPerformance(
  verdicts: readonly StrategyVerdict[],
): StrategyPerformanceSummary {
  const covered = verdicts.filter(v => v.covered);
  const uncoveredCount = verdicts.length - covered.length;
  const maxScore = covered.reduce((sum, v) => sum + v.maxScore, 0);
  const score = covered.reduce((sum, v) => sum + (v.score ?? 0), 0);

  const streetBuckets = new Map<StrategyStreet, { score: number; max: number }>();
  const positionBuckets = new Map<string, { score: number; max: number }>();

  for (const verdict of covered) {
    addBucket(streetBuckets, verdict.street, verdict.score ?? 0, verdict.maxScore);
    if (verdict.position) {
      addBucket(positionBuckets, verdict.position, verdict.score ?? 0, verdict.maxScore);
    }
  }

  return {
    coveredCount: covered.length,
    uncoveredCount,
    maxScore,
    score,
    overallAccuracy: maxScore > 0 ? score / maxScore : null,
    streetAccuracy: Object.fromEntries(
      [...streetBuckets.entries()].map(([street, bucket]) => [street, bucket.score / bucket.max]),
    ),
    positionAccuracy: Object.fromEntries(
      [...positionBuckets.entries()].map(([position, bucket]) => [position, bucket.score / bucket.max]),
    ),
  };
}

function addBucket<K>(map: Map<K, { score: number; max: number }>, key: K, score: number, max: number): void {
  const current = map.get(key) ?? { score: 0, max: 0 };
  map.set(key, { score: current.score + score, max: current.max + max });
}
