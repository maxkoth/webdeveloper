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

/**
 * MACD line + signal line (12/26/9 by default). Returns the latest values, or
 * null when there isn't enough data. Built on full EMA series so the signal is
 * a proper EMA of the MACD line rather than a single point.
 */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: number; signal: number } | null {
  if (closes.length < slow + signalPeriod) return null;
  const emaFast = emaSeries(closes, fast);
  const emaSlow = emaSeries(closes, slow);
  // Align: emaSlow starts later. Build the MACD line over the common tail.
  const start = slow - 1;
  const macdLine: number[] = [];
  for (let i = start; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  const signalLine = emaSeries(macdLine, signalPeriod);
  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalLine[signalLine.length - 1],
  };
}

/** Wilder's ADX — trend strength, 0..100. >25 is a trending market. */
export function adx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number | null {
  const n = highs.length;
  if (n < period * 2) return null;

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < n; i++) {
    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    tr.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1]),
      ),
    );
  }

  // Wilder-smooth TR and the directional movements.
  const smooth = (arr: number[]) => {
    let sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
    const out = [sum];
    for (let i = period; i < arr.length; i++) {
      sum = sum - sum / period + arr[i];
      out.push(sum);
    }
    return out;
  };

  const trS = smooth(tr);
  const plusS = smooth(plusDM);
  const minusS = smooth(minusDM);

  const dx: number[] = [];
  for (let i = 0; i < trS.length; i++) {
    const plusDI = trS[i] === 0 ? 0 : (100 * plusS[i]) / trS[i];
    const minusDI = trS[i] === 0 ? 0 : (100 * minusS[i]) / trS[i];
    const denom = plusDI + minusDI;
    dx.push(denom === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / denom);
  }
  if (dx.length < period) return null;
  // ADX is the smoothed average of DX.
  return dx.slice(-period).reduce((a, b) => a + b, 0) / period;
}

/** EMA over the whole series, returning a value for every index >= period-1. */
function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = new Array(values.length).fill(NaN);
  if (values.length < period) return out;
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
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
