// Long-term value BUY alerts. Reuses the value screener (the site's /api/screen,
// backed by the SEC-fundamentals cache + conservative DCF). A "buy" = a business
// that PASSES the quality screen AND trades at/below its margin-of-safety price.
//
// This is the analysis you asked me to "decide": the screen picks WHAT (quality
// businesses) and AT WHAT PRICE (the buy-below line). But it's a model-flagged
// research candidate, NOT personalized advice and NOT a guarantee — cheap can
// stay cheap, and you should read the filing before buying. Requires the website
// running (npm run dev) so /api/screen is reachable.

export async function getValueBargains(cfg) {
  const url = `${cfg.value.screenUrl}?limit=3000`;
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error(`can't reach the screener — is the website running? (npm run dev → ${cfg.value.screenUrl})`);
  }
  if (!res.ok) {
    throw new Error(`screen ${res.status} — is the website running? (${cfg.value.screenUrl})`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);

  const watch = cfg.value.watchlist || [];
  const out = [];
  for (const r of data.rows || []) {
    const s = r.scored;
    if (!s) continue;
    if (watch.length) {
      // Watchlist mode: only YOUR names; alert when one hits its buy-below price.
      if (!watch.includes(r.ticker)) continue;
      if (s.status !== "bargain") continue;
    } else {
      // Discovery mode: quality businesses trading at/below their buy price.
      if (s.verdict !== "pass") continue;
      if (!cfg.value.statuses.includes(s.status)) continue;
    }
    out.push({
      symbol: r.ticker,
      type: "value", // for de-dup keying
      kind: "LONG-TERM BUY",
      name: r.name,
      price: r.price,
      buyBelow: s.bargainPrice,
      fair: s.fairPrice,
      mos: s.marginOfSafety,
    });
  }
  out.sort((a, b) => (b.mos ?? -Infinity) - (a.mos ?? -Infinity)); // deepest discount first
  return out;
}

export async function runValueScan(cfg, { notifier, valueState, log = console.log }) {
  let bargains;
  try {
    bargains = await getValueBargains(cfg);
  } catch (e) {
    log(`value: ${e.message}`);
    return { found: 0, alerted: 0 };
  }
  log(`value: ${bargains.length} quality name(s) at/below buy price`);

  let alerted = 0;
  for (const b of bargains.slice(0, cfg.value.maxPerRun)) {
    if (!valueState.allow(b)) continue; // don't re-text the same name within cooldown
    await notifier.send(b);
    valueState.mark(b);
    alerted++;
  }
  log(`value: ${alerted} alerted`);
  return { found: bargains.length, alerted };
}
