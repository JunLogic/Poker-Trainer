import type { GameState } from '@poker/engine';
import { whoseTurn } from '@poker/engine';
import { PlayingCard } from '../cards/PlayingCard.js';
import { SeatCard } from './SeatCard.js';
import { ChipDisplay } from '../common/ChipDisplay.js';

interface Props {
  state: GameState;
  heroId: string;
  equities: readonly number[];
  isComputingEquity: boolean;
  /** When false, the hero equity strip is hidden (computation still runs). */
  showOdds?: boolean;
}

// ── Seat positions for desktop oval layout ────────────────────────────────────
// left/top expressed as CSS values relative to the table container.
// Each position uses transform: translate(-50%, -50%) to center the seat card.
const BOT_POSITIONS: Array<Array<{ left: string; top: string }>> = [
  [],
  [{ left: '50%', top: '6%' }],
  [{ left: '24%', top: '8%' }, { left: '76%', top: '8%' }],
  [{ left: '9%',  top: '38%' }, { left: '50%', top: '5%' }, { left: '91%', top: '38%' }],
  [{ left: '9%',  top: '38%' }, { left: '32%', top: '6%' }, { left: '68%', top: '6%' }, { left: '91%', top: '38%' }],
  [{ left: '7%',  top: '38%' }, { left: '27%', top: '6%' }, { left: '50%', top: '4%' }, { left: '73%', top: '6%' }, { left: '93%', top: '38%' }],
];

/** Returns the visible street name derived from board cards (more accurate for all-in runouts) */
function boardStreetLabel(state: GameState): string {
  if (state.board.river) return 'River';
  if (state.board.turn) return 'Turn';
  if (state.board.flop) return 'Flop';
  return 'Preflop';
}

export function PokerTableLayout({ state, heroId, equities, isComputingEquity, showOdds = true }: Props) {
  const currentId = whoseTurn(state);
  const heroPlayer = state.players.find(p => p.id === heroId);
  const botPlayers = state.players.filter(p => p.id !== heroId);

  const heroIdx = state.players.findIndex(p => p.id === heroId);
  const heroEquity = equities[heroIdx] ?? 0;

  const boardCards = [
    ...(state.board.flop ?? []),
    ...(state.board.turn ? [state.board.turn] : []),
    ...(state.board.river ? [state.board.river] : []),
  ];

  const totalPot = state.sidePots.reduce((s, p) => s + p.amount, 0);
  const streetLabel = boardStreetLabel(state);
  const showBotCards = state.street === 'showdown' || state.isHandOver;

  const botPositions = BOT_POSITIONS[Math.min(botPlayers.length, 5)] ?? [];

  if (!heroPlayer) return null;

  return (
    <>
      {/* ── Mobile layout ─────────────────────────────────────────────────── */}
      <div className="table-mobile">
        {/* Bot row */}
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 8, padding: '10px 12px' }}>
          {botPlayers.map(p => (
            <SeatCard
              key={p.id}
              player={p}
              isActive={p.id === currentId}
              isDealer={p.seatIndex === state.config.dealerSeatIndex}
              showCards={showBotCards}
            />
          ))}
        </div>

        {/* Community cards + pot */}
        <div style={{
          background: 'linear-gradient(180deg, rgba(26,71,42,0.6) 0%, rgba(15,45,26,0.6) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 16px', textAlign: 'center',
        }}>
          <BoardCenter boardCards={boardCards} totalPot={totalPot} streetLabel={streetLabel} state={state} />
        </div>

        {/* Equity strip */}
        {showOdds && <EquityStrip heroEquity={heroEquity} isComputing={isComputingEquity} />}

        {/* Hero cards */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '10px 16px' }}>
          {heroPlayer.holeCards
            ? heroPlayer.holeCards.map((c, i) => <PlayingCard key={i} card={c} size="lg" />)
            : [0, 1].map(i => <PlayingCard key={i} card={{ rank: '2', suit: 'c' }} faceDown size="lg" />)
          }
        </div>
      </div>

      {/* ── Desktop layout ────────────────────────────────────────────────── */}
      <div className="table-desktop">
        {/* Outer container for the oval + surrounding seats */}
        <div style={{ position: 'relative', height: 390, maxWidth: 700, margin: '0 auto' }}>

          {/* Oval felt table */}
          <div style={{
            position: 'absolute',
            top: 68, left: '8%', right: '8%', bottom: 60,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 40%, #2d6a42 0%, #1a472a 75%, #163d22 100%)',
            border: '8px solid #6b4c14',
            boxShadow: 'inset 0 4px 24px rgba(0,0,0,0.4), inset 0 -4px 12px rgba(0,0,0,0.25), 0 10px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}>
            {/* Subtle rail highlight */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'radial-gradient(ellipse at 50% 15%, rgba(255,255,255,0.06) 0%, transparent 55%)',
              pointerEvents: 'none',
            }} />

            {/* Centered content: community cards + pot + street */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8,
            }}>
              <BoardCenter boardCards={boardCards} totalPot={totalPot} streetLabel={streetLabel} state={state} />
            </div>
          </div>

          {/* Bot seats: positioned around the top arc */}
          {botPlayers.map((player, i) => {
            const pos = botPositions[i];
            if (!pos) return null;
            return (
              <div key={player.id} style={{
                position: 'absolute',
                left: pos.left, top: pos.top,
                transform: 'translate(-50%, -50%)',
                zIndex: 1,
              }}>
                <SeatCard
                  player={player}
                  isActive={player.id === currentId}
                  isDealer={player.seatIndex === state.config.dealerSeatIndex}
                  showCards={showBotCards}
                />
              </div>
            );
          })}

          {/* Hero seat: bottom centre */}
          <div style={{
            position: 'absolute', bottom: 0, left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
          }}>
            <SeatCard
              player={heroPlayer}
              isActive={heroPlayer.id === currentId}
              isDealer={heroPlayer.seatIndex === state.config.dealerSeatIndex}
              showCards
              isHero
            />
          </div>
        </div>

        {/* Equity strip below the table */}
        {showOdds && <EquityStrip heroEquity={heroEquity} isComputing={isComputingEquity} />}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BoardCenter({
  boardCards, totalPot, streetLabel, state,
}: {
  boardCards: ReturnType<typeof Array.prototype.filter>;
  totalPot: number;
  streetLabel: string;
  state: GameState;
}) {
  return (
    <>
      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
        {streetLabel}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', minHeight: 52 }}>
        {boardCards.length === 0 && (
          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)' }}>waiting for flop…</span>
        )}
        {(boardCards as import('@poker/engine').Card[]).map((card, i) => (
          <PlayingCard key={i} card={card} size="sm" />
        ))}
      </div>
      {totalPot > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 }}>Pot</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-gold)', fontSize: '0.95rem' }}>
            <ChipDisplay amount={totalPot} />
          </span>
          {state.sidePots.length > 1 && (
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)' }}>
              ({state.sidePots.length} pots)
            </span>
          )}
        </div>
      )}
    </>
  );
}

function EquityStrip({ heroEquity, isComputing }: { heroEquity: number; isComputing: boolean }) {
  if (heroEquity === 0 && !isComputing) return null;
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>Your equity</span>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${heroEquity * 100}%`,
          background: heroEquity > 0.5 ? 'var(--color-call)' : heroEquity > 0.3 ? '#e0a020' : 'var(--color-fold)',
          transition: 'width 0.5s ease, background 0.5s ease',
          borderRadius: 3,
        }} />
      </div>
      <span style={{
        fontSize: '0.78rem', fontFamily: 'var(--font-mono)', fontWeight: 700, minWidth: 38, textAlign: 'right',
        color: isComputing ? 'var(--color-text-dim)' : 'var(--color-gold)',
      }}>
        {isComputing ? '…' : `${(heroEquity * 100).toFixed(0)}%`}
      </span>
    </div>
  );
}
