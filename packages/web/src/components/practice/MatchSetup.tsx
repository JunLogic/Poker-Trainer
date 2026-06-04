import { useState } from 'react';
import { nanoid } from 'nanoid';
import { BOT_PROFILES, DEFAULT_PROFILE_KEYS, listStrategyProfiles } from '@poker/engine';
import type { DifficultyLevel } from '@poker/engine';
import type { MatchConfig } from '@poker/engine';
import { useSettingsStore } from '../../store/settingsStore.js';

interface Props {
  onStart: (config: MatchConfig, botProfileById: Record<string, string>, heroId: string) => void;
}

const PROFILE_KEYS = Object.keys(BOT_PROFILES);
const STRATEGY_PROFILES = listStrategyProfiles();
const DIFFICULTIES: readonly DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

export function MatchSetup({ onStart }: Props) {
  const {
    smallBlind,
    bigBlind,
    setBlinds,
    showOdds,
    setShowOdds,
    showStrategyAdvice,
    setShowStrategyAdvice,
    strategyProfileId,
    setStrategyProfileId,
    strategyDifficulty,
    setStrategyDifficulty,
  } = useSettingsStore();
  const [numBots, setNumBots] = useState(1);
  const [stack, setStack] = useState(1000);
  // profile per bot index; default to a sensible rotating mix
  const [profiles, setProfiles] = useState<string[]>(
    Array.from({ length: 5 }, (_, i) => DEFAULT_PROFILE_KEYS[i % DEFAULT_PROFILE_KEYS.length]!),
  );

  function setProfileAt(i: number, key: string) {
    setProfiles(prev => { const next = [...prev]; next[i] = key; return next; });
  }

  function handleStart() {
    const heroId = 'hero';
    const botIds = Array.from({ length: numBots }, (_, i) => `bot${i + 1}`);

    const players = [
      { id: heroId, name: 'You', seatIndex: 0, isHuman: true },
      ...botIds.map((id, i) => ({
        id, name: BOT_PROFILES[profiles[i]!]?.label ?? `Bot ${i + 1}`,
        seatIndex: i + 1, botProfile: profiles[i]!,
      })),
    ];

    const config: MatchConfig = {
      matchId: nanoid(),
      players,
      startingStack: stack,
      smallBlind,
      bigBlind,
      ante: 0,
    };

    const botProfileById: Record<string, string> = {};
    botIds.forEach((id, i) => { botProfileById[id] = profiles[i]!; });

    onStart(config, botProfileById, heroId);
  }

  return (
    <div className="panel" style={{ maxWidth: 420, margin: '32px auto' }}>
      <h2 style={{ marginBottom: 4, color: 'var(--color-gold)' }}>New Match</h2>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)', marginBottom: 16 }}>
        Play hands until one player remains. Stacks carry over; the button rotates each hand.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Opponents</label>
        <select value={numBots} onChange={e => setNumBots(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} bot{n > 1 ? 's' : ''}</option>)}
        </select>
      </div>

      {/* Per-opponent profile pickers */}
      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {Array.from({ length: numBots }, (_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8rem', width: 54, color: 'var(--color-text-dim)' }}>Bot {i + 1}</span>
            <select value={profiles[i]} onChange={e => setProfileAt(i, e.target.value)} style={{ flex: 1 }}>
              {PROFILE_KEYS.map(key => (
                <option key={key} value={key}>{BOT_PROFILES[key]!.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Starting stack</label>
        <input type="number" value={stack} min={20} onChange={e => setStack(Number(e.target.value))} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Small blind</label>
          <input type="number" value={smallBlind} min={1} onChange={e => setBlinds(Number(e.target.value), bigBlind)} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Big blind</label>
          <input type="number" value={bigBlind} min={1} onChange={e => setBlinds(smallBlind, Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', marginBottom: 16, cursor: 'pointer' }}>
        <input type="checkbox" checked={showOdds} onChange={e => setShowOdds(e.target.checked)} />
        Show my equity (odds) during play
      </label>

      <div style={{
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 16,
        background: 'rgba(255,255,255,0.03)',
      }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          Strategy Trainer
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            Profile
            <select value={strategyProfileId} onChange={e => setStrategyProfileId(e.target.value)}>
              {STRATEGY_PROFILES.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            Difficulty
            <select value={strategyDifficulty} onChange={e => setStrategyDifficulty(e.target.value as DifficultyLevel)}>
              {DIFFICULTIES.map(level => (
                <option key={level} value={level}>{level[0]!.toUpperCase() + level.slice(1)}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={showStrategyAdvice} onChange={e => setShowStrategyAdvice(e.target.checked)} />
            Show advice before acting
          </label>
        </div>
      </div>

      <button className="btn-call" style={{ width: '100%', padding: 12 }} onClick={handleStart}>
        Start Match
      </button>
    </div>
  );
}
