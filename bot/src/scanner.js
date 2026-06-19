// One scan pass: get candidate tickers from the provider → prefilter → fetch
// intraday bars for each → run the rule engine → de-dup → alert. The provider
// is injected so orchestration is testable without any network.

import { detectSetups } from "./signals.js";
import { sessionStartMs, sessionFraction } from "./clock.js";

/** Prefilter normalized rows down to names worth a bar-fetch. Null fields are
 *  NOT filtered on, so this works for both a full snapshot (Polygon) and a
 *  movers screener (Alpaca, which lacks prior-day volume). */
export function prefilter(rows, cfg, frac) {
  const u = cfg.universe;
  const out = [];
  for (const s of rows) {
    if (s.price == null || s.price < u.minPrice || s.price > u.maxPrice) continue;
    if (s.dayVolume != null && s.dayVolume < u.minDayVolume) continue;
    if (s.changePct != null && Math.abs(s.changePct) < u.minAbsChangePct) continue;
    const expected = (s.prevVolume || 0) * frac;
    const relVol = expected > 0 ? s.dayVolume / expected : null;
    if (relVol != null && relVol < u.minRelVolume) continue;
    out.push({ ...s, relVol });
  }
  out.sort(
    (a, b) =>
      Math.abs(b.changePct ?? 0) * (b.relVol ?? 1) - Math.abs(a.changePct ?? 0) * (a.relVol ?? 1),
  );
  return out.slice(0, u.maxCandidates);
}

export async function runScan(cfg, deps) {
  const { provider, notifier, state, log = console.log } = deps;
  const frac = sessionFraction(cfg);
  const fromMs = sessionStartMs(cfg);
  const toMs = Date.now();

  const rows = await provider.getRawTickers(cfg);
  const candidates = prefilter(rows, cfg, frac);
  log(`scan[${provider.name}]: ${rows.length} tickers → ${candidates.length} candidates`);

  const found = [];
  for (const c of candidates) {
    let bars;
    try {
      bars = await provider.getBars(cfg, c.ticker, fromMs, toMs);
    } catch (e) {
      log(`  ${c.ticker}: bars failed (${e.message})`);
      continue;
    }
    const setups = detectSetups({ symbol: c.ticker, bars }, cfg.signals);
    for (const s of setups) {
      s.meta.changePct = c.changePct != null ? round(c.changePct, 1) : null;
      s.meta.relVol = c.relVol != null ? round(c.relVol, 1) : null;
      found.push(s);
    }
  }

  found.sort((a, b) => (b.meta.volSurge || 0) - (a.meta.volSurge || 0));
  let alerted = 0;
  for (const s of found.slice(0, cfg.alerts.maxPerScan)) {
    if (!state.allow(s)) continue;
    await notifier.send(s);
    state.mark(s);
    alerted++;
  }

  log(`scan: ${found.length} setups, ${alerted} alerted`);
  return { scanned: rows.length, candidates: candidates.length, setups: found.length, alerted };
}

function round(x, dp = 2) {
  const m = 10 ** dp;
  return Math.round(x * m) / m;
}
