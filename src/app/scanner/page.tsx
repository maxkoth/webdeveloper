// /scanner — the daily setup scanner dashboard.
//
// The server runs the first scan so the page is useful on first paint and
// indexable; the <ScannerBoard> client island then handles re-scans, sorting,
// and drill-downs. The scan itself is intraday data, so this route is dynamic.

import type { Metadata } from "next";
import Link from "next/link";
import { ScannerBoard } from "@/components/scanner/ScannerBoard";
import { runScan } from "@/lib/scanner/scan";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Setup Scanner",
  description:
    "Scans the day's most in-play US stocks across momentum, trend, volume, technicals, and catalyst signals to rank the strongest setups. Educational screening, not financial advice.",
  alternates: { canonical: "/scanner" },
  robots: { index: false, follow: false },
};

export default async function ScannerPage() {
  const initial = await runScan();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="mb-10">
        <Link
          href="/"
          className="label normal-case tracking-normal transition-colors hover:text-paper"
        >
          ← Maximum Developer
        </Link>

        <p className="label mt-8">Daily setup scanner</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">
          Today&apos;s best
          <br />
          <span className="text-volt">setups</span>, ranked.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          Pulls the day&apos;s most in-play US names, then scores each one across
          momentum, trend, volume participation, technical structure, and a
          catalyst signal. The score is a transparent weighted blend — expand any
          row to see exactly why it ranked where it did.
        </p>
      </header>

      <ScannerBoard initial={initial} />

      <section className="mt-12 border-t border-line pt-6">
        <h2 className="label mb-3">How the score works</h2>
        <ul className="grid gap-x-8 gap-y-2 text-sm text-muted sm:grid-cols-2">
          <li>
            <span className="text-paper">Momentum (25)</span> — day move, multi-week
            thrust, RSI posture.
          </li>
          <li>
            <span className="text-paper">Trend (20)</span> — moving-average stack,
            ADX strength, aggregate rating.
          </li>
          <li>
            <span className="text-paper">Volume (20)</span> — today&apos;s relative
            volume vs its 10-day norm.
          </li>
          <li>
            <span className="text-paper">Technicals (20)</span> — MACD posture,
            52-week range position, structure.
          </li>
          <li>
            <span className="text-paper">Catalyst (15)</span> — gap + volume proxy
            for a news-driven move.
          </li>
        </ul>
        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-muted">
          <span className="text-paper">Not financial advice.</span> This is an
          educational screening tool. A high score means a name matches the
          profile of a strong, in-play setup right now — it is not a prediction,
          a probability, or a recommendation to buy or sell. Markets are risky;
          do your own research. Data via TradingView&apos;s public scanner and
          Yahoo Finance; when those sources can&apos;t be reached the board falls
          back to clearly-labelled sample data.
        </p>
      </section>
    </main>
  );
}
