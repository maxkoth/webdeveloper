// Universe + technicals from TradingView's public scanner endpoint.
//
// This is the same JSON API the tradingview.com screener uses. It takes a
// filter/sort/columns spec and returns rows of raw values. We ask for liquid
// US common stock sorted by the day's biggest movers, then score in our own
// engine. The endpoint is unauthenticated but rate-limited; be a good citizen.

import type { RawQuote } from "./types";

const SCANNER_URL = "https://scanner.tradingview.com/america/scan";

// Column order matters: the API returns values as a positional array that we
// zip back onto these keys. Keep COLUMNS and the mapping below in lockstep.
const COLUMNS = [
  "name",
  "description",
  "close",
  "change",
  "volume",
  "relative_volume_10d_calc",
  "market_cap_basic",
  "RSI",
  "Mom",
  "ADX",
  "MACD.macd",
  "MACD.signal",
  "SMA20",
  "SMA50",
  "SMA200",
  "gap",
  "price_52_week_high",
  "price_52_week_low",
  "Recommend.All",
  "sector",
] as const;

type ScannerRow = { s: string; d: unknown[] };
type ScannerResponse = { totalCount?: number; data?: ScannerRow[] };

const num = (v: unknown): number => (typeof v === "number" && isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Pull the day's in-play universe. We filter to real, liquid common stock
 * (price and volume floors knock out penny/illiquid names) and sort by the
 * largest absolute change so movers in either direction surface first.
 *
 * @param limit how many rows to request (we score the whole batch).
 */
export async function fetchUniverse(limit = 60): Promise<RawQuote[]> {
  const body = {
    filter: [
      { left: "type", operation: "equal", right: "stock" },
      { left: "is_primary", operation: "equal", right: true },
      { left: "close", operation: "greater", right: 3 },
      { left: "volume", operation: "greater", right: 750_000 },
      { left: "market_cap_basic", operation: "greater", right: 300_000_000 },
    ],
    options: { lang: "en" },
    markets: ["america"],
    symbols: { query: { types: [] }, tickers: [] },
    columns: COLUMNS,
    // Rank by relative volume: today's unusual participation is the surest
    // tell that a name is actually in play, not just drifting.
    sort: { sortBy: "relative_volume_10d_calc", sortOrder: "desc" },
    range: [0, limit],
  };

  const res = await fetch(SCANNER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The endpoint rejects requests without a browser-like UA.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    // Always hit the network; this data is intraday and must never be cached.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`TradingView scanner responded ${res.status}`);
  }

  const json = (await res.json()) as ScannerResponse;
  const rows = json.data ?? [];

  return rows
    .map((row) => mapRow(row))
    .filter((q): q is RawQuote => q !== null);
}

/** Zip a positional row back onto named fields, tolerating nulls. */
function mapRow(row: ScannerRow): RawQuote | null {
  const d = row.d;
  if (!Array.isArray(d) || d.length < COLUMNS.length) return null;
  const at = (col: (typeof COLUMNS)[number]) => d[COLUMNS.indexOf(col)];

  const close = num(at("close"));
  if (close <= 0) return null;

  // TradingView ships a ticker like "NASDAQ:MRVL"; keep just the symbol.
  const symbol = row.s.includes(":") ? row.s.split(":")[1] : row.s;

  return {
    symbol,
    name: str(at("description")) || symbol,
    close,
    changePct: num(at("change")),
    volume: num(at("volume")),
    relVolume: num(at("relative_volume_10d_calc")),
    marketCap: num(at("market_cap_basic")),
    rsi: num(at("RSI")),
    momentum: num(at("Mom")),
    adx: num(at("ADX")),
    macd: num(at("MACD.macd")),
    macdSignal: num(at("MACD.signal")),
    sma20: num(at("SMA20")),
    sma50: num(at("SMA50")),
    sma200: num(at("SMA200")),
    gapPct: num(at("gap")),
    high52: num(at("price_52_week_high")),
    low52: num(at("price_52_week_low")),
    rating: num(at("Recommend.All")),
    sector: str(at("sector")) || "—",
  };
}
