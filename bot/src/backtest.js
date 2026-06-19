// Backtester. Replays historical intraday bars through the SAME signal engine
// the live scanner uses, simulates each setup to its stop or target, and reports
// the stats that actually matter: win rate, expectancy (avg R), profit factor.
//
// This is the honesty check. If the numbers here are bad, the live bot will lose
// money — no amount of "it'll catch the next one" changes that. Pure + testable.

import { detectSetups } from "./signals.js";

/**
 * Simulate a long trade forward from the bar AFTER entry.
 * @returns {{outcome:"win"|"loss"|"timeout", r:number}}  r in risk multiples.
 */
export function evaluateTrade(setup, futureBars, maxHoldBars) {
  const risk = setup.entry - setup.stop;
  if (risk <= 0) return { outcome: "loss", r: 0 };
  const horizon = futureBars.slice(0, maxHoldBars);
  for (const b of horizon) {
    const hitStop = b.l <= setup.stop;
    const hitTarget = b.h >= setup.target;
    // If a bar spans both, assume the stop filled first (conservative).
    if (hitStop) return { outcome: "loss", r: -1 };
    if (hitTarget) return { outcome: "win", r: setup.rr };
  }
  // Neither hit within the horizon: mark to the last close.
  const last = horizon[horizon.length - 1];
  if (!last) return { outcome: "timeout", r: 0 };
  return { outcome: "timeout", r: (last.c - setup.entry) / risk };
}

/** Replay one session's bars: at each bar, run the engine on history-to-date;
 *  the first time each setup type fires that day, take the trade and score it. */
export function backtestBars(symbol, bars, cfg) {
  const trades = [];
  const takenTypes = new Set();
  for (let i = cfg.signals.minBars - 1; i < bars.length - 1; i++) {
    const window = bars.slice(0, i + 1);
    const setups = detectSetups({ symbol, bars: window }, cfg.signals);
    for (const s of setups) {
      if (takenTypes.has(s.type)) continue;
      takenTypes.add(s.type);
      const result = evaluateTrade(s, bars.slice(i + 1), cfg.backtest.maxHoldBars);
      trades.push({ ...s, ...result, atBar: i });
    }
  }
  return trades;
}

/** Aggregate trade results into a performance summary. */
export function summarize(trades) {
  const wins = trades.filter((t) => t.r > 0);
  const losses = trades.filter((t) => t.r < 0);
  const grossWin = wins.reduce((s, t) => s + t.r, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.r, 0));
  const totalR = trades.reduce((s, t) => s + t.r, 0);
  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length ? wins.length / trades.length : 0,
    expectancyR: trades.length ? totalR / trades.length : 0, // avg R per trade
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    totalR,
  };
}

/** Per-setup-type breakdown, so you can see which rules carry their weight. */
export function summarizeByType(trades) {
  const byType = {};
  for (const t of trades) (byType[t.type] ||= []).push(t);
  return Object.fromEntries(Object.entries(byType).map(([k, ts]) => [k, summarize(ts)]));
}
