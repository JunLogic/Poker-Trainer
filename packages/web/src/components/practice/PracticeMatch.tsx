import { useState, useCallback } from 'react';
import { startNextHand, applyHandResult, isMatchOver } from '@poker/engine';
import type { MatchConfig, HandRecord, PlayerId, AwardPotAction } from '@poker/engine';
import { MatchSetup } from './MatchSetup.js';
import { PracticeTable } from './PracticeTable.js';
import { MatchInterstitial } from './MatchInterstitial.js';
import { MatchResults } from './MatchResults.js';
import { useMatchStore } from '../../store/matchStore.js';
import { useGameStore, replayLog } from '../../store/gameStore.js';
import { usePracticeStore } from '../../store/practiceStore.js';
import { useThoughtsStore } from '../../store/thoughtsStore.js';
import { useHistoryStore } from '../../store/historyStore.js';
import { useSettingsStore } from '../../store/settingsStore.js';
import { useGameState } from '../../hooks/useGameState.js';
import { dealHand } from './practiceFlow.js';
import type { HandAnnotations } from '../../types/thoughts.js';

interface InterstitialData {
  record: HandRecord;
  annotations: HandAnnotations;
  stacksBefore: Record<PlayerId, number>;
  stacksAfter: Record<PlayerId, number>;
  eliminatedThisHand: PlayerId[];
  matchOver: boolean;
}

export function PracticeMatch() {
  const match = useMatchStore(s => s.match);
  const botProfileById = useMatchStore(s => s.botProfileById);
  const heroId = useMatchStore(s => s.heroId);
  const showOdds = useSettingsStore(s => s.showOdds);

  const state = useGameState();

  const [interstitial, setInterstitial] = useState<InterstitialData | null>(null);
  const [phase, setPhase] = useState<'playing' | 'results'>('playing');

  // Begin a new hand from a given match state: deal cards, post blinds, seed the log.
  const beginNextHand = useCallback((matchState: NonNullable<typeof match>) => {
    const { state: ms, handConfig, blinds } = startNextHand(matchState);
    const { actions, boardCards } = dealHand(handConfig, blinds);

    useThoughtsStore.getState().clearThoughts();
    useGameStore.getState().loadHand(handConfig, actions);
    usePracticeStore.getState().setBoardCards(boardCards);
    useMatchStore.getState().setMatch(ms);
  }, []);

  const handleStart = useCallback((config: MatchConfig, profiles: Record<string, string>, hero: string) => {
    useMatchStore.getState().startMatch(config, profiles, hero);
    const created = useMatchStore.getState().match!;
    setPhase('playing');
    beginNextHand(created);
  }, [beginNextHand]);

  const handleHandComplete = useCallback((annotations: HandAnnotations, finalStacks: Record<PlayerId, number>) => {
    const cfg = useGameStore.getState().config;
    const log = useGameStore.getState().actionLog;
    const cur = useMatchStore.getState().match;
    if (!cfg || !cur) return;

    const finalState = replayLog(cfg, log);
    const awards = log.filter(a => a.type === 'AWARD_POT') as AwardPotAction[];
    const winnerIds = [...new Set(awards.flatMap(a => a.winnerIds))];
    const potTotal = awards.reduce((s, a) => s + a.amount, 0)
      || finalState.sidePots.reduce((s, p) => s + p.amount, 0);

    const record: HandRecord = {
      handId: cfg.handId,
      startedAt: log[0]?.timestamp ?? Date.now(),
      finishedAt: Date.now(),
      config: cfg,
      actionLog: log,
      summary: {
        playerNames: cfg.players.map(p => p.name),
        winnerIds,
        potTotal,
        streetReached: finalState.street,
      },
    };

    useHistoryStore.getState().saveRecord(record, annotations);

    const stacksBefore = { ...cur.stacks };
    const ms2 = applyHandResult(cur, cfg.handId, finalStacks);
    useMatchStore.getState().setMatch(ms2);

    const eliminatedThisHand = ms2.eliminated.filter(id => !cur.eliminated.includes(id));
    setInterstitial({
      record, annotations, stacksBefore, stacksAfter: { ...ms2.stacks },
      eliminatedThisHand, matchOver: isMatchOver(ms2),
    });
  }, []);

  const handleNext = useCallback(() => {
    const cur = useMatchStore.getState().match!;
    setInterstitial(null);
    if (isMatchOver(cur)) {
      setPhase('results');
    } else {
      beginNextHand(cur);
    }
  }, [beginNextHand]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!match) {
    return <MatchSetup onStart={handleStart} />;
  }

  if (phase === 'results') {
    return <MatchResults match={match} heroId={heroId} />;
  }

  return (
    <>
      {state && (
        <PracticeTable
          state={state}
          botProfileById={botProfileById}
          heroId={heroId}
          showOdds={showOdds}
          onHandComplete={handleHandComplete}
        />
      )}
      {interstitial && (
        <MatchInterstitial
          record={interstitial.record}
          annotations={interstitial.annotations}
          heroId={heroId}
          stacksBefore={interstitial.stacksBefore}
          stacksAfter={interstitial.stacksAfter}
          eliminatedThisHand={interstitial.eliminatedThisHand}
          matchOver={interstitial.matchOver}
          onNext={handleNext}
        />
      )}
    </>
  );
}
