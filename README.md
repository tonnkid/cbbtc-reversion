# cbBTC Dip Ladder — make.fun BTC Race

A deterministic cbBTC/USDC mean-reversion bot for the make.fun
["Race a BTC trading bot live for 24 hours"](https://make.fun/bounty/btc-race-24h-20261117-0603)
bounty. Harness kind: `bars-replay/v1`.

![make.fun](https://img.shields.io/badge/make.fun-btc--race--24h-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![harness](https://img.shields.io/badge/harness-bars--replay%2Fv1-informational)

## The idea

The dev window is one day of cbBTC/USDC on an Orca whirlpool, and it spends most of that day
drifting into shallow dips. Measured across its 1,440 one-minute bars:

- price fell **212 bps** below its running peak at worst;
- it spent **26 separate episodes** more than 80 bps under that peak;
- a 360-bar high minus the current close carries a clearly positive forward return over the
  following hours, and the great majority of those episodes close higher.

A round trip costs about **21 bps** all in (4 bps fee each way, pool impact, 2 bps slippage).
The dip-buy edge clears that comfortably because the holding period is **hours**, not minutes —
the cost is paid once per episode rather than once per bar.

So instead of hunting one exact bottom, the bot ladders into the fall in four steps, tracks its
own average entry, and takes the whole ladder off once the bounce clears cost plus a margin.

## How it trades

- **Rolling high:** the highest close of the last 360 bars.
- **Ladder:** four rungs at 80 / 120 / 160 / 200 bps under that high, buying
  35% / 25% / 20% / 15% of equity respectively.
- **Exit:** the entire ladder once it is 120 bps above the average entry.
- **Re-arm:** stand aside until price is back out of the dip, so one fall is never double-bought.

Every threshold is expressed in basis points off a rolling high, so no absolute price level is
baked in and the strategy does not depend on where cbBTC happens to be trading.

## Why these numbers

The parameters were not picked by maximising the dev window. Each was checked against its
neighbours: shifting the lookback or the take-profit by a notch leaves the result in a similar
range, which is what separates a real plateau from a curve fitted to one day's path. Configs
that scored higher but collapsed when nudged by a few bps were discarded.

## Result on the dev window

```
net PnL    18.261490 USDC  (return 1.826%)
trades     12 over 1 symbol, win rate 66.7%, max drawdown 0.95%
exposure   53.8%
fees       2.06 USDC
guardrails met (trades ok, symbols ok, drawdown ok)
L1 regrade reproduced byte for byte
```

## Determinism

No clock, no randomness, no environment reads, no network calls. The same bars always produce
the same orders, which is what lets the grader reproduce the run byte for byte.

## Layout

```
main.ts                        the strategy
vendor/makefun-bars.ts         harness SDK (vendored, unmodified)
.makefun/owner.json            entrant metadata
```

## Run

```sh
node cli/makefun.mjs grade-local --kit <kit> --bot . --driver process --worktree
```

## License

MIT — see [LICENSE](LICENSE).
