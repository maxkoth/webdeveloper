import { UNIVERSE, quoteSymbolFor } from "@/lib/research/universe";
import { computeFundamentals, type CompanyFacts, type Fundamentals } from "@/lib/research/edgar";
import { scoreStock, type Scored } from "@/lib/research/score";
import { quoteFor } from "@/lib/research/price";
import { readCache, type CacheEntry } from "@/lib/research/cache";

// Live screener. At request time it: (1) resolves tickers → CIK from SEC's map,
// (2) pulls each company's `companyfacts`, (3) extracts fundamentals, (4) fetches
// the live price, (5) screens + values. Heavy, so the response is edge-cached
// (fundamentals change quarterly; prices are refreshed by /api/quote on the
// curated page). Per-ticker failures degrade to a row with an error — the screen
// never 500s because one company's filing is weird.
//
// SEC requires a descriptive User-Agent; set EDGAR_USER_AGENT in the
// environment to your own "name email" or it falls back to a generic one.

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow time for many EDGAR pulls (Vercel Pro+)

const SEC_UA = process.env.EDGAR_USER_AGENT || "value-research-screener contact@example.com";
const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const CONCURRENCY = 5;
const PER_FETCH_TIMEOUT = 12_000;

type Row = {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  entityName: string | null;
  fiscalYear: number | null;
  span: string | null;
  fundamentals: Pick<
    Fundamentals,
    "revenue" | "netIncome" | "fcfLatest" | "fcfAvg3" | "netCash" | "dilutedShares" | "missing"
  > | null;
  scored: Scored | null;
  error?: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": SEC_UA, Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type TickerMap = Record<string, { cik_str: number; ticker: string; title: string }>;

async function resolveCikMap(): Promise<Map<string, string>> {
  const data = await fetchJson<TickerMap>(TICKER_MAP_URL);
  const map = new Map<string, string>();
  for (const row of Object.values(data)) {
    if (row?.ticker && row.cik_str != null) {
      map.set(row.ticker.toUpperCase(), String(row.cik_str).padStart(10, "0"));
    }
  }
  return map;
}

async function buildRow(
  entry: (typeof UNIVERSE)[number],
  cikMap: Map<string, string>,
): Promise<Row> {
  const base = { ticker: entry.ticker, name: entry.name, sector: entry.sector };
  try {
    const cik = cikMap.get(entry.ticker.toUpperCase());
    if (!cik) throw new Error("CIK not found");

    const [facts, quote] = await Promise.all([
      fetchJson<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`),
      quoteFor(quoteSymbolFor(entry.ticker), "1970-01-01"),
    ]);

    const f = computeFundamentals(facts);
    const scored = scoreStock(f, quote.price);
    return {
      ...base,
      price: quote.price,
      entityName: f.entityName,
      fiscalYear: f.fiscalYear,
      span: f.span,
      fundamentals: {
        revenue: f.revenue,
        netIncome: f.netIncome,
        fcfLatest: f.fcfLatest,
        fcfAvg3: f.fcfAvg3,
        netCash: f.netCash,
        dilutedShares: f.dilutedShares,
        missing: f.missing,
      },
      scored,
    };
  } catch (e) {
    return {
      ...base,
      price: null,
      entityName: null,
      fiscalYear: null,
      span: null,
      fundamentals: null,
      scored: null,
      error: e instanceof Error ? e.message : "failed",
    };
  }
}

/** Run tasks with a small concurrency cap (respects SEC's ≤10 rps limit). */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Reconstruct a screen Row from a cached fundamentals entry (scores on the fly,
 *  so the valuation logic can change without rebuilding the cache). */
function rowFromCache(e: CacheEntry): Row {
  const f = e.fundamentals;
  return {
    ticker: e.ticker,
    name: e.name,
    sector: e.sector,
    price: e.price,
    entityName: f.entityName,
    fiscalYear: f.fiscalYear,
    span: f.span,
    fundamentals: {
      revenue: f.revenue,
      netIncome: f.netIncome,
      fcfLatest: f.fcfLatest,
      fcfAvg3: f.fcfAvg3,
      netCash: f.netCash,
      dilutedShares: f.dilutedShares,
      missing: f.missing,
    },
    scored: scoreStock(f, e.price),
  };
}

export async function GET(req: Request) {
  // Prefer the offline whole-market cache (instant). Rank by margin of safety so
  // the cheapest names surface first, and return the top slice so the UI isn't
  // flooded with thousands of rows.
  const cache = await readCache();
  if (cache) {
    const params = new URL(req.url).searchParams;
    const limit = Math.min(Number(params.get("limit")) || 300, 3000);
    // Optional size filters so you can browse smaller, lesser-known names:
    //   ?maxPrice=20            share price ceiling
    //   ?maxCap=2e9&minCap=1e8  market-cap band (price × diluted shares), in $
    //   ?quality=1              only names that PASS the quality screen
    const maxPrice = Number(params.get("maxPrice")) || Infinity;
    const minCap = Number(params.get("minCap")) || 0;
    const maxCap = Number(params.get("maxCap")) || Infinity;
    const qualityOnly = params.get("quality") === "1";

    const rows = cache.entries
      .filter((e) => {
        if (e.price != null && e.price > maxPrice) return false;
        const shares = e.fundamentals?.dilutedShares;
        if (shares && e.price != null) {
          const cap = e.price * shares;
          if (cap < minCap || cap > maxCap) return false;
        }
        return true;
      })
      .map(rowFromCache)
      .filter((r) => !qualityOnly || r.scored?.verdict === "pass")
      .sort(
        (a, b) =>
          (b.scored?.marginOfSafety ?? -Infinity) - (a.scored?.marginOfSafety ?? -Infinity),
      )
      .slice(0, limit);
    return Response.json(
      { asOf: cache.asOf, count: cache.entries.length, rows },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } },
    );
  }

  // No cache → live fallback over the small curated universe (original path).
  let cikMap: Map<string, string>;
  try {
    cikMap = await resolveCikMap();
  } catch (e) {
    return Response.json(
      {
        error: "Could not reach SEC EDGAR. This works where outbound network is open (your machine / Vercel), not in restricted sandboxes.",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 },
    );
  }

  const rows = await pool(UNIVERSE, CONCURRENCY, (entry) => buildRow(entry, cikMap));

  return Response.json(
    { asOf: new Date().toISOString(), count: rows.length, rows },
    {
      headers: {
        // Fundamentals change quarterly; cache the heavy work for 30 min.
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    },
  );
}
