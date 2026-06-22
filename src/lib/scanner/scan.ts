// Orchestrator: turn the two data sources + the scoring engine into a ranked
// list of the day's best setups. Designed to degrade gracefully — if the live
// sources can't be reached (network egress, rate limit, outage) it falls back
// to bundled sample data and flags the result so the UI can say so plainly.

import { scoreSetup } from "./score";
import { fetchUniverse } from "./tradingview";
import { fetchSeriesBatch } from "./yahoo";
import { SAMPLE_UNIVERSE, sampleSeries } from "./sample";
import type { PriceSeries, RawQuote, ScanResult, Setup } from "./types";

/** How many of the top-ranked names get enriched with Yahoo history. */
const ENRICH_TOP = 12;
/** How many setups the dashboard ultimately shows. */
const RETURN_TOP = 10;

export type ScanOptions = {
  /** Force the bundled sample data (used for previews / offline). */
  sample?: boolean;
  limit?: number;
};

export async function runScan(opts: ScanOptions = {}): Promise<ScanResult> {
  const warnings: string[] = [];
  const returnTop = opts.limit ?? RETURN_TOP;

  if (opts.sample) {
    return buildSampleResult(returnTop, [
      "Showing bundled sample data by request.",
    ]);
  }

  // 1. Universe — the day's most in-play names.
  let universe: RawQuote[];
  try {
    universe = await fetchUniverse();
  } catch (err) {
    return buildSampleResult(returnTop, [
      `Live universe unavailable (${errMsg(err)}); showing sample data.`,
    ]);
  }
  if (universe.length === 0) {
    return buildSampleResult(returnTop, [
      "Live scanner returned no rows; showing sample data.",
    ]);
  }

  // 2. Provisional rank on snapshot-only scores so we know which names are
  //    worth the extra Yahoo round-trip.
  const provisional = universe
    .map((q) => scoreSetup(q))
    .sort((a, b) => b.score - a.score);

  const enrichSymbols = provisional.slice(0, ENRICH_TOP).map((s) => s.symbol);

  // 3. Enrich the leaders with real price history (support/resistance, spark).
  let seriesMap = new Map<string, PriceSeries>();
  try {
    seriesMap = await fetchSeriesBatch(enrichSymbols);
    if (seriesMap.size === 0) {
      warnings.push("Price history unavailable; scores use snapshot data only.");
    }
  } catch (err) {
    warnings.push(`Price history unavailable (${errMsg(err)}).`);
  }

  // 4. Final score, now with history where we have it.
  const bySymbol = new Map(universe.map((q) => [q.symbol, q]));
  const setups: Setup[] = [];
  for (const q of bySymbol.values()) {
    setups.push(scoreSetup(q, seriesMap.get(q.symbol)));
  }
  setups.sort((a, b) => b.score - a.score);

  return {
    generatedAt: new Date().toISOString(),
    source: "live",
    warnings,
    universeSize: universe.length,
    setups: setups.slice(0, returnTop),
  };
}

function buildSampleResult(returnTop: number, warnings: string[]): ScanResult {
  const setups = SAMPLE_UNIVERSE.map((q) => {
    const closes = sampleSeries(q);
    const series: PriceSeries = {
      symbol: q.symbol,
      closes,
      // Approximate intraday range around each close for the indicators.
      highs: closes.map((c) => c * 1.012),
      lows: closes.map((c) => c * 0.988),
      volumes: closes.map(() => q.volume),
    };
    return scoreSetup(q, series);
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, returnTop);

  return {
    generatedAt: new Date().toISOString(),
    source: "sample",
    warnings,
    universeSize: SAMPLE_UNIVERSE.length,
    setups,
  };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "unknown error";
}
