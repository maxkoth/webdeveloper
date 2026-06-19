// The rule engine: turn a symbol's intraday bars into zero or more setups, each
// with a concrete entry / stop / target. Pure and testable.
//
// IMPORTANT: these rules are a STARTING POINT, not a proven edge. They will fire
// often; most fires will not be good trades. Paper-test and tune before trusting
// them. Long-only for v1 (simpler, and avoids shorting mechanics).

import {
  ema,
  vwap,
  atr,
  volumeSurge,
  isBullishEngulfing,
  isHammer,
  crossedAbove,
} from "./indicators.js";

/**
 * @param {{symbol:string, bars:Array, changePct?:number, relVolume?:number}} input
 * @param {object} cfg  config.signals
 * @returns {Array<{symbol,type,entry,stop,target,rr,reason,meta}>}
 */
export function detectSetups(input, cfg) {
  const { symbol, bars } = input;
  if (!bars || bars.length < cfg.minBars) return [];

  const closes = bars.map((b) => b.c);
  const last = bars[bars.length - 1];
  const price = last.c;

  const vwapSeries = vwap(bars);
  const emaFast = ema(closes, cfg.emaFast);
  const emaSlow = ema(closes, cfg.emaSlow);
  const a = atr(bars, cfg.atrPeriod);
  const surge = volumeSurge(bars, 20);

  if (a == null || !isFinite(a) || a <= 0) return [];

  const i = bars.length - 1;
  const vwapNow = vwapSeries[i];
  const aboveVwap = vwapNow != null && price >= vwapNow;
  const hasVolume = surge != null && surge >= cfg.volumeSurgeMult;

  // Build entry/stop/target from the ATR risk model (long-only).
  const mkTrade = (type, reason, meta = {}) => {
    const entry = price;
    const stop = entry - cfg.stopAtrMult * a;
    const risk = entry - stop;
    if (risk <= 0) return null;
    const target = entry + cfg.targetRR * risk;
    return {
      symbol,
      type,
      entry: round(entry),
      stop: round(stop),
      target: round(target),
      rr: cfg.targetRR,
      reason,
      meta: { ...meta, atr: round(a), volSurge: surge ? round(surge, 2) : null },
    };
  };

  const setups = [];

  // 1) VWAP reclaim: close crosses back above session VWAP, with volume.
  if (crossedAbove(closes, vwapSeries) && hasVolume) {
    const t = mkTrade("VWAP reclaim", "Close reclaimed VWAP on volume");
    if (t) setups.push(t);
  }

  // 2) EMA cross + volume: fast EMA crosses above slow EMA, above VWAP, volume.
  if (
    emaFast[i] != null &&
    emaSlow[i] != null &&
    emaFast[i - 1] != null &&
    emaSlow[i - 1] != null &&
    emaFast[i - 1] <= emaSlow[i - 1] &&
    emaFast[i] > emaSlow[i] &&
    aboveVwap &&
    hasVolume
  ) {
    const t = mkTrade("EMA cross + volume", `EMA${cfg.emaFast}>EMA${cfg.emaSlow}, above VWAP, volume`);
    if (t) setups.push(t);
  }

  // 3) Candlestick reversal above VWAP with volume.
  if (aboveVwap && hasVolume && (isBullishEngulfing(bars) || isHammer(bars))) {
    const pattern = isBullishEngulfing(bars) ? "Bullish engulfing" : "Hammer";
    const t = mkTrade("Candlestick", `${pattern} above VWAP on volume`);
    if (t) setups.push(t);
  }

  return setups;
}

function round(x, dp = 2) {
  const m = 10 ** dp;
  return Math.round(x * m) / m;
}
