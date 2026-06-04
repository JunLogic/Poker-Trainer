import { useState } from 'react';
import {
  Gavel20Regular, Gavel20Filled,
  Bot20Regular, Bot20Filled,
  History20Regular, History20Filled,
  Dismiss16Regular,
} from '@fluentui/react-icons';
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

const NAV: Array<{ mode: Exclude<AppMode, 'home'>; label: string; Idle: typeof Gavel20Regular; Active: typeof Gavel20Filled }> = [
  { mode: 'umpire', label: 'Umpire', Idle: Gavel20Regular, Active: Gavel20Filled },
  { mode: 'practice', label: 'Practice', Idle: Bot20Regular, Active: Bot20Filled },
  { mode: 'history', label: 'History', Idle: History20Regular, Active: History20Filled },
];

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
        background: 'var(--bg-surface)',
        padding: 'var(--space-2) var(--space-4)',
        display: 'flex', gap: 'var(--space-2)', alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <button
          onClick={goHome}
          style={{
            background: 'transparent', border: 'none', padding: '4px 6px',
            fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)',
            letterSpacing: '-0.01em', marginRight: 'var(--space-1)',
          }}
        >
          Poker&nbsp;<span style={{ color: 'var(--accent-strong)' }}>Trainer</span>
        </button>
        {NAV.map(({ mode: m, label, Idle, Active }) => {
          const isActive = mode === m;
          const Glyph = isActive ? Active : Idle;
          return (
            <button key={m} onClick={() => { goHome(); setMode(m); }} style={{
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              color: isActive ? 'var(--accent-strong)' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-md)', padding: '5px 12px', fontSize: 'var(--text-sm)',
              fontWeight: isActive ? 600 : 500,
            }}>
              <Glyph style={{ fontSize: 18 }} /> {label}
            </button>
          );
        })}
        {(config || match) && (
          <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)', padding: '5px 12px' }} onClick={goHome}>
            <Dismiss16Regular /> Quit
          </button>
        )}
      </nav>

      <main style={{ flex: 1 }}>
        {mode === 'home' && (
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 16px', textAlign: 'center' }}>
            <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)' }}>Poker Trainer</h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto var(--space-7)', lineHeight: 'var(--leading-normal)' }}>
              Run live games with perfect rules enforcement, or practice solo against bots with a thoughts log and a strategy trainer.
            </p>
            <div style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', textAlign: 'left' }}>
              <HomeCard
                title="Umpire Mode" Icon={Gavel20Filled}
                desc="Referee a live table — enforce rules, track pots and side pots, settle showdowns."
                onClick={() => setMode('umpire')}
              />
              <HomeCard
                title="Practice Mode" Icon={Bot20Filled}
                desc="Play multiway vs bots with equity, a thoughts log, and strategy feedback."
                onClick={() => setMode('practice')}
              />
              <HomeCard
                title="Hand History" Icon={History20Filled}
                desc="Replay saved hands step by step with your reasoning and strategy verdicts."
                onClick={() => setMode('history')}
              />
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

function HomeCard({
  title, desc, Icon, onClick,
}: {
  title: string;
  desc: string;
  Icon: typeof Bot20Filled;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="panel"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-2)',
        textAlign: 'left', cursor: 'pointer', height: '100%',
        transition: 'border-color var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 'var(--radius-md)',
        background: 'var(--accent-soft)', color: 'var(--accent-strong)',
      }}>
        <Icon style={{ fontSize: 20 }} />
      </span>
      <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-normal)', fontWeight: 400 }}>{desc}</span>
    </button>
  );
}
