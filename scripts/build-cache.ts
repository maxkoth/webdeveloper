// Offline batch: build the whole-market fundamentals cache the screener reads.
//
//   npm run build:cache              # default cap (CACHE_MAX), good first run
//   CACHE_MAX=0 npm run build:cache  # the ENTIRE market (~8k filers, slow)
//   EDGAR_USER_AGENT="Name email" npm run build:cache   # SEC asks for this
//
// Why a batch and not live: screening thousands of companies means thousands of
// multi-hundred-KB SEC filings. Doing that per page load is impossible (SEC caps
// ~10 req/s and it would take many minutes). So we pull it ONCE here, compute
// fundamentals + a price for each, and write data/fundamentals.json. Re-runs are
// fast because raw filings are cached on disk for 7 days. Run it nightly.

import { promises as fs } from "node:fs";
import path from "node:path";
import { computeFundamentals, type CompanyFacts } from "../src/lib/research/edgar";
import { quoteFor } from "../src/lib/research/price";
import { UNIVERSE } from "../src/lib/research/universe";
import type { CacheEntry } from "../src/lib/research/cache";

const SEC_UA = process.env.EDGAR_USER_AGENT || "value-research-screener contact@example.com";
const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const CACHE_MAX = process.env.CACHE_MAX != null ? Number(process.env.CACHE_MAX) : 1500;
const RPS = 8; // stay under SEC's ~10 req/s limit
const DELAY = Math.ceil(1000 / RPS);
const FILINGS_DIR = path.join(process.cwd(), ".cache", "edgar");
const OUT = path.join(process.cwd(), "data", "fundamentals.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sectorOf = new Map(UNIVERSE.map((u) => [u.ticker.toUpperCase(), u.sector]));

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": SEC_UA, Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** companyfacts for a CIK, cached on disk for 7 days (so re-runs are cheap and
 *  resumable). Only sleeps for the SEC rate limit when it actually fetches. */
async function companyFacts(cik: string): Promise<CompanyFacts> {
  const file = path.join(FILINGS_DIR, `CIK${cik}.json`);
  try {
    const st = await fs.stat(file);
    if (Date.now() - st.mtimeMs < 7 * 864e5) return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    /* not cached yet */
  }
  const data = await getJson<CompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
  await fs.mkdir(FILINGS_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));
  await sleep(DELAY);
  return data;
}

type TickerMap = Record<string, { cik_str: number; ticker: string; title: string }>;

async function main() {
  console.log("Fetching SEC ticker map…");
  const map = await getJson<TickerMap>(TICKER_MAP_URL);

  const seen = new Set<string>();
  let list = Object.values(map)
    .filter((r) => r?.ticker && /^[A-Z]+$/.test(r.ticker)) // common shares only (skip units/warrants/dots)
    .map((r) => ({ ticker: r.ticker.toUpperCase(), name: r.title, cik: String(r.cik_str).padStart(10, "0") }))
    .filter((r) => (seen.has(r.ticker) ? false : (seen.add(r.ticker), true)));
  if (CACHE_MAX > 0) list = list.slice(0, CACHE_MAX);
  console.log(`Universe: ${list.length} tickers (CACHE_MAX=${CACHE_MAX || "all"})`);

  const entries: CacheEntry[] = [];
  let done = 0,
    ok = 0,
    failed = 0;
  for (const c of list) {
    done++;
    try {
      const facts = await companyFacts(c.cik);
      const fundamentals = computeFundamentals(facts);
      const quote = await quoteFor(`${c.ticker}.US`, "1970-01-01");
      entries.push({
        ticker: c.ticker,
        name: c.name,
        sector: sectorOf.get(c.ticker) ?? "Unknown",
        price: quote.price,
        priceAsOf: quote.asOf,
        fundamentals,
      });
      ok++;
    } catch {
      failed++;
    }
    if (done % 50 === 0 || done === list.length) {
      console.log(`  ${done}/${list.length}  ok=${ok} failed=${failed}`);
    }
  }

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify({ asOf: new Date().toISOString(), count: entries.length, entries }));
  console.log(`\nWrote ${entries.length} entries → ${OUT}`);
  console.log("The screener will now read this cache. Re-run nightly to refresh.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
