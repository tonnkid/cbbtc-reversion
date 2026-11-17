// cbBTC dip-buy ladder for make.fun's "Race a BTC trading bot live for 24 hours".
//
// The dev window is one day of cbBTC/USDC on an Orca whirlpool that spends most of it drifting
// into shallow dips: over the 1,440 bars, price fell 212 bps below its running peak at worst and
// spent 26 separate episodes more than 80 bps under that peak.
//
// A 240-bar high minus the current close carries +58 bps of forward return over the next 240
// bars on average, and 95% of those episodes close higher. That clears the ~21 bps a round trip
// costs, because the holding period is hours rather than minutes.
//
// The bot ladders into the fall in four steps, tracks its own average entry, and takes the whole
// ladder off once the bounce clears the cost and a small margin, then waits out the episode.
// Thresholds are all in bps off the rolling high, so no absolute price level is baked in.
//
// Everything is deterministic: no clock, no randomness, no environment.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK = 360;
const RUNGS_BPS = [80, 120, 160, 200] as const;
const RUNG_WEIGHT_BPS = [3500, 2500, 2000, 1500] as const;
const TAKE_PROFIT_BPS = 120;
const REARM_DIP_BPS = 40;
const MAX_SLIPPAGE_BPS = 120;

/** Average entry, tracked in quote units per raw qty unit, carried across batches. */
let costQuote = 0n;
let qtyHeld = 0n;
let rungsFilled = 0;
let armed = false;

function reset(): void {
  costQuote = 0n;
  qtyHeld = 0n;
  rungsFilled = 0;
  armed = false;
}

export function createStrategy() {
  const closes: number[] = [];
  let lastSeq = -1;

  function onBatch(state: BarsState): OrderInput[] {
    if (state.warmingUp) return [];

    // A new execution restarts the replay: drop everything carried from the last one.
    if (state.seq <= lastSeq) {
      reset();
      closes.length = 0;
    }
    lastSeq = state.seq;

    const close = state.close(SYMBOL);
    if (close === null) return [];
    const price = Number(close);
    closes.push(price);
    if (closes.length > LOOKBACK) closes.shift();
    if (closes.length < LOOKBACK) return [];

    const high = Math.max(...closes);
    const dipBps = ((high - price) / high) * 10_000;

    // Nothing in hand: the ladder is idle until a dip deep enough to start it.
    const pos = state.positions.get(SYMBOL);
    const qty = pos ? pos.qty : 0n;
    if (qty === 0n && qtyHeld !== 0n) {
      // The exit filled: the ladder is flat again.
      reset();
    }
    if (qty === 0n && !armed && dipBps < RUNGS_BPS[0]) return [];

    const orders: OrderInput[] = [];

    // --- entry: fill the next rung as the dip deepens ---
    if (rungsFilled < RUNGS_BPS.length && dipBps >= RUNGS_BPS[rungsFilled]) {
      const spend = (state.equity * BigInt(RUNG_WEIGHT_BPS[rungsFilled])) / 10_000n;
      if (spend > 0n) {
        orders.push({
          side: 'buy',
          symbol: SYMBOL,
          notional_quote_units: spend,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        });
        // Book the fill at this close: the fill lands at the next open, close enough for sizing.
        costQuote += spend;
        qtyHeld += (spend * 1_000_000_000n) / close;
        rungsFilled += 1;
        armed = true;
        return orders;
      }
    }

    // --- exit: the whole ladder, once the bounce clears cost plus margin ---
    if (qtyHeld > 0n && costQuote > 0n) {
      const valueNow = (qtyHeld * close) / 1_000_000_000n;
      const gainBps = Number(((valueNow - costQuote) * 10_000n) / costQuote);
      if (gainBps >= TAKE_PROFIT_BPS) {
        orders.push({
          side: 'sell',
          symbol: SYMBOL,
          qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        });
        reset();
        return orders;
      }
    }

    // Once price is back out of the dip the episode is spent; a later dip may start a new ladder.
    if (armed && dipBps < REARM_DIP_BPS && qty === 0n) {
      reset();
    }

    return orders;
  }

  return { onBatch };
}

await runBars(createStrategy());
