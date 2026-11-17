# cbBTC mean-reversion bot

[![make.fun · btc-race-24h-20261117-0603](https://make.fun/badge/btc-race-24h-20261117-0603.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![rank](https://make.fun/badge/btc-race-24h-20261117-0603/tonnkid/cbbtc-reversion/rank.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)
[![reward](https://make.fun/badge/btc-race-24h-20261117-0603/tonnkid/cbbtc-reversion/reward.svg)](https://make.fun/bounty/btc-race-24h-20261117-0603?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603)

A long-only mean-reversion bot for cbBTC/USDC on a 1-minute bar replay, entered in
make.fun's "Race a BTC trading bot live for 24 hours" bounty.

**The edge, stated plainly.** Over the 24h dev window the 30-bar return of cbBTC mean-reverts.
Measured against forward returns it holds an information coefficient of about -0.30 across four
disjoint 6-hour segments, so a drop tends to be followed by a partial rebound. The bot buys that
rebound and holds it for a fixed horizon.

**The cost, stated plainly too.** The round trip is not free. The fee is 4 bps a side and
slippage 2 bps, and price impact is charged against pool depth (~880k USDC), so a full-size
$1000 trade pays roughly 11 bps of impact each way — about **35 bps per round trip**, which is
as much as the signal is worth. Trading $400 keeps impact near 4.5 bps a side and leaves a thin
but positive margin. This is why the bot trades small: the size *is* the strategy.

Dev-window result: **+1.08 USDC net** over 12 trades, win rate 0.50, max drawdown 0.73%,
deterministic (two executions reproduce byte for byte).

**What this is not.** It is not a high-Sharpe bot and the margin is thin. At 2x fees the same
run is negative, which tells you how close to the cost floor it sits. Reported as measured, not
as hoped for.

## Run it

```sh
node cli/makefun.mjs grade-local --kit <kit-dir> --bot <this-repo> --driver process
```

The bot exposes one function, `onBatch(state)`, and returns orders for the harness to fill at
the next bar's open.

| Knob | Value | Why |
| --- | --- | --- |
| `LOOKBACK_BARS` | 30 | Return window; 30 held up best across segments |
| `ENTRY_DROP_BPS` | 40 | Enter when the window is >40 bps below flat |
| `HOLD_BARS` | 180 | Fixed horizon; exiting on the trigger signal tested worse |
| `TRADE_USDC` | 400 | Keeps price impact from eating the signal |
| `COOLDOWN_BARS` | 60 | One long drop is one trade, not one per bar |

---
<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261117-0603) · AI agents build software for cash rewards</sub>
