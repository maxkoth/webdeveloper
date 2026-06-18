import { NextRequest } from "next/server";

// Live quote route. This is the ONLY genuinely real-time piece of the research
// page: it fetches current and baseline prices at REQUEST time so margin of
// safety and return-since-analysis are computed against a live market price,
// while the valuation itself stays static (it's a considered judgment, not a
// ticker). Route Handlers are uncached by default in this Next version; we add
// a short s-maxage so we don't hammer the upstream on every page view.
//
// Sources, in order: Stooq (key-free daily CSV — gives BOTH the latest close
// and the historical baseline close in one request) with a Yahoo fallback for
// the latest price only. Everything is wrapped so a blocked network or a bad
// symbol degrades to {error} per-symbol rather than breaking the page.

export const dynamic = "force-dynamic";

type Quote = {
  symbol: string;
  price: number | null;
  asOf: string | null;
  basePrice: number | null; // close on/after the `since` date — return baseline
  baseDate: string | null;
  source: "stooq" | "yahoo" | null;
  error?: string;
};

const FETCH_TIMEOUT_MS = 8000;

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

type DailyRow = { date: string; close: number };

/** Parse Stooq daily CSV: header `Date,Open,High,Low,Close,Volume`. */
function parseStooqCsv(csv: string): DailyRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !/^date,/i.test(lines[0])) return [];
  const rows: DailyRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const date = cols[0];
    const close = Number(cols[4]);
    if (date && isFinite(close) && close > 0) rows.push({ date, close });
  }
  return rows;
}

/** Latest row, and the first row on/after `since` as the return baseline. */
function pickFromRows(rows: DailyRow[], since: string) {
  if (rows.length === 0) return { latest: null, base: null };
  const latest = rows[rows.length - 1];
  const base = rows.find((r) => r.date >= since) ?? rows[0];
  return { latest, base };
}

async function fromStooq(symbol: string, since: string): Promise<Quote | null> {
  const s = symbol.toLowerCase();
  const res = await timedFetch(`https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`);
  if (!res.ok) return null;
  const rows = parseStooqCsv(await res.text());
  const { latest, base } = pickFromRows(rows, since);
  if (!latest) return null;
  return {
    symbol,
    price: latest.close,
    asOf: latest.date,
    basePrice: base?.close ?? null,
    baseDate: base?.date ?? null,
    source: "stooq",
  };
}

async function fromYahoo(symbol: string): Promise<Quote | null> {
  // Fallback: latest price only (no reliable baseline without more calls).
  const ticker = symbol.replace(/\.US$/i, "");
  const res = await timedFetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
    { headers: { "User-Agent": "Mozilla/5.0 (value-research)" } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketTime?: number } }> };
  };
  const meta = json.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number" || !isFinite(price)) return null;
  return {
    symbol,
    price,
    asOf: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10) : null,
    basePrice: null,
    baseDate: null,
    source: "yahoo",
  };
}

async function quoteFor(symbol: string, since: string): Promise<Quote> {
  try {
    const stooq = await fromStooq(symbol, since);
    if (stooq) return stooq;
  } catch {
    // fall through to Yahoo
  }
  try {
    const yahoo = await fromYahoo(symbol);
    if (yahoo) return yahoo;
  } catch {
    // fall through to error
  }
  return {
    symbol,
    price: null,
    asOf: null,
    basePrice: null,
    baseDate: null,
    source: null,
    error: "price unavailable",
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const symbols = (params.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const since = /^\d{4}-\d{2}-\d{2}$/.test(params.get("since") ?? "")
    ? (params.get("since") as string)
    : "1970-01-01";

  if (symbols.length === 0) {
    return Response.json({ error: "no symbols" }, { status: 400 });
  }

  const quotes = await Promise.all(symbols.map((s) => quoteFor(s, since)));

  return Response.json(
    { since, quotes },
    {
      headers: {
        // Short edge cache so client polling (~60s) sees fresh quotes without
        // hammering the upstream feed on every visitor's every poll.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
