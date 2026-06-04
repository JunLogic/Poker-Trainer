import type { HandRecord, PlayerId } from '@poker/engine';
import { replayLog } from '../../store/gameStore.js';
import type { HandAnnotations } from '../../types/thoughts.js';
import { StrategyWeaknessDashboard } from '../strategy/StrategyWeaknessDashboard.js';

interface Props {
  record: HandRecord;
  annotations: HandAnnotations;
  heroId: string;
  stacksBefore: Record<PlayerId, number>;
  stacksAfter: Record<PlayerId, number>;
  eliminatedThisHand: readonly PlayerId[];
  matchOver: boolean;
  onNext: () => void;
}

const HERO_ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);

export function MatchInterstitial({
  record, annotations, heroId, stacksBefore, stacksAfter, eliminatedThisHand, matchOver, onNext,
}: Props) {
  const nameOf = (id: PlayerId) => record.config.players.find(p => p.id === id)?.name ?? id;

  // Hero decisions + thoughts (resolved at decision time).
  const decisions = [];
  for (let i = 0; i < record.actionLog.length; i++) {
    const a = record.actionLog[i]!;
    if (a.playerId !== heroId || !HERO_ACTIONS.has(a.type)) continue;
    const before = replayLog(record.config, record.actionLog.slice(0, i));
    decisions.push({
      action: a,
      street: before.street,
      pot: before.sidePots.reduce((s, p) => s + p.amount, 0),
      thought: annotations.thoughts[a.id] ?? null,
      verdict: annotations.strategyVerdicts?.[a.id] ?? null,
    });
  }

  const ids = record.config.players.map(p => p.id);
  const strategyVerdicts = Object.values(annotations.strategyVerdicts ?? {});

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(8,10,14,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)', width: '100%', maxWidth: 540, maxHeight: '85vh', overflowY: 'auto',
        boxShadow: 'var(--shadow-pop)',
      }}>
        <h2 style={{ marginBottom: 4 }}>Hand complete</h2>
        <div className="tnum" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Pot {record.summary.potTotal} · reached {record.summary.streetReached}
        </div>

        {/* Stack changes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {ids.map(id => {
            const before = stacksBefore[id] ?? 0;
            const after = stacksAfter[id] ?? 0;
            const delta = after - before;
            const busted = eliminatedThisHand.includes(id);
            return (
              <div key={id} className="tnum" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 'var(--text-sm)' }}>
                <span style={{ width: 90, fontWeight: id === heroId ? 600 : 400, color: id === heroId ? 'var(--accent-strong)' : 'var(--text-primary)' }}>
                  {nameOf(id)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{before}</span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{after}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                  color: delta > 0 ? 'var(--success)' : delta < 0 ? 'var(--danger)' : 'var(--text-muted)',
                }}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
                {busted && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', fontWeight: 600, letterSpacing: '0.04em' }}>BUSTED</span>}
              </div>
            );
          })}
        </div>

        {/* Hero decisions + thoughts */}
        {decisions.length > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
              Your decisions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {decisions.map(({ action, street, pot, thought, verdict }) => (
                <div key={action.id} style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '8px 10px', fontSize: 'var(--text-sm)' }}>
                  <div className="tnum" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{street}</span>
                    <span style={{ color: 'var(--text-muted)' }}>pot {pot}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
                      {action.type}{'amount' in action && typeof action.amount === 'number' ? ` ${action.amount}` : ''}
                    </span>
                  </div>
                  {thought?.thought && (
                    <div style={{ borderLeft: '2px solid var(--accent)', paddingLeft: 'var(--space-2)', marginTop: 4, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      "{thought.thought}"
                    </div>
                  )}
                  {verdict && (
                    <div className="tnum" style={{ marginTop: 5, color: verdict.covered ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      Strategy: {verdict.covered ? `${verdict.score}/${verdict.maxScore}` : 'uncovered'} · {verdict.conceptTrained}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <StrategyWeaknessDashboard verdicts={strategyVerdicts} compact />

        <button className="btn-primary" style={{ width: '100%', padding: 'var(--space-3)', marginTop: 'var(--space-2)' }} onClick={onNext}>
          {matchOver ? 'View match results' : 'Next hand'}
        </button>
      </div>
    </div>
  );
}
