import { nanoid } from 'nanoid';
import { createDeck, shuffle } from '@poker/engine';
import type { Action, GameConfig, BlindAssignment, Card } from '@poker/engine';

export interface SeededHand {
  /** Ordered actions to seed the hand: hole cards, antes, then blinds. */
  readonly actions: Action[];
  /** The 5 community cards, revealed street-by-street by PracticeTable. */
  readonly boardCards: [Card, Card, Card, Card, Card];
}

/**
 * Deal a fresh practice hand from a single shuffle. Pure given the RNG:
 * produces the seed actions (hole cards + blinds) and the board cards.
 * Blinds are posted using the match layer's BlindAssignment, which already
 * encodes the heads-up exception — so this never re-derives blind positions.
 */
export function dealHand(handConfig: GameConfig, blinds: BlindAssignment, seed?: number): SeededHand {
  const deck = shuffle(createDeck(), seed);
  let cursor = 0;
  const now = Date.now();
  const actions: Action[] = [];

  // Hole cards, in seat order (handConfig.players is seat-ordered by the match layer)
  for (const p of handConfig.players) {
    const c1 = deck[cursor++]!;
    const c2 = deck[cursor++]!;
    actions.push({
      id: nanoid(), playerId: p.id, timestamp: now,
      type: 'DEAL_HOLE_CARDS', cards: [c1, c2],
    });
  }

  const boardCards: [Card, Card, Card, Card, Card] = [
    deck[cursor++]!, deck[cursor++]!, deck[cursor++]!, deck[cursor++]!, deck[cursor++]!,
  ];

  // Antes (if configured) before blinds
  if (handConfig.ante > 0) {
    for (const p of handConfig.players) {
      actions.push({
        id: nanoid(), playerId: p.id, timestamp: now,
        type: 'POST_ANTE', amount: handConfig.ante,
      });
    }
  }

  // Blinds — small then big, players chosen by the match layer
  actions.push({
    id: nanoid(), playerId: blinds.sbId, timestamp: now,
    type: 'POST_BLIND', amount: handConfig.smallBlind, blindType: 'small',
  });
  actions.push({
    id: nanoid(), playerId: blinds.bbId, timestamp: now,
    type: 'POST_BLIND', amount: handConfig.bigBlind, blindType: 'big',
  });

  return { actions, boardCards };
}
