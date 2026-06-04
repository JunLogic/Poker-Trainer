import { useEffect } from 'react';
import { History20Regular } from '@fluentui/react-icons';
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
      <div style={{ textAlign: 'center', padding: 'var(--space-7)', color: 'var(--text-muted)' }}>
        No completed hands yet.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--space-4)' }}>
      <h2 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <History20Regular style={{ color: 'var(--accent)' }} /> Hand History
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {hands.map(hand => (
          <button
            key={hand.handId}
            className="btn-ghost"
            onClick={() => onSelect(hand)}
            style={{
              textAlign: 'left',
              padding: 'var(--space-3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                {hand.summary.playerNames.join(' vs ')}
              </div>
              <div className="tnum" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                {new Date(hand.startedAt).toLocaleString()} · reached {hand.summary.streetReached}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="tnum" style={{ color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                Pot {hand.summary.potTotal}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--success)' }}>
                Winner: {hand.summary.winnerIds.join(', ')}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
