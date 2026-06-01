import { useEffect } from 'react';
import { useHistoryStore } from '../../store/historyStore.js';
import type { HandRecord } from '@poker/engine';

interface Props {
  onSelect: (record: HandRecord) => void;
}

export function HandHistoryList({ onSelect }: Props) {
  const { hands, refresh } = useHistoryStore();

  useEffect(() => { refresh(); }, []);

  if (hands.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-dim)' }}>
        No completed hands yet.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 16 }}>
      <h2 style={{ marginBottom: 16, color: 'var(--color-gold)' }}>Hand History</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hands.map(hand => (
          <button
            key={hand.handId}
            className="btn-ghost"
            onClick={() => onSelect(hand)}
            style={{
              textAlign: 'left',
              padding: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {hand.summary.playerNames.join(' vs ')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)', marginTop: 2 }}>
                {new Date(hand.startedAt).toLocaleString()} · reached {hand.summary.streetReached}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--color-gold)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                Pot {hand.summary.potTotal}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-call)' }}>
                Winner: {hand.summary.winnerIds.join(', ')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
