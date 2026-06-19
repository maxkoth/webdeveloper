// Intraday strategy hypotheses to TEST — not believed edges. Each takes a
// precomputed trading session and returns the first qualifying long entry of the
// day (or null). The backtester fills at the next bar's open with slippage and
// scores to stop/target, then reports in-sample vs out-of-sample so we can tell
// a real signal from an overfit one. Long-only, one trade per strategy per day.

import { DateTime } from "luxon";
import { vwap, atr, ema } from "./indicators.js";

const OPEN = 9 * 60 + 30; // 9:30 ET in minutes-from-midnight
const CLOSE = 16 * 60; // 16:00 ET

/** Minutes-from-midnight, US Eastern, for an epoch-ms timestamp. */
export function etMinutes(t) {
  const d = DateTime.fromMillis(t, { zone: "America/New_York" });
  return d.hour * 60 + d.minute;
}

/** Precompute everything the strategies need for one day. `prevClose` is the
 *  previous session's close (for the gap); null on the first day. Returns null
 *  for days with too little regular-session data. No look-ahead: the opening
 *  range is a fixed value once its window has passed, and entries are gated to
 *  bars after it. */
export function buildSession(symbol, bars, prevClose, cfg) {
  const s = cfg.strategies;
  const reg = [];
  for (const b of bars) {
    const m = etMinutes(b.t);
    if (m >= OPEN && m < CLOSE) reg.push({ ...b, m });
  }
  if (reg.length < 12) return null;

  const orbEnd = OPEN + s.orbMinutes;
  const orb = reg.filter((b) => b.m < orbEnd);
  if (!orb.length) return null;
  const orbHigh = Math.max(...orb.map((b) => b.h));
  const orbLow = Math.min(...orb.map((b) => b.l));
  const open = reg[0].o;
  const gapPct = prevClose && prevClose > 0 ? (open - prevClose) / prevClose : null;
  const closes = reg.map((b) => b.c);

  return {
    symbol,
    reg,
    orbEnd,
    orbHigh,
    orbLow,
    open,
    gapPct,
    atr: atr(reg, 14),
    vwapSeries: vwap(reg),
    ema9: ema(closes, 9),
    ema20: ema(closes, 20),
    lastClose: reg[reg.length - 1].c,
  };
}

function longSetup(type, entry, stop, rr) {
  const risk = entry - stop;
  if (risk <= 0) return null;
  return { type, entry, stop, target: entry + rr * risk, rr };
}

// 1) Gap-and-go: only stocks gapping up on the open; enter on the break of the
//    opening-range high; stop under the range / an ATR; ride momentum.
function gapAndGo(session, cfg) {
  const s = cfg.strategies;
  if (session.atr == null || session.gapPct == null || session.gapPct < s.gapMin) return null;
  for (let i = 0; i < session.reg.length; i++) {
    const b = session.reg[i];
    if (b.m < session.orbEnd) continue;
    if (b.c > session.orbHigh) {
      const stop = Math.min(session.orbLow, b.c - s.stopAtrMult * session.atr);
      const setup = longSetup("Gap-and-go", b.c, stop, s.targetRR);
      if (setup) return { idx: i, setup };
    }
  }
  return null;
}

// 2) Opening-range breakout: same break, but any stock (no gap filter).
function orb(session, cfg) {
  const s = cfg.strategies;
  if (session.atr == null) return null;
  for (let i = 0; i < session.reg.length; i++) {
    const b = session.reg[i];
    if (b.m < session.orbEnd) continue;
    if (b.c > session.orbHigh) {
      const stop = Math.min(session.orbLow, b.c - s.stopAtrMult * session.atr);
      const setup = longSetup("ORB", b.c, stop, s.targetRR);
      if (setup) return { idx: i, setup };
    }
  }
  return null;
}

// 3) VWAP mean-reversion: price stretches ATRs below VWAP then prints a green
//    bar; fade it back toward VWAP. Stop below the dip.
function vwapReversion(session, cfg) {
  const s = cfg.strategies;
  if (session.atr == null) return null;
  for (let i = 1; i < session.reg.length; i++) {
    const b = session.reg[i];
    const v = session.vwapSeries[i];
    if (v == null) continue;
    if (b.l <= v - s.vwapDevAtr * session.atr && b.c > b.o) {
      const entry = b.c;
      const stop = b.l - 0.1 * session.atr;
      const target = Math.max(v, entry + 0.5 * session.atr); // back to VWAP
      const risk = entry - stop;
      if (risk <= 0) continue;
      return { idx: i, setup: { type: "VWAP reversion", entry, stop, target, rr: (target - entry) / risk } };
    }
  }
  return null;
}

// 4) Selective trend: the old VWAP/EMA idea, but only on gappers, only in the
//    first 90 minutes, only with all confirmations — tests whether the original
//    died from over-trading rather than from having no edge at all.
function selectiveTrend(session, cfg) {
  const s = cfg.strategies;
  if (session.atr == null || session.gapPct == null || session.gapPct < s.gapMin) return null;
  const winEnd = OPEN + s.selectiveWindowMin;
  for (let i = 0; i < session.reg.length; i++) {
    const b = session.reg[i];
    if (b.m >= winEnd) break;
    const v = session.vwapSeries[i];
    const e9 = session.ema9[i];
    const e20 = session.ema20[i];
    if (v == null || e9 == null || e20 == null) continue;
    if (b.c > v && e9 > e20 && b.c > b.o) {
      const stop = b.c - s.stopAtrMult * session.atr;
      const setup = longSetup("Selective trend", b.c, stop, s.targetRR);
      if (setup) return { idx: i, setup };
    }
  }
  return null;
}

export const STRATEGIES = {
  "Gap-and-go": gapAndGo,
  ORB: orb,
  "VWAP reversion": vwapReversion,
  "Selective trend": selectiveTrend,
};
