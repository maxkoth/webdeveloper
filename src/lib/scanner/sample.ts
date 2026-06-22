// Bundled fallback so the dashboard is fully reviewable when the live data
// sources are unreachable (e.g. this sandbox's network egress is allowlisted,
// or you're working offline). These are realistic, hand-built snapshots — NOT
// live quotes — and the UI clearly flags the scan as "sample" whenever they're
// used. Numbers are illustrative only.

import type { RawQuote } from "./types";

export const SAMPLE_UNIVERSE: RawQuote[] = [
  {
    symbol: "MRVL", name: "Marvell Technology", sector: "Technology services",
    close: 71.4, changePct: 6.2, volume: 41_200_000, relVolume: 3.4,
    marketCap: 61_000_000_000, rsi: 64, momentum: 5.1, adx: 31,
    macd: 1.8, macdSignal: 1.2, sma20: 66.2, sma50: 62.8, sma200: 58.1,
    gapPct: 4.1, high52: 78.4, low52: 41.2, rating: 0.62,
  } as RawQuote,
  {
    symbol: "SMCI", name: "Super Micro Computer", sector: "Electronic technology",
    close: 48.9, changePct: 9.8, volume: 88_000_000, relVolume: 3.9,
    marketCap: 28_000_000_000, rsi: 68, momentum: 7.4, adx: 34,
    macd: 2.1, macdSignal: 1.1, sma20: 42.5, sma50: 39.8, sma200: 44.2,
    gapPct: 6.2, high52: 96.3, low52: 17.2, rating: 0.51,
  } as RawQuote,
  {
    symbol: "CLS", name: "Celestica", sector: "Electronic technology",
    close: 92.7, changePct: 4.4, volume: 6_400_000, relVolume: 2.6,
    marketCap: 10_700_000_000, rsi: 66, momentum: 4.0, adx: 29,
    macd: 1.4, macdSignal: 0.9, sma20: 86.1, sma50: 80.4, sma200: 64.9,
    gapPct: 2.3, high52: 99.2, low52: 38.1, rating: 0.71,
  } as RawQuote,
  {
    symbol: "VST", name: "Vistra Corp", sector: "Utilities",
    close: 138.2, changePct: 3.1, volume: 9_100_000, relVolume: 2.1,
    marketCap: 47_000_000_000, rsi: 61, momentum: 3.2, adx: 27,
    macd: 2.9, macdSignal: 2.1, sma20: 129.4, sma50: 118.7, sma200: 95.3,
    gapPct: 1.2, high52: 146.0, low52: 52.4, rating: 0.66,
  } as RawQuote,
  {
    symbol: "APP", name: "AppLovin", sector: "Technology services",
    close: 92.1, changePct: 5.7, volume: 12_800_000, relVolume: 2.9,
    marketCap: 31_000_000_000, rsi: 69, momentum: 6.0, adx: 33,
    macd: 3.1, macdSignal: 2.0, sma20: 84.3, sma50: 78.1, sma200: 61.4,
    gapPct: 3.4, high52: 95.8, low52: 32.6, rating: 0.69,
  } as RawQuote,
  {
    symbol: "COIN", name: "Coinbase Global", sector: "Finance",
    close: 241.5, changePct: 7.9, volume: 18_400_000, relVolume: 3.1,
    marketCap: 60_000_000_000, rsi: 67, momentum: 8.1, adx: 30,
    macd: 5.2, macdSignal: 3.4, sma20: 218.6, sma50: 205.2, sma200: 197.4,
    gapPct: 5.1, high52: 283.0, low52: 118.2, rating: 0.55,
  } as RawQuote,
  {
    symbol: "RIVN", name: "Rivian Automotive", sector: "Consumer durables",
    close: 13.2, changePct: -2.1, volume: 34_000_000, relVolume: 1.8,
    marketCap: 13_000_000_000, rsi: 38, momentum: -1.4, adx: 19,
    macd: -0.3, macdSignal: -0.1, sma20: 14.1, sma50: 13.8, sma200: 12.9,
    gapPct: -1.8, high52: 18.9, low52: 8.4, rating: -0.12,
  } as RawQuote,
  {
    symbol: "DELL", name: "Dell Technologies", sector: "Electronic technology",
    close: 128.4, changePct: 2.4, volume: 7_800_000, relVolume: 1.6,
    marketCap: 90_000_000_000, rsi: 58, momentum: 2.1, adx: 24,
    macd: 1.2, macdSignal: 0.8, sma20: 122.1, sma50: 119.4, sma200: 110.2,
    gapPct: 0.9, high52: 147.0, low52: 89.2, rating: 0.48,
  } as RawQuote,
  {
    symbol: "PLTR", name: "Palantir Technologies", sector: "Technology services",
    close: 41.8, changePct: 4.9, volume: 62_000_000, relVolume: 2.4,
    marketCap: 95_000_000_000, rsi: 71, momentum: 4.6, adx: 36,
    macd: 1.6, macdSignal: 0.9, sma20: 37.2, sma50: 33.8, sma200: 28.1,
    gapPct: 2.8, high52: 44.5, low52: 20.3, rating: 0.58,
  } as RawQuote,
  {
    symbol: "MU", name: "Micron Technology", sector: "Electronic technology",
    close: 104.6, changePct: 3.6, volume: 21_000_000, relVolume: 2.0,
    marketCap: 116_000_000_000, rsi: 60, momentum: 3.4, adx: 26,
    macd: 2.2, macdSignal: 1.5, sma20: 98.4, sma50: 96.1, sma200: 102.3,
    gapPct: 1.6, high52: 157.5, low52: 78.6, rating: 0.44,
  } as RawQuote,
];

/**
 * Synthesise a plausible 60-bar daily close series from a snapshot so the
 * indicators and sparkline have something to chew on in sample mode. Shaped to
 * land on today's close after a drift consistent with the moving-average stack.
 */
export function sampleSeries(q: RawQuote): number[] {
  const bars = 60;
  const start = q.sma200 || q.close * 0.85;
  const out: number[] = [];
  let seed = q.symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => {
    // Deterministic LCG so the same symbol always renders the same chart.
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < bars; i++) {
    const t = i / (bars - 1);
    const trend = start + (q.close - start) * t;
    const wobble = (rand() - 0.5) * q.close * 0.025;
    out.push(Math.max(0.5, round(trend + wobble)));
  }
  out[out.length - 1] = q.close; // pin the last bar to the real close
  return out;
}

const round = (n: number) => Math.round(n * 100) / 100;
