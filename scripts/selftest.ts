/**
 * Self-test for the scanner internals. Runs with no network — it validates the
 * indicator math against known values and proves the backtest mechanics on a
 * synthetic dataset with a deliberate, known edge. This is how the scoring +
 * backtest are verified in environments where live data egress is blocked.
 *
 *   npx tsx scripts/selftest.ts
 */
import { rsi, macd, adx, sma, ema } from "../src/lib/scanner/indicators";
import { runBacktest } from "../src/lib/scanner/backtest";
import type { PriceSeries } from "../src/lib/scanner/types";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  const mark = cond ? "✓" : "✗";
  if (!cond) failures++;
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}
const approx = (a: number, b: number, tol = 0.5) => Math.abs(a - b) <= tol;

console.log("Indicator math:");
// SMA / EMA on a trivial ramp.
check("sma([1..5],5)=3", sma([1, 2, 3, 4, 5], 5) === 3);
check("ema length guard", ema([1, 2], 5) === null);

// RSI of a strictly rising series saturates near 100; of a falling one near 0.
// 40 bars so MACD (needs ~35) has enough history too.
const rising = Array.from({ length: 40 }, (_, i) => 100 + i);
const falling = Array.from({ length: 40 }, (_, i) => 100 - i);
const rUp = rsi(rising) ?? 0;
const rDn = rsi(falling) ?? 100;
check("RSI(rising)≈100", rUp > 95, `got ${rUp.toFixed(1)}`);
check("RSI(falling)≈0", rDn < 5, `got ${rDn.toFixed(1)}`);

// Classic RSI textbook series (Wilder) — expect ~70.5 on this known input.
const wilder = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
  46.03, 45.61, 46.28, 46.28,
];
const rW = rsi(wilder) ?? 0;
check("RSI(Wilder sample)≈70.5", approx(rW, 70.5, 1.5), `got ${rW.toFixed(2)}`);

// MACD on an ACCELERATING uptrend: the line pulls above its signal (bullish).
// (A perfectly linear ramp correctly gives macd == signal, so we use a convex
// series to assert the bullish-cross direction.)
const accel = Array.from({ length: 60 }, (_, i) => 100 + i * i * 0.1);
const m = macd(accel);
check(
  "MACD bullish on accelerating uptrend",
  !!m && m.macd > m.signal && m.macd > 0,
  m ? `${m.macd.toFixed(2)}>${m.signal.toFixed(2)}` : "null",
);

// ADX on a clean trend should read "trending" (>25).
const adxVal =
  adx(
    rising.map((c) => c + 0.5),
    rising.map((c) => c - 0.5),
    rising,
  ) ?? 0;
check("ADX(trend)>25", adxVal > 25, `got ${adxVal.toFixed(1)}`);

console.log("\nBacktest mechanics (synthetic, known edge):");
// Build two cohorts of symbols:
//  - "momo" names: strong, accelerating uptrends -> should score high and keep
//    rising over the forward horizon.
//  - "chop" names: flat, noisy -> should score low and go nowhere.
// A working pipeline must show the strategy beating the equal-weight baseline.
function makeSeries(symbol: string, kind: "momo" | "chop"): PriceSeries {
  const n = 160;
  const closes: number[] = [];
  const volumes: number[] = [];
  let seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 7);
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let price = 50;
  for (let i = 0; i < n; i++) {
    if (kind === "momo") {
      price *= 1 + 0.006 + (rand() - 0.5) * 0.012;
      // Participation builds as the trend matures, with day-to-day spikes —
      // so recent relative volume reads elevated, like a real in-play name.
      volumes.push(900_000 * (1 + i / n) * (1 + rand() * 1.2));
    } else {
      price *= 1 + (rand() - 0.5) * 0.01;
      volumes.push(700_000 * (0.9 + rand() * 0.2));
    }
    closes.push(price);
  }
  return {
    symbol,
    opens: closes.map((c) => c),
    closes,
    highs: closes.map((c) => c * 1.01),
    lows: closes.map((c) => c * 0.99),
    volumes,
  };
}

const universe: PriceSeries[] = [
  ...["MOMO1", "MOMO2", "MOMO3"].map((s) => makeSeries(s, "momo")),
  ...["CHOP1", "CHOP2", "CHOP3", "CHOP4"].map((s) => makeSeries(s, "chop")),
];

// minScore 0 here so the test exercises pure top-N selection (production
// defaults to 60). The momentum cohort consistently outranks the chop cohort,
// so a working pipeline must pick it and beat the equal-weight baseline.
const result = runBacktest(universe, {
  topN: 2,
  horizon: 5,
  minScore: 0,
  warmup: 50,
});
console.log(
  `  trades=${result.trades} avg=${result.avgReturnPct}% baseline=${result.baselineAvgReturnPct}% edge=${result.edgePct}pts win=${result.winRatePct}%`,
);
check("backtest produced trades", result.trades > 0);
check(
  "strategy beats baseline (edge>0)",
  result.edgePct > 0,
  `edge ${result.edgePct}pts`,
);
check("strategy avg return positive", result.avgReturnPct > 0);

console.log(
  failures === 0
    ? "\nAll self-tests passed."
    : `\n${failures} self-test(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
