// Reconstruct a point-in-time snapshot (RawQuote) from price history, using
// ONLY bars up to and including index `i`. This is what lets the backtest score
// a past day with the same engine that scores today — no lookahead.
//
// Honest limitations, surfaced so the backtest can't quietly mislead:
//  - `rating` (TradingView's aggregate) can't be reconstructed from prices, so
//    it's set neutral (0). The trend dimension leans more on the MA stack/ADX.
//  - `marketCap`, `high52/low52`, `name`, `sector` aren't needed for scoring
//    the way the backtest uses them and are filled with reasonable stand-ins.
//  - News sentiment is NOT available historically on the free tier, so the
//    backtest runs the catalyst dimension on its gap+volume proxy. The live
//    scanner uses real news; the backtest approximates it. Stated plainly.

import { adx, macd, rsi, sma } from "./indicators";
import type { PriceSeries, RawQuote } from "./types";

/** Build a RawQuote as it would have looked at the close of bar `i`. */
export function snapshotAt(series: PriceSeries, i: number): RawQuote | null {
  const { closes, highs, lows, volumes, opens } = series;
  if (i < 30 || i >= closes.length) return null;

  const win = (arr: number[]) => arr.slice(0, i + 1); // history up to bar i

  const close = closes[i];
  const prevClose = closes[i - 1];
  const changePct = prevClose ? ((close - prevClose) / prevClose) * 100 : 0;

  const sma20 = sma(win(closes), 20);
  const sma50 = sma(win(closes), 50) ?? sma20 ?? close;
  const sma200 = sma(win(closes), 200) ?? sma50 ?? close;
  const rsiVal = rsi(win(closes)) ?? 50;
  const macdVal = macd(win(closes));
  const adxVal = adx(win(highs), win(lows), win(closes)) ?? 0;

  // Relative volume vs the trailing 10-day average.
  const recentVol = volumes.slice(Math.max(0, i - 10), i);
  const avgVol = recentVol.length
    ? recentVol.reduce((a, b) => a + b, 0) / recentVol.length
    : volumes[i] || 1;
  const relVolume = avgVol ? volumes[i] / avgVol : 1;

  // Gap = today's open vs yesterday's close (opens fall back to close).
  const open = opens?.[i] ?? close;
  const gapPct = prevClose ? ((open - prevClose) / prevClose) * 100 : 0;

  // 52-week extremes from the window we have (Yahoo 1y range when available).
  const hi = Math.max(...win(highs));
  const lo = Math.min(...win(lows));

  return {
    symbol: series.symbol,
    name: series.symbol,
    close,
    changePct,
    volume: volumes[i],
    relVolume,
    marketCap: 1e9,
    rsi: rsiVal,
    momentum: changePct,
    adx: adxVal,
    macd: macdVal?.macd ?? 0,
    macdSignal: macdVal?.signal ?? 0,
    sma20: sma20 ?? close,
    sma50,
    sma200,
    gapPct,
    high52: hi,
    low52: lo,
    rating: 0, // not reconstructable from prices — neutral
    sector: "—",
  };
}

/** A history slice ending at bar `i`, for feeding the indicators/levels. */
export function sliceSeries(series: PriceSeries, i: number): PriceSeries {
  return {
    symbol: series.symbol,
    opens: series.opens?.slice(0, i + 1),
    closes: series.closes.slice(0, i + 1),
    highs: series.highs.slice(0, i + 1),
    lows: series.lows.slice(0, i + 1),
    volumes: series.volumes.slice(0, i + 1),
  };
}
