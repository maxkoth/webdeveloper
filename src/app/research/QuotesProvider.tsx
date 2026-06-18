"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type Quote = {
  symbol: string;
  price: number | null;
  asOf: string | null;
  basePrice: number | null;
  baseDate: string | null;
  source: "stooq" | "yahoo" | null;
  error?: string;
};

type QuotesState = {
  quotes: Record<string, Quote>;
  status: "loading" | "ready" | "error";
  lastUpdated: number | null;
};

const QuotesContext = createContext<QuotesState>({ quotes: {}, status: "loading", lastUpdated: null });

export function useQuote(symbol: string): { quote: Quote | undefined; status: QuotesState["status"] } {
  const { quotes, status } = useContext(QuotesContext);
  return { quote: quotes[symbol], status };
}

export function useQuotes(): QuotesState {
  return useContext(QuotesContext);
}

/** How often to re-pull prices while the tab is open. */
const DEFAULT_REFRESH_MS = 60_000;

/**
 * Fetches every symbol on mount and then keeps them current: it re-pulls on an
 * interval, and immediately re-pulls whenever the tab regains focus (so a price
 * is never stale after you come back to it). Prices are the only live input on
 * the page; if a fetch fails (e.g. no outbound network) the page still renders
 * the full analysis and consumers show a graceful "price unavailable."
 *
 * Freshness is bounded by the upstream feed, not by this interval: the free
 * sources (Stooq/Yahoo) are delayed/end-of-day, not tick-by-tick.
 */
export default function QuotesProvider({
  symbols,
  since,
  refreshMs = DEFAULT_REFRESH_MS,
  children,
}: {
  symbols: string[];
  since: string;
  refreshMs?: number;
  children: ReactNode;
}) {
  const [state, setState] = useState<QuotesState>({ quotes: {}, status: "loading", lastUpdated: null });
  // Stable key so the effect doesn't re-arm on every render (array identity).
  const symbolsKey = symbols.join(",");
  const cancelledRef = useRef(false);

  const load = useCallback(() => {
    const url = `/api/quote?symbols=${encodeURIComponent(symbolsKey)}&since=${encodeURIComponent(since)}`;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { quotes: Quote[] }) => {
        if (cancelledRef.current) return;
        const map: Record<string, Quote> = {};
        for (const q of data.quotes ?? []) map[q.symbol] = q;
        setState({ quotes: map, status: "ready", lastUpdated: Date.now() });
      })
      .catch(() => {
        // Keep any prices we already have; only flag error on the first load.
        setState((prev) =>
          prev.lastUpdated ? prev : { quotes: {}, status: "error", lastUpdated: null },
        );
      });
  }, [symbolsKey, since]);

  useEffect(() => {
    cancelledRef.current = false;
    load();

    const interval = setInterval(load, refreshMs);
    const onFocus = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load, refreshMs]);

  return <QuotesContext.Provider value={state}>{children}</QuotesContext.Provider>;
}
