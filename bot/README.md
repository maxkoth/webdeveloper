# Play Scanner Bot

An **alerts-only** intraday setup scanner. From 4am–8pm ET it scans the US stock
universe (via Polygon), flags rule-based setups, and texts you the **entry,
stop-loss, and target** via Twilio.

> ## Read this before anything else
> - **It never places trades.** It only texts you setups to consider yourself.
> - **It is NOT a money machine and has no proven edge.** The rules (VWAP reclaim,
>   EMA cross + volume, candlestick reversals, relative-volume/gap as a catalyst
>   proxy) are a transparent *starting point*. Scanning thousands of names will
>   surface a lot of noise; most alerts will not be good trades.
> - **Paper-trade it for weeks.** Run in `dry-run` mode, log the alerts, and check
>   whether the setups would actually have worked *before* you risk a cent.
> - **This is not financial advice.** You are responsible for every trade.

## What it does

1. One Polygon snapshot call pulls the whole market.
2. **Prefilter** (cheap): keep names that are liquid, *moving* (gap/momentum), and
   showing *unusual volume* — the "catalyst" proxy. Thousands → ~150 candidates.
3. For each candidate, fetch intraday 1-min bars and compute VWAP, EMA(9/20),
   ATR, volume surge.
4. **Detect setups** (long-only v1): VWAP reclaim, EMA cross + volume, bullish
   candlestick above VWAP — each with an ATR-based stop and a 2R target.
5. **De-dupe** (one alert per symbol+setup per cooldown) and **text** the survivors.

## Setup

```bash
cd bot
npm install
cp .env.example .env      # then fill it in
```

Fill `.env`:
- **Polygon** (`POLYGON_API_KEY`): https://polygon.io. Real-time + extended-hours
  full-market data is their **Advanced** tier (~$199/mo). On cheaper/delayed
  plans, leave `POLYGON_REALTIME=false` and treat everything as paper-test only.
- **Twilio** (`TWILIO_*`): https://twilio.com — buy a number, copy the SID/token.
  Only required when `MODE=live`.

## Run

```bash
# Safe: prints alerts to the console, sends no texts. Start here and tune.
npm start                 # MODE=dry-run in .env

# One scan and exit (good for testing or an external cron):
npm run scan:once

# Go live (texts your phone) — ONLY after paper-testing:
#   set MODE=live in .env, then:
npm start
```

It runs on your Mac, so the Mac must stay awake during the session (disable
sleep, e.g. `caffeinate -s`). The scheduler self-gates to 4am–8pm ET on
weekdays. It does **not** know market holidays — when `POLYGON_REALTIME=true` it
also checks Polygon's market-status endpoint as a safety net.

## Tuning

Everything lives in [`src/config.js`](src/config.js): universe filters
(price/volume/relvol/gap), signal thresholds (EMA lengths, volume surge), the
risk model (`stopAtrMult`, `targetRR`), and alert rate limits. Tighten these
until the *quality* of alerts is worth acting on. Fewer, better alerts beat a
firehose.

## Tests

```bash
npm test    # verifies the indicator math and the signal engine (no API needed)
```

## Honest limitations

- **"Great catalyst" is only proxied** by gap % + unusual volume. It does not read
  news. A real catalyst filter needs a news feed and judgment.
- **Long-only, single-timeframe** (1-min). No shorting, no multi-timeframe
  confirmation, no backtester yet.
- **Delayed data = delayed/invalid signals.** Intraday setups need real-time data
  to be actionable; on a delayed plan this is a research/paper tool only.
