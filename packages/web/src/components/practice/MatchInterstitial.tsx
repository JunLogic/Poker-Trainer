import type { HandRecord, PlayerId } from '@poker/engine';
import { replayLog } from '../../store/gameStore.js';
import type { HandAnnotations } from '../../types/thoughts.js';

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
    });
  }

  const ids = record.config.players.map(p => p.id);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        background: 'var(--color-felt-dark)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16,
        padding: 24, width: '100%', maxWidth: 540, maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}>
        <h2 style={{ color: 'var(--color-gold)', marginBottom: 4 }}>Hand complete</h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 16 }}>
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
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                <span style={{ width: 90, fontWeight: id === heroId ? 700 : 400, color: id === heroId ? 'var(--color-gold)' : 'var(--color-text)' }}>
                  {nameOf(id)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-dim)' }}>{before}</span>
                <span style={{ color: 'var(--color-text-dim)' }}>→</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{after}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
                  color: delta > 0 ? 'var(--color-call)' : delta < 0 ? 'var(--color-fold)' : 'var(--color-text-dim)',
                }}>
                  {delta > 0 ? `+${delta}` : delta}
                </span>
                {busted && <span style={{ fontSize: '0.7rem', color: 'var(--color-fold)', fontWeight: 700 }}>BUSTED</span>}
              </div>
            );
          })}
        </div>

        {/* Hero decisions + thoughts */}
        {decisions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Your decisions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {decisions.map(({ action, street, pot, thought }) => (
                <div key={action.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', textTransform: 'capitalize' }}>{street}</span>
                    <span style={{ color: 'var(--color-text-dim)' }}>pot {pot}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 700 }}>
                      {action.type}{'amount' in action && typeof action.amount === 'number' ? ` ${action.amount}` : ''}
                    </span>
                  </div>
                  {thought?.thought && (
                    <div style={{ borderLeft: '3px solid rgba(212,168,67,0.5)', paddingLeft: 8, marginTop: 4, fontStyle: 'italic', color: 'var(--color-text)' }}>
                      "{thought.thought}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn-call" style={{ width: '100%', padding: 10 }} onClick={onNext}>
          {matchOver ? 'View match results' : 'Next hand'}
        </button>
      </div>
    </div>
  );
}
