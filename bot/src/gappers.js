// Detect the day's gappers from daily bars. Pure + testable. A "gap" is today's
// open vs the prior session's close.

/** Flatten Map<symbol, dailyBars[]> into per-symbol-per-day gap rows. */
export function gapRows(dailyBySymbol) {
  const rows = [];
  for (const [symbol, bars] of dailyBySymbol) {
    const sorted = [...bars].sort((a, b) => a.t - b.t);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (!(prev.c > 0)) continue;
      rows.push({
        t: cur.t,
        symbol,
        gapPct: (cur.o - prev.c) / prev.c,
        prevClose: prev.c,
        open: cur.o,
        volume: cur.v,
      });
    }
  }
  return rows;
}

/** Group gap rows by day and keep the top-K gappers per day above thresholds.
 *  `dateOf(t)` maps an epoch ms to a day key (injected so it's testable without
 *  timezone machinery). */
export function topByDay(rows, cfg, dateOf) {
  const g = cfg.strategies;
  const byDate = new Map();
  for (const r of rows) {
    if (r.gapPct < g.gapMin) continue; // gappers only
    if (r.open < 1.5) continue; // skip sub-$1.50
    if (r.volume < 300_000) continue; // liquidity floor
    const date = dateOf(r.t);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(r);
  }
  for (const [date, list] of byDate) {
    list.sort((a, b) => b.gapPct - a.gapPct);
    byDate.set(date, list.slice(0, cfg.gapTopK || 15));
  }
  return byDate;
}
