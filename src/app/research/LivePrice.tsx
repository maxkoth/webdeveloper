"use client";

import { useQuote } from "./QuotesProvider";
import { DEEP_DIVES } from "@/lib/research/picks";
import { valuation, marginOfSafety, gapToBuyBelow } from "@/lib/research/valuation";
import { money, pct } from "@/lib/research/format";

/**
 * Live stat block for one deep-dive: market price vs. the (static) buy-below
 * price, current margin of safety, and the return since the analysis date.
 * Everything dynamic comes from the live quote; the buy-below is derived from
 * the published assumptions, so the verdict (BUY ZONE / WAIT) updates with price
 * but never with sentiment.
 */
export default function LivePrice({ ticker }: { ticker: string }) {
  const dive = DEEP_DIVES.find((d) => d.ticker === ticker);
  const { quote, status } = useQuote(dive?.quoteSymbol ?? "");
  if (!dive) return null;

  const v = valuation(dive.assumptions);
  const price = quote?.price ?? null;
  const inBuyZone = price != null && price <= v.buyBelow;
  const mos = marginOfSafety(price, v);
  const gap = gapToBuyBelow(price, v);
  const ret =
    price != null && quote?.basePrice ? (price - quote.basePrice) / quote.basePrice : null;

  return (
    <div className="rounded-xl border border-line bg-ink-raised p-5">
      <div className="flex items-center justify-between gap-4">
        <span className="label">Live read</span>
        {price != null ? (
          <span
            className={`font-mono text-xs uppercase tracking-[0.16em] ${
              inBuyZone ? "text-volt" : "text-muted"
            }`}
          >
            {inBuyZone ? "● Buy zone" : "● Wait"}
          </span>
        ) : (
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
            {status === "loading" ? "Loading…" : "Price unavailable"}
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Stat label="Price" value={money(price)} />
        <Stat label="Buy below" value={money(v.buyBelow)} accent />
        <Stat
          label="Gap to entry"
          value={gap == null ? "—" : pct(gap)}
          hint={gap != null && gap > 0 ? "must fall" : gap != null ? "below entry" : undefined}
        />
        <Stat
          label={`Since ${quote?.baseDate ?? "analysis"}`}
          value={ret == null ? "—" : pct(ret)}
        />
      </dl>

      <p className="mt-4 font-mono text-[0.7rem] leading-relaxed text-muted">
        Intrinsic range {money(v.intrinsicLow)}–{money(v.intrinsicHigh)} · EPV floor{" "}
        {money(v.epvPerShare)} · margin of safety vs. low{" "}
        {mos == null ? "—" : pct(mos)}
        {quote?.source ? ` · price via ${quote.source}` : ""}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className={`mt-1 font-display text-xl font-extrabold ${accent ? "text-volt" : "text-paper"}`}>
        {value}
      </dd>
      {hint && <dd className="font-mono text-[0.65rem] uppercase tracking-wide text-muted">{hint}</dd>}
    </div>
  );
}
