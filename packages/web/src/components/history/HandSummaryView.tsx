import type { HandRecord, Action } from '@poker/engine';
import type { HandAnnotations, ThoughtEntry } from '../../types/thoughts.js';
import { replayLog } from '../../store/gameStore.js';

interface Props {
  record: HandRecord;
  annotations: HandAnnotations;
  heroId: string;
  onClose: () => void;
}

const HERO_ACTION_TYPES = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);

const ACTION_COLORS: Record<string, string> = {
  FOLD: 'var(--color-fold)',
  CHECK: '#7f8c8d',
  CALL: 'var(--color-call)',
  BET: 'var(--color-raise)',
  RAISE: 'var(--color-raise)',
  ALL_IN: 'var(--color-allin)',
};

export function HandSummaryView({ record, annotations, heroId, onClose }: Props) {
  // Collect every hero betting action with its context
  const decisions: Array<{
    action: Action;
    index: number;
    thought: ThoughtEntry | null;
    street: string;
    pot: number;
  }> = [];

  for (let i = 0; i < record.actionLog.length; i++) {
    const action = record.actionLog[i];
    if (!action) continue;
    if (action.playerId !== heroId) continue;
    if (!HERO_ACTION_TYPES.has(action.type)) continue;

    // Replay up to just before this action to get the state at decision time
    const stateBefore = replayLog(record.config, record.actionLog.slice(0, i));
    const pot = stateBefore.sidePots.reduce((s, p) => s + p.amount, 0);

    decisions.push({
      action,
      index: i,
      thought: annotations.thoughts[action.id] ?? null,
      street: stateBefore.street,
      pot,
    });
  }

  const winners = record.summary.winnerIds;
  const heroWon = winners.includes(heroId);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        background: 'var(--color-felt-dark)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16, padding: 24,
        width: '100%', maxWidth: 560,
        maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: 'var(--color-gold)', marginBottom: 4 }}>Hand Summary</h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-dim)' }}>
              {new Date(record.startedAt).toLocaleString()}
              {' · '}reached {record.summary.streetReached}
              {' · '}pot {record.summary.potTotal}
            </div>
          </div>
          <div style={{
            padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700,
            background: heroWon ? 'rgba(39,174,96,0.2)' : 'rgba(192,57,43,0.2)',
            border: `1px solid ${heroWon ? 'var(--color-call)' : 'var(--color-fold)'}`,
            color: heroWon ? 'var(--color-call)' : 'var(--color-fold)',
          }}>
            {heroWon ? 'Won' : 'Lost'}
          </div>
        </div>

        {/* Decision table */}
        {decisions.length === 0 ? (
          <div style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>No decisions recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {decisions.map(({ action, index, thought, street, pot }) => (
              <div key={action.id} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                {/* Row 1: context */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: thought ? 8 : 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    #{index + 1} · {street}
                  </span>
                  {pot > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                      pot {pot}
                    </span>
                  )}
                  {thought && thought.equity > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                      equity {(thought.equity * 100).toFixed(0)}%
                    </span>
                  )}
                  {thought && thought.betToCall > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                      to call {thought.betToCall}
                    </span>
                  )}
                  {/* Action badge */}
                  <span style={{
                    marginLeft: 'auto',
                    padding: '2px 10px', borderRadius: 99,
                    fontSize: '0.78rem', fontWeight: 700,
                    background: `${ACTION_COLORS[action.type] ?? '#888'}22`,
                    border: `1px solid ${ACTION_COLORS[action.type] ?? '#888'}55`,
                    color: ACTION_COLORS[action.type] ?? 'var(--color-text)',
                  }}>
                    {action.type}
                    {'amount' in action && typeof action.amount === 'number' ? ` ${action.amount}` : ''}
                  </span>
                </div>

                {/* Thought (if logged) */}
                {thought && thought.thought && (
                  <div style={{
                    borderLeft: '3px solid rgba(212,168,67,0.5)',
                    paddingLeft: 10, marginTop: 4,
                    fontSize: '0.82rem', color: 'var(--color-text)',
                    fontStyle: 'italic', lineHeight: 1.5,
                  }}>
                    "{thought.thought}"
                  </div>
                )}
                {thought && !thought.thought && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>
                    — no thought logged
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          className="btn-call"
          style={{ marginTop: 20, width: '100%', padding: '10px' }}
          onClick={onClose}
        >
          New Hand
        </button>
      </div>
    </div>
  );
}
