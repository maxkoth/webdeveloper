// Backtester. Replays historical intraday bars through the SAME signal engine
// the live scanner uses, simulates each setup to its stop or target, and reports
// the stats that actually matter: win rate, expectancy (avg R), profit factor.
//
// This is the honesty check. If the numbers here are bad, the live bot will lose
// money — no amount of "it'll catch the next one" changes that. Pure + testable.

import { detectSetups } from "./signals.js";

/**
 * Simulate a long trade to its stop or target, with realistic frictions.
 * @param trade  {entry, stop, target}  entry is the ACTUAL fill price.
 * @param futureBars  bars from the entry bar onward (entry bar can trigger).
 * @param opts  {maxHoldBars, slippageBps}  slippage haircuts every fill.
 * @returns {{outcome:"win"|"loss"|"timeout", r:number}}  r in risk multiples.
 */
export function evaluateTrade(trade, futureBars, opts) {
  const { maxHoldBars, slippageBps = 0 } = opts;
  const slip = slippageBps / 10000;
  const risk = trade.entry - trade.stop;
  if (risk <= 0) return { outcome: "loss", r: 0 };
  const horizon = futureBars.slice(0, maxHoldBars);
  for (const b of horizon) {
    // If a bar spans both stop and target, assume the stop filled first.
    if (b.l <= trade.stop) {
      const exit = trade.stop * (1 - slip); // sell into slippage
      return { outcome: "loss", r: (exit - trade.entry) / risk };
    }
    if (b.h >= trade.target) {
      const exit = trade.target * (1 - slip);
      return { outcome: "win", r: (exit - trade.entry) / risk };
    }
  }
  const last = horizon[horizon.length - 1];
  if (!last) return { outcome: "timeout", r: 0 };
  const exit = last.c * (1 - slip);
  return { outcome: "timeout", r: (exit - trade.entry) / risk };
}

/** Replay one session's bars: at each bar, run the engine on history-to-date;
 *  the first time each setup type fires that day, take the trade and score it.
 *  Entry is the NEXT bar's open (you can't fill at the signal-bar close) plus a
 *  slippage haircut — the realism that decides whether a thin edge survives. */
export function backtestBars(symbol, bars, cfg) {
  const trades = [];
  const takenTypes = new Set();
  const slip = (cfg.backtest.slippageBps || 0) / 10000;
  for (let i = cfg.signals.minBars - 1; i < bars.length - 1; i++) {
    const window = bars.slice(0, i + 1);
    const setups = detectSetups({ symbol, bars: window }, cfg.signals);
    for (const s of setups) {
      if (takenTypes.has(s.type)) continue;
      takenTypes.add(s.type);
      const next = bars[i + 1];
      // Fill at next bar's open (signalClose mode keeps the optimistic old model).
      const fillBase = cfg.backtest.entryMode === "signalClose" ? s.entry : next.o;
      const entry = fillBase * (1 + slip); // buy into slippage
      const trade = { entry, stop: s.stop, target: s.target };
      const result = evaluateTrade(trade, bars.slice(i + 1), {
        maxHoldBars: cfg.backtest.maxHoldBars,
        slippageBps: cfg.backtest.slippageBps,
      });
      trades.push({ ...s, entryFill: round(entry), ...result, atBar: i });
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

function round(x, dp = 2) {
  const m = 10 ** dp;
  return Math.round(x * m) / m;
}
