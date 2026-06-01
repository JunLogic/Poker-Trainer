import { useState } from 'react';
import { nanoid } from 'nanoid';
import { createDeck, shuffle } from '@poker/engine';
import { useGameStore } from '../../store/gameStore.js';
import { useSettingsStore } from '../../store/settingsStore.js';
import type { DealHoleCardsAction } from '@poker/engine';

interface Props {
  onBotIds: (ids: string[]) => void;
}

export function PracticeSetup({ onBotIds }: Props) {
  const { smallBlind, bigBlind, setBlinds, dealerSeatIndex, setDealer } = useSettingsStore();
  const { startHand, appendAction } = useGameStore();
  const [numBots, setNumBots] = useState(2);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [stack, setStack] = useState(1000);

  function handleStart() {
    const humanId = 'hero';
    const botIds = Array.from({ length: numBots }, (_, i) => `bot${i + 1}`);
    const allIds = [humanId, ...botIds];

    const players = allIds.map((id, i) => ({
      id,
      name: id === 'hero' ? 'You' : `Bot ${i}`,
      seatIndex: i,
      startingStack: stack,
    }));

    const config = {
      handId: nanoid(),
      mode: 'practice' as const,
      smallBlind,
      bigBlind,
      ante: 0,
      dealerSeatIndex,
      players,
      startingStacks: Object.fromEntries(allIds.map(id => [id, stack])),
    };

    // Deal hole cards
    const deck = shuffle(createDeck());
    let cursor = 0;

    startHand(config);

    // Deal 2 cards to each player
    for (const player of players) {
      const c1 = deck[cursor++]!;
      const c2 = deck[cursor++]!;
      appendAction({
        id: nanoid(),
        playerId: player.id,
        timestamp: Date.now(),
        type: 'DEAL_HOLE_CARDS',
        cards: [c1, c2],
      } as DealHoleCardsAction);
    }

    onBotIds(botIds);
  }

  return (
    <div className="panel" style={{ maxWidth: 400, margin: '0 auto', marginTop: 32 }}>
      <h2 style={{ marginBottom: 16, color: 'var(--color-gold)' }}>Practice Mode</h2>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Number of bots</label>
        <select value={numBots} onChange={e => setNumBots(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Bot difficulty</label>
        <select value={difficulty} onChange={e => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Starting stack</label>
        <input type="number" value={stack} min={10} onChange={e => setStack(Number(e.target.value))} />
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

      <button className="btn-call" style={{ width: '100%', padding: 12 }} onClick={handleStart}>
        Deal Cards
      </button>
    </div>
  );
}
