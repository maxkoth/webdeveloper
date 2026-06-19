// Pure technical-indicator math. No I/O, so it's unit-testable (see
// test/indicators.test.js). A "bar" is { t, o, h, l, c, v } (epoch ms, OHLCV).

/** Exponential moving average series for the given period. Returns an array the
 *  same length as `values`; entries before the seed are null. */
export function ema(values, period) {
  if (!values.length || period <= 0) return [];
  const k = 2 / (period + 1);
  const out = new Array(values.length).fill(null);
  // Seed with SMA of the first `period` values.
  if (values.length < period) return out;
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Session VWAP series (cumulative typical-price × volume ÷ cumulative volume).
 *  Computed from the session's bars so it's correct in extended hours. */
export function vwap(bars) {
  const out = new Array(bars.length).fill(null);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const typical = (b.h + b.l + b.c) / 3;
    cumPV += typical * b.v;
    cumV += b.v;
    out[i] = cumV > 0 ? cumPV / cumV : null;
  }
  return out;
}

/** Average True Range (Wilder). Returns the latest ATR value, or null. */
export function atr(bars, period = 14) {
  if (bars.length < period + 1) return null;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const prevClose = bars[i - 1].c;
    trs.push(Math.max(b.h - b.l, Math.abs(b.h - prevClose), Math.abs(b.l - prevClose)));
  }
  // Wilder smoothing.
  let a = trs.slice(0, period).reduce((s, x) => s + x, 0) / period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
  return a;
}

/** Volume of the last bar vs the average of the prior `lookback` bars. */
export function volumeSurge(bars, lookback = 20) {
  if (bars.length < lookback + 1) return null;
  const last = bars[bars.length - 1].v;
  const prior = bars.slice(-lookback - 1, -1);
  const avg = prior.reduce((s, b) => s + b.v, 0) / prior.length;
  return avg > 0 ? last / avg : null;
}

// ── Candlestick patterns (evaluated on the last bar) ────────────────────────

export function isBullishEngulfing(bars) {
  if (bars.length < 2) return false;
  const p = bars[bars.length - 2];
  const c = bars[bars.length - 1];
  return p.c < p.o && c.c > c.o && c.c >= p.o && c.o <= p.c;
}

export function isHammer(bars) {
  const c = bars[bars.length - 1];
  if (!c) return false;
  const body = Math.abs(c.c - c.o);
  const range = c.h - c.l;
  if (range <= 0) return false;
  const lowerWick = Math.min(c.o, c.c) - c.l;
  const upperWick = c.h - Math.max(c.o, c.c);
  return lowerWick >= body * 2 && upperWick <= body && body / range < 0.4;
}

/** True if the close just crossed from below `line` to at/above it. */
export function crossedAbove(closes, lineSeries) {
  const n = closes.length;
  if (n < 2) return false;
  const a = lineSeries[n - 2];
  const b = lineSeries[n - 1];
  if (a == null || b == null) return false;
  return closes[n - 2] < a && closes[n - 1] >= b;
}
