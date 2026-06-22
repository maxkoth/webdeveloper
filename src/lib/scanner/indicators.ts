// Pure technical-analysis helpers. No I/O, no dependencies — every function
// takes plain number arrays so they can be unit-tested in isolation and run
// on either the server or the client. Series are oldest -> newest.

import type { Levels, PriceSeries } from "./types";

/** Simple moving average of the last `period` values. */
export function sma(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  const window = values.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

/** Exponential moving average over the whole series, returns the latest value. */
export function ema(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` points, then walk forward.
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

/** Wilder's RSI. Returns 0..100, or null when there isn't enough data. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Average True Range — a volatility unit used to size stops. */
export function atr(series: PriceSeries, period = 14): number | null {
  const { highs, lows, closes } = series;
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trs.push(tr);
  }
  return sma(trs, period);
}

/** Rate of change over `period` bars, in percent. */
export function roc(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const past = closes[closes.length - 1 - period];
  if (past === 0) return null;
  return ((closes[closes.length - 1] - past) / past) * 100;
}

/**
 * Support / resistance from recent swing structure. We take the lookback
 * window, use its extreme low as support and extreme high as resistance, and
 * report where the latest close sits between them. Crude but robust, and it
 * mirrors how a trader eyeballs a chart's range.
 */
export function levels(series: PriceSeries, lookback = 40): Levels | null {
  const { highs, lows, closes } = series;
  if (closes.length < 5) return null;
  const hi = highs.slice(-lookback);
  const lo = lows.slice(-lookback);
  const resistance = Math.max(...hi);
  const support = Math.min(...lo);
  const last = closes[closes.length - 1];
  const span = resistance - support;
  const positionInRange = span > 0 ? clamp((last - support) / span, 0, 1) : 0.5;
  return { support, resistance, positionInRange };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Map a value from one range onto 0..1, clamped. */
export function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}
