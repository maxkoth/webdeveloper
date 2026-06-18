"use client";

import { useQuotes } from "./QuotesProvider";
import { DEEP_DIVES } from "@/lib/research/picks";
import { valuation, marginOfSafety, gapToBuyBelow } from "@/lib/research/valuation";
import { money, pct } from "@/lib/research/format";

/**
 * The candidates ranked by LIVE margin of safety (price vs. the conservative
 * intrinsic low). Sorting is dynamic because it depends on the market price;
 * the buy-below column is static. Rows with no available price sort last.
 */
export default function RankedTable() {
  const { quotes, status } = useQuotes();

  const rows = DEEP_DIVES.map((d) => {
    const v = valuation(d.assumptions);
    const price = quotes[d.quoteSymbol]?.price ?? null;
    return {
      ticker: d.ticker,
      name: d.name,
      price,
      buyBelow: v.buyBelow,
      mos: marginOfSafety(price, v),
      gap: gapToBuyBelow(price, v),
      inBuyZone: price != null && price <= v.buyBelow,
    };
  }).sort((a, b) => {
    if (a.mos == null && b.mos == null) return 0;
    if (a.mos == null) return 1;
    if (b.mos == null) return -1;
    return b.mos - a.mos;
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <caption className="sr-only">Candidates ranked by live margin of safety</caption>
        <thead>
          <tr className="border-b border-line font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            <Th className="w-10">#</Th>
            <Th>Candidate</Th>
            <Th className="text-right">Price</Th>
            <Th className="text-right">Buy below</Th>
            <Th className="text-right">Margin of safety</Th>
            <Th className="text-right">Gap to entry</Th>
            <Th className="text-right">Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.ticker} className="border-b border-line/60 last:border-0">
              <Td className="font-mono text-muted">{i + 1}</Td>
              <Td>
                <span className="font-display font-extrabold text-paper">{r.ticker}</span>
                <span className="ml-2 text-sm text-muted">{r.name}</span>
              </Td>
              <Td className="text-right font-mono">{money(r.price)}</Td>
              <Td className="text-right font-mono text-volt">{money(r.buyBelow)}</Td>
              <Td className={`text-right font-mono ${r.mos != null && r.mos > 0 ? "text-volt" : "text-paper"}`}>
                {r.mos == null ? "—" : pct(r.mos)}
              </Td>
              <Td className="text-right font-mono">{r.gap == null ? "—" : pct(r.gap)}</Td>
              <Td className="text-right">
                {r.price == null ? (
                  <span className="font-mono text-xs text-muted">
                    {status === "loading" ? "…" : "n/a"}
                  </span>
                ) : (
                  <span className={`font-mono text-xs uppercase ${r.inBuyZone ? "text-volt" : "text-muted"}`}>
                    {r.inBuyZone ? "Buy zone" : "Wait"}
                  </span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-normal ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-4 align-middle ${className}`}>{children}</td>;
}
