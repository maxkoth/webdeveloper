// One scan pass: snapshot the whole market → prefilter to candidates → fetch
// intraday bars for each → run the rule engine → de-dup → alert. Network calls
// are injected (`deps`) so the orchestration can be tested without Polygon.

import { readSnapshot } from "./polygon.js";
import { detectSetups } from "./signals.js";
import { sessionStartMs, sessionFraction } from "./clock.js";

/** Prefilter the full snapshot down to names worth a bar-fetch. */
export function prefilter(tickers, cfg, frac) {
  const u = cfg.universe;
  const out = [];
  for (const raw of tickers) {
    const s = readSnapshot(raw);
    if (s.price == null || s.price < u.minPrice || s.price > u.maxPrice) continue;
    if (s.dayVolume < u.minDayVolume) continue;
    if (s.changePct == null || Math.abs(s.changePct) < u.minAbsChangePct) continue;
    // Relative volume: today's pace vs prior day, scaled by session elapsed.
    const expected = s.prevVolume * frac;
    const relVol = expected > 0 ? s.dayVolume / expected : 0;
    if (relVol < u.minRelVolume) continue;
    out.push({ ...s, relVol });
  }
  // Rank by momentum × unusual volume; keep the strongest.
  out.sort((a, b) => Math.abs(b.changePct) * b.relVol - Math.abs(a.changePct) * a.relVol);
  return out.slice(0, u.maxCandidates);
}

export async function runScan(cfg, deps) {
  const { getFullSnapshot, getIntradayBars, notifier, state, log = console.log } = deps;
  const frac = sessionFraction(cfg);
  const fromMs = sessionStartMs(cfg);
  const toMs = Date.now();

  const tickers = await getFullSnapshot(cfg.polygon.apiKey);
  const candidates = prefilter(tickers, cfg, frac);
  log(`scan: ${tickers.length} tickers → ${candidates.length} candidates`);

  const found = [];
  for (const c of candidates) {
    let bars;
    try {
      bars = await getIntradayBars(cfg.polygon.apiKey, c.ticker, fromMs, toMs);
    } catch (e) {
      log(`  ${c.ticker}: bars failed (${e.message})`);
      continue;
    }
    const setups = detectSetups({ symbol: c.ticker, bars }, cfg.signals);
    for (const s of setups) {
      s.meta.changePct = c.changePct != null ? round(c.changePct, 1) : null;
      s.meta.relVol = round(c.relVol, 1);
      found.push(s);
    }
  }

  // Strongest first, cap per scan, then de-dup against cooldown.
  found.sort((a, b) => (b.meta.volSurge || 0) - (a.meta.volSurge || 0));
  let alerted = 0;
  for (const s of found.slice(0, cfg.alerts.maxPerScan)) {
    if (!state.allow(s)) continue;
    await notifier.send(s);
    state.mark(s);
    alerted++;
  }

  log(`scan: ${found.length} setups, ${alerted} alerted`);
  return { scanned: tickers.length, candidates: candidates.length, setups: found.length, alerted };
}

function round(x, dp = 2) {
  const m = 10 ** dp;
  return Math.round(x * m) / m;
}
