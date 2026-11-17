// cbBTC mean-reversion bot for make.fun's "Race a BTC trading bot live for 24 hours".
//
// The idea: on the 24h dev window, the 30-minute return of cbBTC/USDC mean-reverts.
// I measured the information coefficient of (30-bar return) against the next bars across
// four disjoint 6-hour segments and it stayed negative in all four, so a drop is followed
// by a partial rebound more often than not. The bot buys that rebound and holds it for a
// fixed horizon, then sells. It is long-only: the competition allows no shorts.
//
// Position size is deliberately small. Price impact is charged against the pool depth
// (~880k USDC) so a full-size $1000 trade pays ~11 bps of impact each way on top of the
// 4 bps fee and 2 bps slippage; a round trip at full size costs ~35 bps, which is as much
// as the signal is worth. Trading $400 keeps the impact near 4.5 bps a side.
//
// Everything here is deterministic: no clock, no randomness, no environment.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, OrderInput } from './vendor/makefun-bars.ts';

/** Bars in the lookback whose return is the reversion signal. */
const LOOKBACK_BARS = 30;
/** Enter when the lookback return is more than this many bps below flat. */
const ENTRY_DROP_BPS = 40n;
/** Bars to hold after the fill before selling. */
const HOLD_BARS = 180;
/** Cash committed to one trade, in USDC raw units. */
const TRADE_USDC = 400n;
/** Never wait less than this between entries, so one drop is not re-bought every bar. */
const COOLDOWN_BARS = 60;

interface Plan {
  /** Bar index (state.seq) the position was entered on, or -1 when flat. */
  entrySeq: number;
  /** Bar index of the last entry, for the cooldown. */
  lastEntrySeq: number;
}

export function createStrategy() {
  const plan: Plan = { entrySeq: -1, lastEntrySeq: -9999 };
  // The SDK keeps only the latest bar per symbol, so the lookback ring buffer lives here.
  const closes: bigint[] = [];
  let lastSeqSeen = -1;

  /** The close this many bars back, or null until the window is full. */
  function closeAgo(n: number): bigint | null {
    const i = closes.length - 1 - n;
    return i < 0 ? null : closes[i]!;
  }

  function onBatch(state: BarsState): OrderInput[] {
    const symbol = 'CBBTC';

    // One bar per batch: push its close once. Warm-up bars build the window too.
    if (state.seq !== lastSeqSeen) {
      lastSeqSeen = state.seq;
      const c = state.close(symbol);
      if (c !== null) closes.push(c);
    }

    // Warm-up bars are not tradeable; sit them out but keep the history.
    if (state.warmingUp) return [];

    const close = state.close(symbol);
    if (close === null) return [];

    const held = state.positions.get(symbol);
    const heldQty = held === undefined ? 0n : held.qty;

    // Exit: hold the position for a fixed horizon, then flatten.
    if (heldQty > 0n) {
      if (plan.entrySeq >= 0 && state.seq - plan.entrySeq >= HOLD_BARS) {
        plan.entrySeq = -1;
        return [{ side: 'sell', symbol, qty: heldQty, max_slippage_bps: 100 }];
      }
      return [];
    }

    // Flat from here on. Respect the cooldown so one long drop is one trade.
    if (state.seq - plan.lastEntrySeq < COOLDOWN_BARS) return [];

    // Entry: the lookback return, in bps below flat.
    const pastClose = closeAgo(LOOKBACK_BARS);
    if (pastClose === null) return [];
    if (pastClose === 0n) return [];

    const changeBps = ((close - pastClose) * 10_000n) / pastClose;
    if (changeBps > -ENTRY_DROP_BPS) return [];

    // Size: TRADE_USDC of cash, but never more than the cash on hand and never past the
    // weight cap the harness advertises.
    let notional = TRADE_USDC * 1_000_000n;
    if (notional > state.cash) notional = state.cash;
    const room = state.weightRoom(symbol);
    if (notional > room) notional = room;
    if (notional <= 0n) return [];

    plan.entrySeq = state.seq;
    plan.lastEntrySeq = state.seq;
    return [{ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: 100 }];
  }

  return { onBatch };
}

await runBars(createStrategy());
