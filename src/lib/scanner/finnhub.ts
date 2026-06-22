// Real news sentiment from Finnhub. Requires FINNHUB_API_KEY in the env; when
// it's absent every function no-ops (returns null) and the scorer falls back
// to its gap+volume catalyst proxy. We only call this for the top-ranked
// candidates to respect the free-tier rate limit.

import type { NewsSignal } from "./types";

const BASE = "https://finnhub.io/api/v1";

type CompanyNewsItem = { headline?: string; datetime?: number };

/** True when a key is configured — lets callers skip Finnhub work entirely. */
export function finnhubEnabled(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

/**
 * Derive a news signal for one symbol from its recent company news. We compute
 * a lightweight sentiment from headline keywords (Finnhub's dedicated
 * news-sentiment endpoint is premium-only), which is transparent and free-tier
 * friendly. Swap in the premium /news-sentiment endpoint here if you upgrade.
 */
export async function fetchNews(
  symbol: string,
  days = 5,
): Promise<NewsSignal | null> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  try {
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    const url =
      `${BASE}/company-news?symbol=${encodeURIComponent(symbol)}` +
      `&from=${fmt(from)}&to=${fmt(to)}&token=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const items = (await res.json()) as CompanyNewsItem[];
    if (!Array.isArray(items) || items.length === 0) {
      return { sentiment: 0, articleCount: 0 };
    }

    const headlines = items
      .map((i) => i.headline)
      .filter((h): h is string => Boolean(h));
    const sentiment = headlines.length ? scoreHeadlines(headlines) : 0;
    // Items come back newest-first.
    const topHeadline = headlines[0];

    return { sentiment, articleCount: headlines.length, topHeadline };
  } catch {
    return null;
  }
}

/** Fetch news for several symbols in parallel. Missing ones map to null. */
export async function fetchNewsBatch(
  symbols: string[],
): Promise<Map<string, NewsSignal>> {
  const out = new Map<string, NewsSignal>();
  if (!finnhubEnabled()) return out;
  const results = await Promise.all(symbols.map((s) => fetchNews(s)));
  symbols.forEach((s, i) => {
    const r = results[i];
    if (r) out.set(s, r);
  });
  return out;
}

// A small, transparent lexicon. Not a research-grade NLP model — it's a
// keyword lean over headlines, which is exactly what it claims to be in the UI.
const BULLISH =
  /\b(beat|beats|surge|soar|jump|rally|upgrade|raise[sd]?|record|strong|growth|wins?|approval|partnership|buyback|outperform|tops?)\b/i;
const BEARISH =
  /\b(miss|misses|plunge|sink|fall|drop|downgrade|cut[s]?|lawsuit|probe|recall|weak|warn(s|ing)?|loss(es)?|slump|halts?)\b/i;

function scoreHeadlines(headlines: string[]): number {
  let net = 0;
  for (const h of headlines) {
    if (BULLISH.test(h)) net += 1;
    if (BEARISH.test(h)) net -= 1;
  }
  // Squash to -1..1 so a handful of one-sided headlines saturate, not explode.
  return Math.tanh(net / 3);
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);
