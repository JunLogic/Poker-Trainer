import { useState } from 'react';
import { nanoid } from 'nanoid';
import { evaluateHand, compareHandRanks, buildSidePots } from '@poker/engine';
import type { GameState, Card, Player } from '@poker/engine';
import { CardPicker } from '../common/CardPicker.js';
import { ChipDisplay } from '../common/ChipDisplay.js';
import { useGameStore } from '../../store/gameStore.js';

interface Props {
  state: GameState;
}

type CardEntry = readonly [Card, Card] | null;

export function ShowdownPanel({ state }: Props) {
  const appendAction = useGameStore(s => s.appendAction);
  const eligible = state.players.filter(p => p.status !== 'folded');
  const [cards, setCards] = useState<Record<string, CardEntry>>(
    Object.fromEntries(eligible.map(p => [p.id, p.holeCards])),
  );
  const [selectingFor, setSelectingFor] = useState<{ playerId: string; slot: 0 | 1 } | null>(null);

  const allKnownCards: Card[] = [
    ...Object.values(cards).flatMap(pair => pair ?? []),
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  function handleCardSelect(card: Card) {
    if (!selectingFor) return;
    const { playerId, slot } = selectingFor;
    const existing = cards[playerId];
    const other = existing?.[slot === 0 ? 1 : 0] ?? null;
    const newPair: readonly [Card, Card] | null =
      slot === 0
        ? other ? [card, other] : null
        : existing?.[0] ? [existing[0], card] : null;
    setCards(prev => {
      const val: CardEntry = newPair ?? (slot === 0 ? null : existing ?? null);
      return { ...prev, [playerId]: val };
    });

    // If both cards selected, clear selection
    if ((slot === 0 && other) || (slot === 1 && existing?.[0])) {
      setSelectingFor(null);
    } else {
      // Move to next slot
      setSelectingFor({ playerId, slot: slot === 0 ? 1 : 0 });
    }
  }

  function awardPots() {
    const pots = buildSidePots(state.players);

    // First reveal all cards
    for (const player of eligible) {
      const pair = cards[player.id];
      if (pair && !player.holeCards) {
        appendAction({
          id: nanoid(), playerId: player.id, timestamp: Date.now(),
          type: 'REVEAL_CARDS', cards: pair,
        });
      }
    }

    const boardCards = [
      ...(state.board.flop ?? []),
      ...(state.board.turn ? [state.board.turn] : []),
      ...(state.board.river ? [state.board.river] : []),
    ];

    // Award each pot
    for (let i = 0; i < pots.length; i++) {
      const pot = pots[i]!;
      const potEligible = pot.eligiblePlayerIds
        .map(id => eligible.find(p => p.id === id))
        .filter((p): p is Player => p !== undefined);

      if (potEligible.length === 1) {
        // Uncontested
        appendAction({
          id: nanoid(), playerId: potEligible[0]!.id, timestamp: Date.now(),
          type: 'AWARD_POT', potIndex: i,
          winnerIds: [potEligible[0]!.id],
          amount: pot.amount,
          oddChipWinnerId: null,
        });
        continue;
      }

      // Evaluate hands
      const evaluated = potEligible
        .map(p => {
          const pair = cards[p.id] ?? p.holeCards;
          if (!pair || boardCards.length < 3) return null;
          try {
            const rank = evaluateHand([...pair, ...boardCards]);
            return { player: p, rank };
          } catch {
            return null;
          }
        })
        .filter((x): x is { player: Player; rank: ReturnType<typeof evaluateHand> } => x !== null);

      if (evaluated.length === 0) continue;

      const best = evaluated.reduce((b, x) =>
        compareHandRanks(x.rank, b.rank) > 0 ? x : b,
      );
      const winners = evaluated.filter(x => compareHandRanks(x.rank, best.rank) === 0);

      appendAction({
        id: nanoid(), playerId: winners[0]!.player.id, timestamp: Date.now(),
        type: 'AWARD_POT', potIndex: i,
        winnerIds: winners.map(w => w.player.id),
        amount: pot.amount,
        oddChipWinnerId: null,
      });
    }
  }

  const cardSymbol = (suit: string) => ({ h: '♥', d: '♦', c: '♣', s: '♠' })[suit] ?? '';
  const suitColor = (suit: string) =>
    ({ h: 'var(--suit-hearts)', d: 'var(--suit-diamonds)', c: 'var(--suit-clubs)', s: 'var(--suit-spades)' })[suit] ?? '';

  return (
    <div className="panel">
      <h3 style={{ marginBottom: 12, color: 'var(--color-gold)' }}>Showdown</h3>
      <p style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--color-text-dim)' }}>
        Enter each player's hole cards, then click Award Pots.
      </p>

      {eligible.map(player => {
        const pair = cards[player.id];
        return (
          <div key={player.id} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{player.name}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {([0, 1] as const).map(slot => {
                const card = pair?.[slot];
                const isSelecting = selectingFor?.playerId === player.id && selectingFor?.slot === slot;
                return (
                  <button
                    key={slot}
                    onClick={() => setSelectingFor({ playerId: player.id, slot })}
                    style={{
                      width: 44, height: 60,
                      background: card ? 'var(--color-card-bg)' : 'rgba(255,255,255,0.05)',
                      border: isSelecting ? '2px solid var(--color-gold)' : '1px dashed rgba(255,255,255,0.3)',
                      borderRadius: 6,
                      color: card ? suitColor(card.suit) : 'rgba(255,255,255,0.3)',
                      fontWeight: 700, fontSize: '1rem',
                    }}
                  >
                    {card ? `${card.rank}${cardSymbol(card.suit)}` : '?'}
                  </button>
                );
              })}
              {pair && (
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-dim)' }}>
                  {(() => {
                    const boardCards = [
                      ...(state.board.flop ?? []),
                      ...(state.board.turn ? [state.board.turn] : []),
                      ...(state.board.river ? [state.board.river] : []),
                    ];
                    if (boardCards.length < 3) return '';
                    try {
                      const r = evaluateHand([...pair, ...boardCards]);
                      return r.category.replace(/-/g, ' ');
                    } catch { return ''; }
                  })()}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {selectingFor && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8, fontSize: '0.85rem' }}>
            Select card for {eligible.find(p => p.id === selectingFor.playerId)?.name}
            {' '}(slot {selectingFor.slot + 1}):
          </div>
          <CardPicker usedCards={allKnownCards} onSelect={handleCardSelect} />
        </div>
      )}

      <button
        className="btn-call"
        style={{ marginTop: 16, width: '100%' }}
        onClick={awardPots}
      >
        Award Pots
      </button>
    </div>
  );
}
