import { useState } from 'react';
import { nanoid } from 'nanoid';
import { createDeck, shuffle } from '@poker/engine';
import type { DealHoleCardsAction, PostBlindAction } from '@poker/engine';
import { useGameStore } from '../../store/gameStore.js';
import { useSettingsStore } from '../../store/settingsStore.js';
import { usePracticeStore } from '../../store/practiceStore.js';
import { useThoughtsStore } from '../../store/thoughtsStore.js';

interface Props {
  onBotIds: (ids: string[], difficulty: 'easy' | 'medium' | 'hard') => void;
}

export function PracticeSetup({ onBotIds }: Props) {
  const { smallBlind, bigBlind, setBlinds, dealerSeatIndex } = useSettingsStore();
  const { startHand, appendAction } = useGameStore();
  const { setBoardCards, clearBoard } = usePracticeStore();
  const clearThoughts = useThoughtsStore(s => s.clearThoughts);

  const [numBots, setNumBots] = useState(1);
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
      mode: 'practice' as const,
      smallBlind, bigBlind, ante: 0,
      dealerSeatIndex,
      players,
      startingStacks: Object.fromEntries(allIds.map(id => [id, stack])),
    };

    // Pre-deal all cards from a single shuffle
    const deck = shuffle(createDeck());
    let cursor = 0;

    // Clear per-hand state from previous hand
    clearBoard();
    clearThoughts();
    startHand(config);

    // Deal hole cards
    for (const player of players) {
      const c1 = deck[cursor++]!;
      const c2 = deck[cursor++]!;
      appendAction({
        id: nanoid(), playerId: player.id, timestamp: Date.now(),
        type: 'DEAL_HOLE_CARDS', cards: [c1, c2],
      } as DealHoleCardsAction);
    }

    // Store board cards for street-by-street dealing in PracticeTable
    setBoardCards([deck[cursor]!, deck[cursor + 1]!, deck[cursor + 2]!, deck[cursor + 3]!, deck[cursor + 4]!]);

    // Post blinds in seat order (first two seats after dealer)
    const seatNums = players.map(p => p.seatIndex).sort((a, b) => a - b);
    const dealerPos = seatNums.indexOf(dealerSeatIndex);
    const sbSeat = seatNums[(dealerPos + 1) % seatNums.length]!;
    const bbSeat = seatNums[(dealerPos + 2) % seatNums.length]!;
    const sbPlayer = players.find(p => p.seatIndex === sbSeat)!;
    const bbPlayer = players.find(p => p.seatIndex === bbSeat)!;

    appendAction({
      id: nanoid(), playerId: sbPlayer.id, timestamp: Date.now(),
      type: 'POST_BLIND', amount: smallBlind, blindType: 'small',
    } as PostBlindAction);
    appendAction({
      id: nanoid(), playerId: bbPlayer.id, timestamp: Date.now(),
      type: 'POST_BLIND', amount: bigBlind, blindType: 'big',
    } as PostBlindAction);

    onBotIds(botIds, difficulty);
  }

  return (
    <div className="panel" style={{ maxWidth: 380, margin: '32px auto' }}>
      <h2 style={{ marginBottom: 16, color: 'var(--color-gold)' }}>Practice Mode</h2>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Opponents</label>
        <select value={numBots} onChange={e => setNumBots(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} bot{n > 1 ? 's' : ''}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Difficulty</label>
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
          <input type="number" value={smallBlind} min={1}
            onChange={e => setBlinds(Number(e.target.value), bigBlind)}
            style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Big blind</label>
          <input type="number" value={bigBlind} min={1}
            onChange={e => setBlinds(smallBlind, Number(e.target.value))}
            style={{ width: '100%' }} />
        </div>
      </div>

      <button className="btn-call" style={{ width: '100%', padding: 12 }} onClick={handleStart}>
        Deal Cards
      </button>
    </div>
  );
}
