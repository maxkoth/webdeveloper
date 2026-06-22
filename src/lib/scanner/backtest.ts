// Backtest harness. For each trading day in a window, it scores every symbol
// using ONLY data available that day (see snapshotAt — no lookahead), buys the
// top-N highest scorers at that day's close, and measures the forward return
// `horizon` days later. It then compares the strategy's average forward return
// to the baseline of holding every symbol equally over the same days.
//
// This is the honest test of whether the scoring has any edge. Read the caveats
// in snapshot.ts: the backtest approximates a couple of live-only signals
// (TradingView rating, real news sentiment) and trades daily closes without
// slippage or fees. Treat the output as a sanity check, not a track record.

import { scoreSetup } from "./score";
import { snapshotAt, sliceSeries } from "./snapshot";
import type { PriceSeries } from "./types";

export type BacktestConfig = {
  topN: number; // how many top-ranked names to "buy" each day
  horizon: number; // holding period in trading days
  minScore: number; // only take setups scoring at least this
  warmup: number; // bars to skip at the start so indicators are valid
};

export const DEFAULT_BACKTEST: BacktestConfig = {
  topN: 3,
  horizon: 5,
  minScore: 60,
  warmup: 50,
};

export type Trade = {
  day: number;
  symbol: string;
  score: number;
  entry: number;
  exit: number;
  returnPct: number;
};

export type BacktestResult = {
  config: BacktestConfig;
  symbols: number;
  tradingDays: number;
  trades: number;
  // Strategy stats
  avgReturnPct: number;
  winRatePct: number;
  medianReturnPct: number;
  bestPct: number;
  worstPct: number;
  // Baseline: average forward return of ALL names over the same days.
  baselineAvgReturnPct: number;
  /** Strategy edge over baseline, in percentage points. */
  edgePct: number;
  /** A few sample trades for eyeballing. */
  sampleTrades: Trade[];
};

/**
 * Run the backtest across a set of symbol price series. All series should cover
 * the same window; days are indexed positionally.
 */
export function runBacktest(
  seriesList: PriceSeries[],
  config: BacktestConfig = DEFAULT_BACKTEST,
): BacktestResult {
  const { topN, horizon, minScore, warmup } = config;
  const len = Math.min(...seriesList.map((s) => s.closes.length));

  const trades: Trade[] = [];
  let baselineSum = 0;
  let baselineCount = 0;
  let tradingDays = 0;

  // Walk each day, leaving room for the forward horizon at the end.
  for (let day = warmup; day < len - horizon; day++) {
    tradingDays++;

    // Score every symbol as of `day`.
    const scored: { symbol: string; score: number; idx: number; sIdx: number }[] =
      [];
    seriesList.forEach((series, sIdx) => {
      const snap = snapshotAt(series, day);
      if (!snap) return;
      const setup = scoreSetup(snap, sliceSeries(series, day));
      scored.push({ symbol: series.symbol, score: setup.score, idx: day, sIdx });

      // Baseline: this symbol's forward return over the horizon, every day.
      const fwd = forwardReturn(series, day, horizon);
      if (fwd != null) {
        baselineSum += fwd;
        baselineCount++;
      }
    });

    // Take the day's top-N qualifying setups.
    scored
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .forEach((pick) => {
        const series = seriesList[pick.sIdx];
        const ret = forwardReturn(series, day, horizon);
        if (ret == null) return;
        trades.push({
          day,
          symbol: pick.symbol,
          score: pick.score,
          entry: series.closes[day],
          exit: series.closes[day + horizon],
          returnPct: ret,
        });
      });
  }

  const returns = trades.map((t) => t.returnPct);
  const avgReturnPct = mean(returns);
  const baselineAvgReturnPct = baselineCount ? baselineSum / baselineCount : 0;

  return {
    config,
    symbols: seriesList.length,
    tradingDays,
    trades: trades.length,
    avgReturnPct: round(avgReturnPct),
    winRatePct: round(
      (returns.filter((r) => r > 0).length / (returns.length || 1)) * 100,
    ),
    medianReturnPct: round(median(returns)),
    bestPct: round(returns.length ? Math.max(...returns) : 0),
    worstPct: round(returns.length ? Math.min(...returns) : 0),
    baselineAvgReturnPct: round(baselineAvgReturnPct),
    edgePct: round(avgReturnPct - baselineAvgReturnPct),
    sampleTrades: trades.slice(0, 8),
  };
}

function forwardReturn(
  series: PriceSeries,
  day: number,
  horizon: number,
): number | null {
  const entry = series.closes[day];
  const exit = series.closes[day + horizon];
  if (entry == null || exit == null || entry === 0) return null;
  return ((exit - entry) / entry) * 100;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const round = (n: number) => Math.round(n * 100) / 100;
