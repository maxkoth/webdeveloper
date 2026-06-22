/**
 * Backtest CLI.
 *
 *   npx tsx scripts/backtest.ts AAPL,MSFT,NVDA,MRVL,AMD --horizon 5 --top 3
 *
 * Pulls ~1y of daily history per symbol from Yahoo, replays the scanner over
 * the window with no lookahead, and reports the strategy's forward returns
 * vs. an equal-weight baseline. Needs network egress to Yahoo.
 *
 * Read the caveats in src/lib/scanner/snapshot.ts: this approximates a couple
 * of live-only signals and ignores fees/slippage. It's a sanity check on the
 * scoring's edge, not a brokerage track record. Not financial advice.
 */
import { fetchSeries } from "../src/lib/scanner/yahoo";
import { runBacktest, DEFAULT_BACKTEST } from "../src/lib/scanner/backtest";
import type { PriceSeries } from "../src/lib/scanner/types";

const DEFAULT_SYMBOLS =
  "AAPL,MSFT,NVDA,AMD,MRVL,AVGO,SMCI,PLTR,COIN,TSLA,META,AMZN,MU,DELL,VST";

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
}

async function main() {
  const symbolsArg = process.argv[2]?.startsWith("--")
    ? DEFAULT_SYMBOLS
    : process.argv[2] ?? DEFAULT_SYMBOLS;
  const symbols = symbolsArg.split(",").map((s) => s.trim().toUpperCase());

  const config = {
    ...DEFAULT_BACKTEST,
    horizon: arg("horizon", DEFAULT_BACKTEST.horizon),
    topN: arg("top", DEFAULT_BACKTEST.topN),
    minScore: arg("min", DEFAULT_BACKTEST.minScore),
  };

  console.log(`Fetching 1y history for ${symbols.length} symbols…`);
  const series: PriceSeries[] = [];
  for (const sym of symbols) {
    const s = await fetchSeries(sym, "1y");
    if (s) series.push(s);
    else console.warn(`  ! no data for ${sym}`);
  }
  if (series.length < 2) {
    console.error("Not enough data to backtest (need >= 2 symbols).");
    process.exit(1);
  }

  const r = runBacktest(series, config);
  console.log("\n=== Backtest ===");
  console.log(
    `config: top ${r.config.topN}, hold ${r.config.horizon}d, min score ${r.config.minScore}`,
  );
  console.log(`symbols: ${r.symbols}, trading days: ${r.tradingDays}, trades: ${r.trades}`);
  console.log(`avg return:    ${r.avgReturnPct}%`);
  console.log(`win rate:      ${r.winRatePct}%`);
  console.log(`median:        ${r.medianReturnPct}%`);
  console.log(`best / worst:  ${r.bestPct}% / ${r.worstPct}%`);
  console.log(`baseline avg:  ${r.baselineAvgReturnPct}%  (equal-weight, same days)`);
  console.log(`EDGE:          ${r.edgePct} pts vs baseline`);
  console.log("\nsample trades:");
  r.sampleTrades.forEach((t) =>
    console.log(
      `  d${t.day} ${t.symbol} score ${t.score} ${t.entry.toFixed(2)}→${t.exit.toFixed(2)} = ${t.returnPct.toFixed(2)}%`,
    ),
  );
  console.log(
    "\nNot financial advice. Approximates live-only signals; ignores fees/slippage.",
  );
}

main();
