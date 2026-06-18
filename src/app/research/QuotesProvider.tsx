"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
};

const QuotesContext = createContext<QuotesState>({ quotes: {}, status: "loading" });

export function useQuote(symbol: string): { quote: Quote | undefined; status: QuotesState["status"] } {
  const { quotes, status } = useContext(QuotesContext);
  return { quote: quotes[symbol], status };
}

export function useQuotes(): QuotesState {
  return useContext(QuotesContext);
}

/**
 * Fetches every symbol once on mount and shares the result. Prices are the only
 * live input on the page; if the fetch fails (e.g. no outbound network), the
 * page still renders the full analysis and each consumer shows a graceful
 * "live price unavailable" rather than breaking.
 */
export default function QuotesProvider({
  symbols,
  since,
  children,
}: {
  symbols: string[];
  since: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<QuotesState>({ quotes: {}, status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const url = `/api/quote?symbols=${encodeURIComponent(symbols.join(","))}&since=${encodeURIComponent(since)}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { quotes: Quote[] }) => {
        if (cancelled) return;
        const map: Record<string, Quote> = {};
        for (const q of data.quotes ?? []) map[q.symbol] = q;
        setState({ quotes: map, status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setState({ quotes: {}, status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [symbols, since]);

  return <QuotesContext.Provider value={state}>{children}</QuotesContext.Provider>;
}
