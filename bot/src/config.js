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
    lookbackDays: 10, // trading days to replay
    maxHoldBars: 120, // close the trade if neither stop nor target hits in N bars
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
