// Daily OHLC history from Yahoo Finance's chart endpoint.
//
// TradingView gives us the snapshot technicals; Yahoo gives us the raw price
// series we need to derive support/resistance and draw a sparkline. We only
// call this for the handful of top-ranked candidates to stay well under any
// rate limit.

import type { PriceSeries } from "./types";

const CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

type YahooQuote = {
  open?: (number | null)[];
  high?: (number | null)[];
  low?: (number | null)[];
  close?: (number | null)[];
  volume?: (number | null)[];
};
type YahooResponse = {
  chart?: {
    result?: { indicators?: { quote?: YahooQuote[] } }[];
    error?: { description?: string } | null;
  };
};

/**
 * Fetch ~3 months of daily bars for one symbol. Returns null on any failure
 * so a single bad ticker never sinks the whole scan.
 */
export async function fetchSeries(symbol: string): Promise<PriceSeries | null> {
  try {
    const url = `${CHART_URL}/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as YahooResponse;
    const quote = json.chart?.result?.[0]?.indicators?.quote?.[0];
    if (!quote?.close) return null;

    // Yahoo pads gaps with nulls; drop any bar that's missing a field so the
    // arrays stay aligned and the indicators never see a hole.
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];
    const n = quote.close.length;
    for (let i = 0; i < n; i++) {
      const c = quote.close[i];
      const h = quote.high?.[i];
      const l = quote.low?.[i];
      const v = quote.volume?.[i];
      if (c == null || h == null || l == null) continue;
      closes.push(c);
      highs.push(h);
      lows.push(l);
      volumes.push(v ?? 0);
    }
    if (closes.length < 20) return null;

    return { symbol, closes, highs, lows, volumes };
  } catch {
    return null;
  }
}

/** Fetch several symbols in parallel; failures come back as nulls. */
export async function fetchSeriesBatch(
  symbols: string[],
): Promise<Map<string, PriceSeries>> {
  const results = await Promise.all(symbols.map((s) => fetchSeries(s)));
  const map = new Map<string, PriceSeries>();
  results.forEach((series) => {
    if (series) map.set(series.symbol, series);
  });
  return map;
}
