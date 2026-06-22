# Daily Setup Scanner

Scans the day's most in-play US stocks and ranks them by a transparent,
weighted setup score across **momentum, trend, volume, technicals, and a
catalyst signal**. Includes a backtest harness and SMS alerts.

> **Not financial advice.** A high score means a name matches the profile of a
> strong, in-play setup *right now* — it is **not** a prediction, a probability,
> or a recommendation. The backtest exists precisely so you can check whether
> the scoring has any edge **before** risking money. It might show one; it might
> not. Markets are risky. Do your own research.

## What's here

| Path | What it does |
| --- | --- |
| `src/lib/scanner/` | Data sources, indicators, scoring, backtest |
| `src/app/scanner/` | The `/scanner` dashboard (server-rendered + client board) |
| `src/app/api/scan/` | `GET /api/scan` — ranked setups as JSON |
| `src/app/api/alerts/` | `GET/POST /api/alerts?mode=digest\|threshold` (secret-gated) |
| `src/lib/alerts/` | Twilio SMS + digest/threshold dispatch |
| `scripts/backtest.ts` | Replays the scanner over history, reports edge vs baseline |
| `scripts/selftest.ts` | Verifies indicator math + backtest mechanics (no network) |
| `scripts/run-alerts.ts` | Alert runner for cron / GitHub Actions |
| `.github/workflows/alerts.yml` | Scheduled alerts — no server required |

## Data sources

- **TradingView public scanner** — the day's active/high-momentum universe plus
  snapshot technicals. No key needed.
- **Yahoo Finance** — daily OHLC history for support/resistance + sparklines and
  the backtest. No key needed.
- **Finnhub** *(optional)* — real news sentiment for the catalyst dimension.
  Without `FINNHUB_API_KEY`, catalyst falls back to an honest gap+volume proxy.

> **Network note:** in this sandboxed Claude environment, outbound egress is
> allowlisted and these hosts are blocked, so live fetches 403 here and the app
> falls back to clearly-labelled **sample data**. Deploy it (Vercel etc.) or run
> the scripts on a machine with open network — or add the hosts to the
> environment's egress allowlist — to get live data.

## Setup

```bash
npm install
cp .env.example .env.local   # add keys (all optional)
npm run dev                  # open http://localhost:3000/scanner
```

## The score (0–100)

Weighted blend, each dimension explainable in the UI:

| Dimension | Weight | Reads |
| --- | --- | --- |
| Momentum | 25 | day move, multi-week thrust, RSI posture |
| Trend | 20 | moving-average stack, ADX, aggregate rating |
| Volume | 20 | relative volume vs the 10-day norm |
| Technicals | 20 | MACD posture, 52-week range position, structure |
| Catalyst | 15 | real news sentiment (Finnhub) or gap+volume proxy |

## Backtest

```bash
npm run backtest                         # default basket, 5-day hold, top 3
npm run backtest AAPL,NVDA,MRVL,AMD --horizon 10 --top 2 --min 65
```

Replays the scanner day by day with **no lookahead**, "buys" the top-N scorers
at the close, and measures forward returns against an equal-weight baseline.

**Honest caveats** (see `src/lib/scanner/snapshot.ts`): it approximates two
live-only signals — TradingView's aggregate rating (set neutral) and real news
sentiment (uses the gap+volume proxy historically) — and trades daily closes
with **no fees or slippage**. It's a sanity check on the scoring's edge, not a
brokerage track record.

Verify the engine offline (no network) anytime:

```bash
npm run scan:test   # indicator math vs known values + backtest mechanics
```

## Alerts (Twilio SMS)

Two kinds, both texting `ALERT_TO`:

- **digest** — once a day, the top setups
- **threshold** — fires when a name scores ≥ `ALERT_SCORE` (default 80)

Run manually:

```bash
npm run alerts -- digest
npm run alerts -- threshold
```

### Schedule with no server (GitHub Actions)

`.github/workflows/alerts.yml` runs a daily digest and intraday threshold checks
on GitHub's runners (open network). Add repo **secrets**: `FINNHUB_API_KEY`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `ALERT_TO` — and
optionally the **variable** `ALERT_SCORE`.

### Or via the deployed API

```
GET /api/alerts?mode=digest&secret=$ALERT_SECRET
```

Point Vercel Cron (or any scheduler) at it. Always set `ALERT_SECRET`.
