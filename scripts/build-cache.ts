// Offline batch: build the whole-market fundamentals cache the screener reads.
//
//   npm run build:cache              # default cap (CACHE_MAX), good first run
//   CACHE_MAX=0 npm run build:cache  # the ENTIRE market (~8k filers, slow)
//
// Config via a root .env (auto-loaded) or inline env vars:
//   EDGAR_USER_AGENT="Your Name you@email"   # SEC asks for this
//   ALPACA_KEY_ID / ALPACA_SECRET_KEY        # bulk prices (free tier is fine)
//   ALPACA_FEED=iex                          # iex (free) | sip (paid)
//
// Why a batch and not live: screening thousands of companies means thousands of
// multi-hundred-KB SEC filings. Doing that per page load is impossible (SEC caps
// ~10 req/s). So we pull it ONCE here, compute fundamentals, attach a price, and
// write data/fundamentals.json. Re-runs are fast (filings cached 7 days). Prices
// come from Alpaca in bulk when keys are present (fast, reliable); otherwise we
// fall back to per-ticker Stooq (slow). Run nightly.

import { promises as fs } from "node:fs";
import path from "node:path";
import { computeFundamentals, type CompanyFacts } from "../src/lib/research/edgar";
import { quoteFor } from "../src/lib/research/price";
import { UNIVERSE } from "../src/lib/research/universe";
import type { CacheEntry } from "../src/lib/research/cache";

try {
  process.loadEnvFile(); // load a root .env if present (Node ≥20.12)
} catch {
  /* no .env — rely on inline env vars */
}

const SEC_UA = process.env.EDGAR_USER_AGENT || "value-research-screener contact@example.com";
const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const CACHE_MAX = process.env.CACHE_MAX != null ? Number(process.env.CACHE_MAX) : 1500;
const ALPACA = {
  keyId: process.env.ALPACA_KEY_ID || "",
  secret: process.env.ALPACA_SECRET_KEY || "",
  feed: process.env.ALPACA_FEED || "iex",
};
const RPS = 8; // stay under SEC's ~10 req/s limit
const DELAY = Math.ceil(1000 / RPS);
const FILINGS_DIR = path.join(process.cwd(), ".cache", "edgar");
const OUT = path.join(process.cwd(), "data", "fundamentals.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sectorOf = new Map(UNIVERSE.map((u) => [u.ticker.toUpperCase(), u.sector]));

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const SEC_HEADERS = { "User-Agent": SEC_UA, Accept: "application/json", "Accept-Encoding": "gzip, deflate" };

/** companyfacts for a CIK, cached on disk for 7 days (re-runs are cheap and
 *  resumable). Only sleeps for the SEC rate limit when it actually fetches. */
async function companyFacts(cik: string): Promise<CompanyFacts> {
  const file = path.join(FILINGS_DIR, `CIK${cik}.json`);
  try {
    const st = await fs.stat(file);
    if (Date.now() - st.mtimeMs < 7 * 864e5) return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    /* not cached yet */
  }
  const data = await getJson<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, SEC_HEADERS);
  await fs.mkdir(FILINGS_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));
  await sleep(DELAY);
  return data;
}

/** SEC industry classification (SIC) for a CIK, to exclude company types a
 *  free-cash-flow DCF can't value. Uses a small Range request — sic sits at the
 *  top of the submissions JSON — so we don't pull the whole filing history.
 *  Cached on disk for 7 days. */
async function companySic(cik: string): Promise<{ sic: string; sicDescription: string }> {
  const file = path.join(FILINGS_DIR, `SIC${cik}.json`);
  try {
    const st = await fs.stat(file);
    if (Date.now() - st.mtimeMs < 7 * 864e5) return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    /* not cached yet */
  }
  const res = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
    headers: { ...SEC_HEADERS, Range: "bytes=0-3000" },
  });
  const text = await res.text();
  const slim = {
    sic: text.match(/"sic"\s*:\s*"?(\d+)"?/)?.[1] ?? "",
    sicDescription: text.match(/"sicDescription"\s*:\s*"([^"]*)"/)?.[1] ?? "",
  };
  await fs.mkdir(FILINGS_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(slim));
  await sleep(DELAY);
  return slim;
}

type Snap = { latestTrade?: { p?: number }; dailyBar?: { c?: number; t?: string }; prevDailyBar?: { c?: number } };

/** Bulk daily prices from Alpaca (100 symbols/call). Daily close is all a
 *  long-term value screen needs, so the free IEX feed is plenty. */
async function alpacaPrices(symbols: string[]): Promise<Map<string, { price: number; asOf: string | null }>> {
  const out = new Map<string, { price: number; asOf: string | null }>();
  const headers = { "APCA-API-KEY-ID": ALPACA.keyId, "APCA-API-SECRET-KEY": ALPACA.secret, Accept: "application/json" };
  const CHUNK = 100;
  for (let i = 0; i < symbols.length; i += CHUNK) {
    const batch = symbols.slice(i, i + CHUNK);
    const url = `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${batch.join(",")}&feed=${ALPACA.feed}`;
    try {
      const raw = (await getJson<Record<string, unknown>>(url, headers)) as Record<string, unknown>;
      const snaps = (raw.snapshots ?? raw) as Record<string, Snap>;
      for (const [sym, s] of Object.entries(snaps)) {
        const price = s?.latestTrade?.p ?? s?.dailyBar?.c ?? s?.prevDailyBar?.c;
        if (price != null && isFinite(price)) out.set(sym, { price, asOf: s?.dailyBar?.t?.slice(0, 10) ?? null });
      }
    } catch {
      /* skip a bad batch */
    }
    await sleep(150);
  }
  return out;
}

type TickerMap = Record<string, { cik_str: number; ticker: string; title: string }>;

async function main() {
  console.log("Fetching SEC ticker map…");
  const map = await getJson<TickerMap>(TICKER_MAP_URL, SEC_HEADERS);

  // De-dupe by CIK keeping the SHORTEST ticker, which drops preferred shares and
  // duplicate share classes (e.g. ZIONP under ZION, GOOG under GOOGL) — those
  // share a company's filings but trade at a different price, creating junk.
  const byCik = new Map<string, { ticker: string; name: string; cik: string }>();
  for (const r of Object.values(map)) {
    if (!r?.ticker || !/^[A-Z]+$/.test(r.ticker)) continue; // common shares only
    const row = { ticker: r.ticker.toUpperCase(), name: r.title, cik: String(r.cik_str).padStart(10, "0") };
    const ex = byCik.get(row.cik);
    if (!ex || row.ticker.length < ex.ticker.length) byCik.set(row.cik, row);
  }
  let list = [...byCik.values()];
  if (CACHE_MAX > 0) list = list.slice(0, CACHE_MAX);
  console.log(`Universe: ${list.length} companies (CACHE_MAX=${CACHE_MAX || "all"})`);

  // 1) Fundamentals from SEC (the slow part).
  const partial: Omit<CacheEntry, "price" | "priceAsOf">[] = [];
  let done = 0,
    ok = 0,
    failed = 0;
  for (const c of list) {
    done++;
    try {
      const facts = await companyFacts(c.cik);
      let sic = "",
        sicDescription = "";
      try {
        ({ sic, sicDescription } = await companySic(c.cik));
      } catch {
        /* sic is best-effort */
      }
      partial.push({
        ticker: c.ticker,
        name: c.name,
        sector: sectorOf.get(c.ticker) ?? "Unknown",
        sic,
        sicDescription,
        fundamentals: computeFundamentals(facts),
      });
      ok++;
    } catch {
      failed++;
    }
    if (done % 50 === 0 || done === list.length) console.log(`  fundamentals ${done}/${list.length}  ok=${ok} failed=${failed}`);
  }

  // 2) Prices in bulk (Alpaca if configured, else per-ticker Stooq fallback).
  console.log(ALPACA.keyId ? `Fetching prices from Alpaca (${ALPACA.feed})…` : "Fetching prices from Stooq (slow — set ALPACA keys for bulk)…");
  const priceMap = ALPACA.keyId ? await alpacaPrices(partial.map((p) => p.ticker)) : new Map();
  const entries: CacheEntry[] = [];
  for (const p of partial) {
    let price: number | null = priceMap.get(p.ticker)?.price ?? null;
    let priceAsOf: string | null = priceMap.get(p.ticker)?.asOf ?? null;
    if (price == null && !ALPACA.keyId) {
      const q = await quoteFor(`${p.ticker}.US`, "1970-01-01");
      price = q.price;
      priceAsOf = q.asOf;
    }
    entries.push({ ...p, price, priceAsOf });
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({ asOf: new Date().toISOString(), count: entries.length, entries }));
  const priced = entries.filter((e) => e.price != null).length;
  console.log(`\nWrote ${entries.length} entries (${priced} priced) → ${OUT}`);
  console.log("The screener will now read this cache. Re-run nightly to refresh.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
