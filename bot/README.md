# Play Scanner Bot

An **alerts-only** intraday setup scanner with a **backtester**. During 4am–8pm
ET it scans the US market, flags rule-based setups, and texts you the **entry,
stop-loss, and target** via Twilio. The backtester scores those same rules
against history so you can see whether they have any edge **before risking a
cent**.

> ## Read this first — it matters more than the code
> - **It never places trades.** It only texts you setups to consider yourself.
> - **It is NOT a money machine and has no proven edge.** The rules (VWAP reclaim,
>   EMA cross + volume, candlestick reversal, relative-volume/gap as a catalyst
>   proxy) are a transparent *starting point*. Across thousands of names they
>   produce a lot of noise; most alerts will not be good trades.
> - **Validate before you risk money.** Backtest it, then paper-trade it for weeks.
>   Only consider real money — small — if the numbers actually hold up.
> - **Not financial advice.** Every trade is your decision and your risk.

## The intended workflow (and it's free to start)

1. **Backtest** the rules on history (`npm run backtest`) — does expectancy look positive?
2. **Dry-run** the live scanner (`npm start`, `MODE=dry-run`) — alerts print to the console.
3. **Paper-trade** with real money simulated, for weeks.
4. **Only then**, if it's holding up, upgrade data, set `MODE=live`, and start tiny.

All of steps 1–3 run on **Alpaca's free tier — $0.**

## Setup

```bash
cd bot
npm install
cp .env.example .env      # then fill it in
```

**Data provider — Alpaca (recommended):** create a free account at
https://alpaca.markets, generate API keys, put them in `.env`. The free tier
gives real-time **IEX** data (a subset of volume) — enough to build, backtest,
and paper-test. When you're ready for live, Alpaca's **Algo Trader Plus
($99/mo)** unlocks full real-time data; set `ALPACA_FEED=sip`. (Polygon is also
supported via `DATA_PROVIDER=polygon`, but its real-time full-market tier is
~$199/mo.)

**Twilio** (only needed for live texts): https://twilio.com — buy a number, copy
the SID/token into `.env`.

## Commands

```bash
npm run backtest                  # score the rules over recent history (default symbols)
npm run backtest AAPL TSLA NVDA   # ...or your own symbols
npm start                         # live scanner, dry-run (console alerts, no texts)
npm run live                      # unattended run: keeps Mac awake, logs to file, auto-restarts
npm run scan:once                 # single scan pass and exit
npm test                          # verify indicator/signal/backtest math (no API needed)
```

### Leaving it running unattended (e.g. start Sunday night for Monday)

```bash
cd ~/webdeveloper/bot
npm run live          # or: ./run.sh
```

`run.sh` wraps the scanner in `caffeinate` (so the Mac won't sleep and the 4am
scan actually fires), writes a timestamped log to `bot/logs/`, and relaunches if
it crashes. **Keep the laptop lid OPEN and the charger plugged in** — a MacBook
sleeps on lid-close regardless of caffeinate. Stop with Ctrl+C. Review the run
afterward in `bot/logs/scanner-*.log`.

Two honest caveats for a 4am start on the **free IEX feed**:
- **Premarket (4:00–9:30) will be thin or empty.** IEX is a small exchange and
  the free screener barely populates before the open; expect real activity only
  after 9:30. True premarket coverage needs the paid `sip` feed ($99/mo) — don't
  buy it until the strategy has proven itself in observation.
- Keep `MODE=dry-run` for the first live days. It logs every setup so you can
  compare it against what actually happened. **Don't trade these with real
  money until weeks of observation/paper say it's worth it.**

Reading the backtest report: **expectancyR** is average R per trade (positive =
edge, before costs), **PF** is profit factor (gross win ÷ gross loss; >1.5 is
decent), **winRate** matters less than expectancy. A small sample proves
nothing — run many days and watch for overfitting.

Going live later: set `MODE=live` in `.env`, keep the Mac awake during the
session (`caffeinate -s`). The scheduler self-gates to 4am–8pm ET on weekdays
(it does **not** know market holidays).

## Tuning

Everything is in [`src/config.js`](src/config.js): provider/feed, universe
filters (price/volume/relvol/gap), signal thresholds (EMA lengths, volume
surge), the risk model (`stopAtrMult`, `targetRR`), backtest horizon, and alert
rate limits. Fewer, higher-quality alerts beat a firehose.

## Honest limitations

- **"Great catalyst" is only proxied** by gap % + unusual volume — it does not
  read news.
- **Long-only, single timeframe (1-min).** No shorting, no multi-timeframe
  confirmation.
- **Backtests flatter reality:** they ignore slippage, fees, and the fact that
  you can't always get the fill at the trigger price. Treat positive backtest
  results as *necessary, not sufficient*.
- **Free/IEX data is a volume subset;** signals may differ from full-market
  (`sip`) data. Prototype on IEX, validate on the feed you'll actually trade.
