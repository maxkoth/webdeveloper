// Shared, server-only price fetching used by /api/quote and /api/screen.
// Stooq is primary (key-free CSV giving the latest close and a historical
// baseline in one call); Yahoo is a fallback for the latest price.

export type PriceQuote = {
  symbol: string;
  price: number | null;
  asOf: string | null;
  basePrice: number | null;
  baseDate: string | null;
  source: "stooq" | "yahoo" | null;
  error?: string;
};

const FETCH_TIMEOUT_MS = 8000;

export async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.signal ? 0 : FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

type DailyRow = { date: string; close: number };

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

function pickFromRows(rows: DailyRow[], since: string) {
  if (rows.length === 0) return { latest: null, base: null };
  const latest = rows[rows.length - 1];
  const base = rows.find((r) => r.date >= since) ?? rows[0];
  return { latest, base };
}

async function fromStooq(symbol: string, since: string): Promise<PriceQuote | null> {
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

async function fromYahoo(symbol: string): Promise<PriceQuote | null> {
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
    asOf: meta?.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10)
      : null,
    basePrice: null,
    baseDate: null,
    source: "yahoo",
  };
}

export async function quoteFor(symbol: string, since: string): Promise<PriceQuote> {
  try {
    const stooq = await fromStooq(symbol, since);
    if (stooq) return stooq;
  } catch {
    /* fall through */
  }
  try {
    const yahoo = await fromYahoo(symbol);
    if (yahoo) return yahoo;
  } catch {
    /* fall through */
  }
  return { symbol, price: null, asOf: null, basePrice: null, baseDate: null, source: null, error: "price unavailable" };
}
