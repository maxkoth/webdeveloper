// Every knob the scanner uses lives here. Tune these against PAPER + BACKTEST
// results before trusting a single alert with real money. Nothing here is an
// edge — these are filters that narrow a firehose.

import "dotenv/config";

export const config = {
  mode: process.env.MODE === "live" ? "live" : "dry-run", // dry-run = console only
  scanIntervalMin: Number(process.env.SCAN_INTERVAL_MIN) || 2,

  // Which market-data provider feeds the scanner + backtester.
  dataProvider: process.env.DATA_PROVIDER === "polygon" ? "polygon" : "alpaca",

  alpaca: {
    keyId: process.env.ALPACA_KEY_ID || "",
    secret: process.env.ALPACA_SECRET_KEY || "",
    feed: process.env.ALPACA_FEED || "iex", // "iex" (free) or "sip" (paid real-time)
    paper: process.env.ALPACA_PAPER !== "false", // paper keys by default (set false for live keys)
  },
  polygon: {
    apiKey: process.env.POLYGON_API_KEY || "",
    realtime: process.env.POLYGON_REALTIME === "true",
  },
  twilio: {
    sid: process.env.TWILIO_ACCOUNT_SID || "",
    token: process.env.TWILIO_AUTH_TOKEN || "",
    from: process.env.TWILIO_FROM || "",
    to: process.env.ALERT_TO || "",
  },

  // Trading session, US Eastern. Pre-market 4:00, post-market to 20:00.
  session: { startHour: 4, endHour: 20, timezone: "America/New_York" },

  // Stage 1 — candidate prefilter. Null fields are simply not filtered on, so
  // it works whether the provider gives full snapshots (Polygon) or a movers
  // screener (Alpaca).
  universe: {
    minPrice: 1.5,
    maxPrice: 500,
    minDayVolume: 300_000,
    minAbsChangePct: 3, // needs to be moving (gap/momentum = "catalyst" proxy)
    minRelVolume: 2, // today's pace vs prior day (only enforced when known)
    maxCandidates: 150,
  },

  // Long-term value BUY alerts (npm run value). Calls the site's /api/screen
  // (SEC-fundamentals cache + DCF) and texts quality businesses trading at/below
  // their margin-of-safety buy price. Requires the website running (npm run dev).
  value: {
    screenUrl: process.env.VALUE_SCREEN_URL || "http://localhost:3000/api/screen",
    statuses: ["bargain"], // "bargain" = at/below buy-below line. Add "fair" to widen.
    cooldownHours: 24 * 7, // don't re-text the same name within a week
    maxPerRun: 20,
  },

  // Stage 2 — signal thresholds + risk model.
  signals: {
    emaFast: 9,
    emaSlow: 20,
    atrPeriod: 14,
    minBars: 25,
    volumeSurgeMult: 1.8,
    stopAtrMult: 1.5, // stop = entry − 1.5×ATR (long)
    targetRR: 2, // target = entry + 2×risk
  },

  // Backtest: how a fired setup is scored against subsequent bars.
  backtest: {
    lookbackDays: 10, // trading days to replay (raise this — 10 is a tiny sample)
    maxHoldBars: 120, // close the trade if neither stop nor target hits in N bars
    entryMode: "nextOpen", // "nextOpen" (realistic) | "signalClose" (optimistic)
    slippageBps: 5, // per-fill haircut, basis points. 5 = 0.05% each side. Raise
    // this for fast/illiquid names — momentum entries slip more than you think.
  },

  // Day-trade STRATEGY research (npm run backtest:strategies). Each strategy is a
  // hypothesis to be tested, not a believed edge. Results split in/out-of-sample.
  backtestDays: 60, // history to pull for strategy testing (more = less noise)
  oosFraction: 0.3, // hold out the most recent 30% of days for out-of-sample
  gapTopK: 15, // gap-and-go fair test: how many top gappers to trade each day
  strategies: {
    orbMinutes: 15, // opening-range length (first N minutes after 9:30)
    gapMin: 0.04, // gap-and-go / selective: minimum overnight gap %
    stopAtrMult: 1.0, // stop distance in ATRs
    targetRR: 2, // reward:risk target
    vwapDevAtr: 1.5, // vwap-reversion: how far below VWAP (in ATRs) to trigger
    selectiveWindowMin: 90, // selective-trend: only trade the first N minutes
    maxHoldBars: 120,
    slippageBps: 5,
  },

  alerts: { cooldownMin: 60, maxPerScan: 8 },
};

export function validateConfig(cfg = config) {
  const problems = [];
  if (cfg.dataProvider === "alpaca") {
    if (!cfg.alpaca.keyId) problems.push("ALPACA_KEY_ID missing");
    if (!cfg.alpaca.secret) problems.push("ALPACA_SECRET_KEY missing");
  } else {
    if (!cfg.polygon.apiKey) problems.push("POLYGON_API_KEY missing");
  }
  if (cfg.mode === "live") {
    for (const [k, v] of Object.entries(cfg.twilio)) {
      if (!v) problems.push(`TWILIO ${k} missing (required in live mode)`);
    }
  }
  return problems;
}
