// Thin Polygon.io client (uses global fetch; Node 18+). One snapshot call gives
// the whole US market; per-candidate aggregate calls give intraday bars.

const BASE = "https://api.polygon.io";

async function get(path, apiKey, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("apiKey", apiKey);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Polygon ${res.status} ${path}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** { market: "open"|"closed"|"extended-hours", ... } */
export async function getMarketStatus(apiKey) {
  return get("/v1/marketstatus/now", apiKey);
}

/** Full-market snapshot: one call returns every active US ticker with day stats,
 *  last minute bar, and previous day — enough to prefilter the whole universe. */
export async function getFullSnapshot(apiKey) {
  const data = await get("/v2/snapshot/locale/us/markets/stocks/tickers", apiKey);
  return data.tickers || [];
}

/** Intraday 1-minute bars for one ticker between epoch-ms `from` and `to`. */
export async function getIntradayBars(apiKey, ticker, fromMs, toMs) {
  const data = await get(
    `/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/minute/${fromMs}/${toMs}`,
    apiKey,
    { adjusted: "true", sort: "asc", limit: 50000 },
  );
  return (data.results || []).map((r) => ({ t: r.t, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v }));
}

/** Normalize a snapshot ticker into the fields the prefilter needs. */
export function readSnapshot(t) {
  const price = t.min?.c ?? t.day?.c ?? t.lastTrade?.p ?? t.prevDay?.c ?? null;
  const dayVol = t.day?.v ?? 0;
  const prevVol = t.prevDay?.v ?? 0;
  return {
    ticker: t.ticker,
    price,
    dayVolume: dayVol,
    prevVolume: prevVol,
    changePct: t.todaysChangePerc ?? null,
  };
}
