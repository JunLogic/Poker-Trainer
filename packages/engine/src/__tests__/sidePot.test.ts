import { describe, it, expect } from 'vitest';
import { buildSidePots, computeAward } from '../sidePot.js';
import type { Player } from '../types.js';

function makePlayer(
  id: string,
  betCommitted: number,
  status: Player['status'],
  seatIndex = 0,
): Player {
  return {
    id,
    name: id,
    stack: 0,
    betCommitted,
    betThisStreet: 0,
    status,
    holeCards: null,
    seatIndex,
  };
}

describe('buildSidePots', () => {
  it('Scenario A — single all-in creates one main pot', () => {
    const players = [
      makePlayer('p1', 50, 'allin'),
      makePlayer('p2', 50, 'active'),
      makePlayer('p3', 50, 'allin'),
    ];
    const pots = buildSidePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0]?.amount).toBe(150);
    expect(pots[0]?.eligiblePlayerIds).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    expect(pots[0]?.eligiblePlayerIds).toHaveLength(3);
  });

  it('Scenario B — two all-ins at different levels create two pots', () => {
    const players = [
      makePlayer('p1', 100, 'allin'),
      makePlayer('p2', 200, 'allin'),
      makePlayer('p3', 200, 'active'),
    ];
    const pots = buildSidePots(players);
    expect(pots).toHaveLength(2);
    expect(pots[0]?.amount).toBe(300);
    expect(pots[0]?.eligiblePlayerIds).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
    expect(pots[1]?.amount).toBe(200);
    expect(pots[1]?.eligiblePlayerIds).toEqual(expect.arrayContaining(['p2', 'p3']));
    expect(pots[1]?.eligiblePlayerIds).not.toContain('p1');
  });

  it('Scenario C — three-way all-in cascade creates three side pots', () => {
    const players = [
      makePlayer('p1', 50,  'allin'),
      makePlayer('p2', 150, 'allin'),
      makePlayer('p3', 300, 'allin'),
      makePlayer('p4', 300, 'active'),
    ];
    const pots = buildSidePots(players);
    expect(pots).toHaveLength(3);
    // Level 0→50: 50*4=200, all eligible
    expect(pots[0]?.amount).toBe(200);
    expect(pots[0]?.eligiblePlayerIds).toHaveLength(4);
    // Level 50→150: 100*3=300, p2/p3/p4 eligible
    expect(pots[1]?.amount).toBe(300);
    expect(pots[1]?.eligiblePlayerIds).toHaveLength(3);
    expect(pots[1]?.eligiblePlayerIds).not.toContain('p1');
    // Level 150→300: 150*2=300, p3/p4 eligible
    expect(pots[2]?.amount).toBe(300);
    expect(pots[2]?.eligiblePlayerIds).toHaveLength(2);
    expect(pots[2]?.eligiblePlayerIds).toEqual(expect.arrayContaining(['p3', 'p4']));
  });

  it('handles a folded player — excluded from all pots eligibility', () => {
    const players = [
      makePlayer('p1', 200, 'folded'),
      makePlayer('p2', 200, 'active'),
      makePlayer('p3', 200, 'active'),
    ];
    const pots = buildSidePots(players);
    expect(pots).toHaveLength(1);
    expect(pots[0]?.amount).toBe(600);
    // p1 folded: still contributed chips, but is NOT eligible to win
    expect(pots[0]?.eligiblePlayerIds).not.toContain('p1');
    expect(pots[0]?.eligiblePlayerIds).toHaveLength(2);
  });

  it('handles a folded player who covered the all-in level', () => {
    // p1 all-in 100, p2 folded (put in 200), p3 active 200
    // pot0: 100*3=300 eligible=[p1,p3] (p2 folded, not eligible)
    // pot1: 100*2=200 eligible=[p3] (p1 all-in, p2 folded)
    const players = [
      makePlayer('p1', 100, 'allin'),
      makePlayer('p2', 200, 'folded'),
      makePlayer('p3', 200, 'active'),
    ];
    const pots = buildSidePots(players);
    expect(pots).toHaveLength(2);
    expect(pots[0]?.amount).toBe(300);
    expect(pots[0]?.eligiblePlayerIds).toEqual(expect.arrayContaining(['p1', 'p3']));
    expect(pots[0]?.eligiblePlayerIds).not.toContain('p2');
    expect(pots[1]?.amount).toBe(200);
    expect(pots[1]?.eligiblePlayerIds).toEqual(['p3']);
  });

  it('total chips are conserved across all pots', () => {
    const players = [
      makePlayer('p1', 75,  'allin'),
      makePlayer('p2', 200, 'allin'),
      makePlayer('p3', 200, 'active'),
      makePlayer('p4', 150, 'folded'),
    ];
    const totalIn = players.reduce((s, p) => s + p.betCommitted, 0);
    const pots = buildSidePots(players);
    const totalOut = pots.reduce((s, p) => s + p.amount, 0);
    expect(totalOut).toBe(totalIn);
  });
});

describe('computeAward', () => {
  it('Scenario D — odd chip goes to first eligible player clockwise from dealer', () => {
    // 3-way split of 101 chips; seats 0, 1, 2; dealer at seat 3 (not present)
    // First clockwise after dealer (seat 3) → seat 0 → p1
    const players = [
      makePlayer('p1', 34, 'active', 0),
      makePlayer('p2', 34, 'active', 1),
      makePlayer('p3', 33, 'allin',  2),
    ];
    // build pots to get both pots
    const pots = buildSidePots(players);
    const totalChips = 101;
    // main pot: 33*3=99; side pot: 1*2=2
    expect(pots[0]?.amount).toBe(99);
    expect(pots[1]?.amount).toBe(2);

    // award main pot: 99 / 3 winners = 33 each, no odd chip
    const award1 = computeAward({
      amount: pots[0]!.amount,
      winnerIds: ['p1', 'p2', 'p3'],
      eligiblePlayerIds: pots[0]!.eligiblePlayerIds,
      dealerSeatIndex: 3,
      players,
    });
    expect(award1.perWinner).toBe(33);
    expect(award1.oddChipWinnerId).toBeNull();

    // award side pot: 2 / 2 winners = 1 each, no odd chip
    const award2 = computeAward({
      amount: pots[1]!.amount,
      winnerIds: ['p1', 'p2'],
      eligiblePlayerIds: pots[1]!.eligiblePlayerIds,
      dealerSeatIndex: 3,
      players,
    });
    expect(award2.perWinner).toBe(1);
    expect(award2.oddChipWinnerId).toBeNull();
  });

  it('odd chip goes to correct seat when pot is not evenly divisible', () => {
    // 3-way split of 100 chips → 33 each + 1 odd chip
    // dealer at seat 5; seats in winning group: 1, 3, 4
    // first clockwise after seat 5 among {1,3,4} → seat 1 (going 6→0→1)
    const players = [
      makePlayer('p1', 100, 'active', 1),
      makePlayer('p2', 100, 'active', 3),
      makePlayer('p3', 100, 'active', 4),
    ];
    const award = computeAward({
      amount: 100,
      winnerIds: ['p1', 'p2', 'p3'],
      eligiblePlayerIds: ['p1', 'p2', 'p3'],
      dealerSeatIndex: 5,
      players,
    });
    expect(award.perWinner).toBe(33);
    expect(award.oddChipWinnerId).toBe('p1'); // seat 1 is first after dealer seat 5
  });

  it('split with no odd chip sets oddChipWinnerId to null', () => {
    const players = [
      makePlayer('p1', 50, 'active', 0),
      makePlayer('p2', 50, 'active', 1),
    ];
    const award = computeAward({
      amount: 100,
      winnerIds: ['p1', 'p2'],
      eligiblePlayerIds: ['p1', 'p2'],
      dealerSeatIndex: 0,
      players,
    });
    expect(award.perWinner).toBe(50);
    expect(award.oddChipWinnerId).toBeNull();
  });
});
