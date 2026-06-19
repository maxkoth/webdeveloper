// Every knob the scanner uses lives here. Tune these against PAPER results
// before trusting a single alert with real money. Nothing here guarantees a
// profitable trade — these are filters that narrow a firehose, not an edge.

import "dotenv/config";

export const config = {
  mode: process.env.MODE === "live" ? "live" : "dry-run", // dry-run = console only
  scanIntervalMin: Number(process.env.SCAN_INTERVAL_MIN) || 2,

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

  // Stage 1 — universe prefilter (applied to the full-market snapshot, cheap).
  // Cuts thousands of tickers down to a candidate set worth fetching bars for.
  universe: {
    minPrice: 1.5,
    maxPrice: 500,
    minDayVolume: 300_000, // liquidity floor
    minAbsChangePct: 3, // needs to be moving (gap/momentum proxy for "catalyst")
    minRelVolume: 2, // today's pace vs prior day (unusual activity)
    maxCandidates: 150, // cap bar-fetches per scan
  },

  // Stage 2 — signal thresholds.
  signals: {
    emaFast: 9,
    emaSlow: 20,
    atrPeriod: 14,
    minBars: 25, // need enough intraday history to compute indicators
    volumeSurgeMult: 1.8, // last bar volume vs recent average
    // Risk model for entry/SL/TP:
    stopAtrMult: 1.5, // stop = entry − 1.5×ATR (long)
    targetRR: 2, // target = entry + 2×risk  (2R)
  },

  // Don't spam: one alert per symbol per setup-type within this cooldown.
  alerts: {
    cooldownMin: 60,
    maxPerScan: 8, // hard cap so a chaotic open can't text you 200 times
  },
};

export function validateConfig(cfg = config) {
  const problems = [];
  if (!cfg.polygon.apiKey) problems.push("POLYGON_API_KEY missing");
  if (cfg.mode === "live") {
    for (const [k, v] of Object.entries(cfg.twilio)) {
      if (!v) problems.push(`TWILIO ${k} missing (required in live mode)`);
    }
  }
  return problems;
}
