import type { Metadata } from "next";
import Link from "next/link";
import ScreenerClient from "./ScreenerClient";
import { UNIVERSE } from "@/lib/research/universe";

export const metadata: Metadata = {
  title: "Live Value Screener",
  description:
    "Scans a universe of quality businesses with live SEC EDGAR fundamentals and prices, screening for those trading below conservative intrinsic value. Educational, not investment advice.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/screener" },
};

export default function ScreenerPage() {
  return (
    <main id="main" className="mx-auto max-w-6xl px-5 pb-32 pt-24 sm:px-8">
      <div className="mb-14 flex items-center justify-between font-mono text-xs uppercase tracking-[0.16em] text-muted">
        <Link href="/" className="transition-colors hover:text-paper">
          ← Maximum<span className="text-volt">.</span>
        </Link>
        <Link href="/research" className="transition-colors hover:text-paper">
          Curated deep dives →
        </Link>
      </div>

      <header>
        <p className="label text-volt">Live screen · {UNIVERSE.length} businesses</p>
        <h1 className="display mt-5 text-[clamp(2.25rem,7vw,5rem)] text-paper">
          What&rsquo;s cheap
          <br />
          right now<span className="text-volt">?</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg text-muted">
          This pulls <span className="text-paper">live financials straight from SEC EDGAR</span>{" "}
          and live prices, runs the quality screen (FCF, ROIC, leverage, revenue
          trend), values each survivor with a conservative EPV + DCF, and flags
          which trade in a buy zone today. Two lenses: a strict deep-bargain price
          and a fair-value price for quality you&rsquo;d hold for years.
        </p>
      </header>

      <div className="mt-10 rounded-xl border border-volt/40 bg-volt/[0.06] p-6">
        <p className="label text-volt">How to read this — and its limits</p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-paper/90">
          <li>
            • Figures are <span className="text-paper">auto-extracted from EDGAR XBRL</span>. That
            extraction can misfire on unusual filings — <span className="text-paper">click any row</span>{" "}
            to see the raw numbers and fiscal years used, and verify against the 10-K before acting.
          </li>
          <li>
            • &ldquo;Owner earnings&rdquo; here is a 3-year free-cash-flow average; growth is hard-capped
            at 10%. It&rsquo;s deliberately conservative, so it will call many great businesses
            &ldquo;rich.&rdquo; That&rsquo;s the point.
          </li>
          <li>
            • If everything says &ldquo;Wait,&rdquo; the honest answer is <span className="text-paper">hold cash</span>.
            A screen that never says no isn&rsquo;t protecting you.
          </li>
          <li>
            • <span className="text-paper">Not investment advice.</span> A starting point for your own work, not a recommendation.
          </li>
        </ul>
      </div>

      <section className="mt-12">
        <ScreenerClient />
      </section>
    </main>
  );
}
