import { useState } from 'react';
import { useGameStore } from './store/gameStore.js';
import { useMatchStore } from './store/matchStore.js';
import { useGameState } from './hooks/useGameState.js';
import { UmpireSetup } from './components/umpire/UmpireSetup.js';
import { UmpireTable } from './components/umpire/UmpireTable.js';
import { PracticeMatch } from './components/practice/PracticeMatch.js';
import { HandHistoryList } from './components/history/HandHistoryList.js';
import { HandReplayViewer } from './components/history/HandReplayViewer.js';
import type { HandRecord } from '@poker/engine';

type AppMode = 'home' | 'umpire' | 'practice' | 'history';

export function App() {
  const [mode, setMode] = useState<AppMode>('home');
  const [replayRecord, setReplayRecord] = useState<HandRecord | null>(null);

  const config = useGameStore(s => s.config);
  const resetHand = useGameStore(s => s.resetHand);
  const resetMatch = useMatchStore(s => s.reset);
  const match = useMatchStore(s => s.match);

  const state = useGameState();

  function goHome() {
    resetHand();
    resetMatch();
    setMode('home');
    setReplayRecord(null);
  }

  if (replayRecord) {
    return <HandReplayViewer record={replayRecord} onBack={() => setReplayRecord(null)} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{
        background: 'rgba(0,0,0,0.4)',
        padding: '10px 16px',
        display: 'flex', gap: 12, alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--color-gold)', letterSpacing: 1 }}>
          ♠ Poker
        </span>
        {(['umpire', 'practice', 'history'] as const).map(m => (
          <button key={m} onClick={() => { goHome(); setMode(m); }} style={{
            background: mode === m ? 'rgba(212,168,67,0.2)' : 'transparent',
            border: mode === m ? '1px solid var(--color-gold)' : '1px solid transparent',
            color: mode === m ? 'var(--color-gold)' : 'var(--color-text-dim)',
            borderRadius: 6, padding: '4px 10px', fontSize: '0.85rem', cursor: 'pointer',
          }}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
        {(config || match) && (
          <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: '0.8rem' }} onClick={goHome}>
            ✕ Quit
          </button>
        )}
      </nav>

      <main style={{ flex: 1 }}>
        {mode === 'home' && (
          <div style={{ textAlign: 'center', padding: '60px 16px' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: 8, color: 'var(--color-gold)' }}>Poker Umpire & Practice</h1>
            <p style={{ color: 'var(--color-text-dim)', maxWidth: 400, margin: '0 auto 40px' }}>
              Run live games with perfect rules enforcement, or practice solo against bots with a thoughts log.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn-call" style={{ padding: '14px 28px', fontSize: '1rem' }} onClick={() => setMode('umpire')}>
                🃏 Umpire Mode
              </button>
              <button className="btn-raise" style={{ padding: '14px 28px', fontSize: '1rem' }} onClick={() => setMode('practice')}>
                🤖 Practice Mode
              </button>
              <button className="btn-ghost" style={{ padding: '14px 28px', fontSize: '1rem' }} onClick={() => setMode('history')}>
                📖 Hand History
              </button>
            </div>
          </div>
        )}

        {mode === 'umpire' && (
          config && state
            ? <UmpireTable state={state} />
            : <UmpireSetup />
        )}

        {mode === 'practice' && <PracticeMatch />}

        {mode === 'history' && (
          <HandHistoryList onSelect={record => setReplayRecord(record)} />
        )}
      </main>
    </div>
  );
}
