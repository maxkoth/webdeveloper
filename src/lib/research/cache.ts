// Reads the fundamentals cache built offline by scripts/build-cache.ts. The
// screener route prefers this cache (instant, whole-market) and falls back to
// the live per-request path only when no cache exists.
//
// The cache is generated data — it is NOT committed (see .gitignore). Build it
// on the machine that runs the app: `npm run build:cache`.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Fundamentals } from "./edgar";

export type CacheEntry = {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  priceAsOf: string | null;
  /** SEC Standard Industrial Classification code + description (for filtering
   *  out company types a free-cash-flow DCF can't value). */
  sic?: string;
  sicDescription?: string;
  fundamentals: Fundamentals;
};

export type FundamentalsCache = { asOf: string; count: number; entries: CacheEntry[] };

/** True for businesses a free-cash-flow DCF should NOT be applied to — the model
 *  produces fake "bargains" for these, so they're excluded from the screen:
 *   • SIC 6000–6799: banks, brokers, insurers, real estate / REITs, holding &
 *     investment companies (their cash flows aren't "free cash flow").
 *   • MLPs / limited partnerships (different accounting entirely). */
export function isModelInvalid(entry: { sic?: string; name?: string }): boolean {
  const n = Number(entry.sic);
  if (Number.isFinite(n) && n >= 6000 && n <= 6799) return true;
  if (/\bL\.?P\.?\b|\bPARTNERS\b/i.test(entry.name || "")) return true;
  return false;
}

export const CACHE_PATH = path.join(process.cwd(), "data", "fundamentals.json");

export async function readCache(): Promise<FundamentalsCache | null> {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as FundamentalsCache;
    return parsed.entries?.length ? parsed : null;
  } catch {
    return null; // no cache yet → route uses the live fallback
  }
}
