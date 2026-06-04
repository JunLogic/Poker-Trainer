import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Gavel20Filled, Play20Filled } from '@fluentui/react-icons';
import { useGameStore } from '../../store/gameStore.js';
import { useSettingsStore } from '../../store/settingsStore.js';

export function UmpireSetup() {
  const { players, smallBlind, bigBlind, ante, dealerSeatIndex, setPlayers, setBlinds, setDealer } =
    useSettingsStore();
  const startHand = useGameStore(s => s.startHand);

  const [numPlayers, setNumPlayers] = useState(players.length);

  function handleNumChange(n: number) {
    setNumPlayers(n);
    const next = Array.from({ length: n }, (_, i) => ({
      id: players[i]?.id ?? `p${i + 1}`,
      name: players[i]?.name ?? `Player ${i + 1}`,
      startingStack: players[i]?.startingStack ?? 1000,
    }));
    setPlayers(next);
  }

  function handleStart() {
    startHand({
      mode: 'umpire',
      smallBlind,
      bigBlind,
      ante,
      dealerSeatIndex,
      players: players.map((p, i) => ({ id: p.id, name: p.name, seatIndex: i, startingStack: p.startingStack })),
      startingStacks: Object.fromEntries(players.map(p => [p.id, p.startingStack])),
    });
  }

  return (
    <div className="panel" style={{ maxWidth: 480, margin: '0 auto', marginTop: 32 }}>
      <h2 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <Gavel20Filled style={{ color: 'var(--accent)' }} /> Umpire Mode Setup
      </h2>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Players</label>
        <select value={numPlayers} onChange={e => handleNumChange(Number(e.target.value))}>
          {[2, 3, 4, 5, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        {players.map((p, i) => (
          <div key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={p.name}
              onChange={e => {
                const next = [...players];
                next[i] = { ...next[i]!, name: e.target.value };
                setPlayers(next);
              }}
              placeholder={`Player ${i + 1}`}
              style={{ flex: 1 }}
            />
            <input
              type="number"
              value={p.startingStack}
              min={1}
              onChange={e => {
                const next = [...players];
                next[i] = { ...next[i]!, startingStack: Number(e.target.value) };
                setPlayers(next);
              }}
              style={{ width: 90 }}
              placeholder="Stack"
            />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Small Blind</label>
          <input type="number" value={smallBlind} min={1} onChange={e => setBlinds(Number(e.target.value), bigBlind, ante)} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Big Blind</label>
          <input type="number" value={bigBlind} min={1} onChange={e => setBlinds(smallBlind, Number(e.target.value), ante)} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Ante</label>
          <input type="number" value={ante} min={0} onChange={e => setBlinds(smallBlind, bigBlind, Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Dealer seat</label>
        <select value={dealerSeatIndex} onChange={e => setDealer(Number(e.target.value))}>
          {players.map((p, i) => <option key={i} value={i}>{p.name} (seat {i + 1})</option>)}
        </select>
      </div>

      <button className="btn-primary" style={{ width: '100%', padding: 'var(--space-3)' }} onClick={handleStart}>
        <Play20Filled /> Start Hand
      </button>
    </div>
  );
}
