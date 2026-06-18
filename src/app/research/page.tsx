import type { Metadata } from "next";
import Link from "next/link";
import QuotesProvider from "./QuotesProvider";
import RankedTable from "./RankedTable";
import LivePrice from "./LivePrice";
import {
  SCREEN,
  DEEP_DIVES,
  ANALYSIS_DATE,
  DATA_DISCLAIMER,
  type DeepDive,
  type Verdict,
} from "@/lib/research/picks";

export const metadata: Metadata = {
  title: "Value-Investing Research",
  description:
    "A skeptical, Graham–Buffett-style value screen: intrinsic value ranges, conservative buy-below prices, pre-mortems, and a live price tracker. Not investment advice.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/research" },
};

const symbols = DEEP_DIVES.map((d) => d.quoteSymbol);

export default function ResearchPage() {
  return (
    <QuotesProvider symbols={symbols} since={ANALYSIS_DATE}>
      <main id="main" className="mx-auto max-w-5xl px-5 pb-32 pt-24 sm:px-8">
        <TopBar />
        <Header />
        <Disclaimer />

        <Section index="01" label="Ranked by margin of safety" title="The screen, live">
          <p className="mb-6 max-w-2xl text-muted">
            Candidates that cleared the quality screen, ranked by{" "}
            <em>live</em> margin of safety — current price against a deliberately
            conservative intrinsic-value low. Buy-below prices are static
            judgments; the ranking and status move with the market price.
          </p>
          <RankedTable />
        </Section>

        <Section index="02" label="Reject fast" title="Full candidate screen">
          <p className="mb-6 max-w-2xl text-muted">
            Most names are rejected or parked before deep analysis. &ldquo;No
            buy&rdquo; and &ldquo;hold cash&rdquo; are correct, frequent outputs.
          </p>
          <ScreenTable />
        </Section>

        <Section index="03" label="The work" title="Deep dives">
          <p className="mb-10 max-w-2xl text-muted">
            For each survivor: the business, a quality scorecard, two valuation
            methods with every assumption shown, a conservative buy-below price,
            a pre-mortem (which replaces a stop-loss), and position sizing.
          </p>
          <div className="space-y-20">
            {DEEP_DIVES.map((d, i) => (
              <DeepDiveBlock key={d.ticker} dive={d} rank={i + 1} />
            ))}
          </div>
        </Section>

        <Section index="04" label="Falsification" title="What would change my mind">
          <p className="mb-8 max-w-2xl text-muted">
            The specific, checkable evidence that would break — or trigger — each
            thesis. A thesis you can&rsquo;t falsify isn&rsquo;t a thesis.
          </p>
          <div className="space-y-8">
            {DEEP_DIVES.map((d) => (
              <div key={d.ticker} className="rounded-xl border border-line p-6">
                <h3 className="font-display text-2xl font-extrabold text-paper">
                  {d.ticker} <span className="text-muted">{d.name}</span>
                </h3>
                <ul className="mt-4 space-y-2">
                  {d.changeMyMind.map((c, i) => (
                    <li key={i} className="flex gap-3 text-paper/90">
                      <span aria-hidden className="text-volt">
                        →
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Conclusion />
      </main>
    </QuotesProvider>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function TopBar() {
  return (
    <div className="mb-14 flex items-center justify-between font-mono text-xs uppercase tracking-[0.16em] text-muted">
      <Link href="/" className="transition-colors hover:text-paper">
        ← Maximum<span className="text-volt">.</span>
      </Link>
      <Link href="/screener" className="transition-colors hover:text-paper">
        Live screener →
      </Link>
    </div>
  );
}

function Header() {
  return (
    <header>
      <p className="label text-volt">Graham–Buffett discipline</p>
      <h1 className="display mt-5 text-[clamp(2.5rem,8vw,5.5rem)] text-paper">
        What is it worth<span className="text-volt">?</span>
        <br />
        And what does it cost<span className="text-volt">?</span>
      </h1>
      <p className="mt-7 max-w-2xl text-lg text-muted">
        A skeptical value screen. The job is not to predict prices — it&rsquo;s to
        estimate what a business is worth, demand a margin of safety against that
        estimate, and argue the bear case before the bull case. Conclusions are
        stated only as intrinsic-value range, margin of safety, business quality,
        and thesis risk. Never &ldquo;it will go up.&rdquo;
      </p>
    </header>
  );
}

function Disclaimer() {
  return (
    <div className="mt-10 rounded-xl border border-volt/40 bg-volt/[0.06] p-6">
      <p className="label text-volt">Data provenance — read first</p>
      <p className="mt-3 text-sm leading-relaxed text-paper/90">{DATA_DISCLAIMER}</p>
      <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-muted">
        Not investment advice. Educational illustration of a valuation method. Do
        your own work from primary filings.
      </p>
    </div>
  );
}

function Section({
  index,
  label,
  title,
  children,
}: {
  index: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-24">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-sm text-volt" aria-hidden>
          {index}
        </span>
        <span className="label">{label}</span>
      </div>
      <h2 className="display mt-4 text-[clamp(2rem,5vw,3.5rem)] text-paper">{title}</h2>
      <div className="mt-8">{children}</div>
    </section>
  );
}

const VERDICT_STYLE: Record<Verdict, { text: string; label: string }> = {
  "deep-dive": { text: "text-volt", label: "Deep dive" },
  watch: { text: "text-paper", label: "Watch" },
  rejected: { text: "text-muted", label: "Reject" },
};

function ScreenTable() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            <th className="px-4 py-3 font-normal">Ticker</th>
            <th className="px-4 py-3 font-normal">Name</th>
            <th className="px-4 py-3 font-normal">Verdict</th>
            <th className="px-4 py-3 font-normal">Reason</th>
          </tr>
        </thead>
        <tbody>
          {SCREEN.map((row) => {
            const s = VERDICT_STYLE[row.verdict];
            return (
              <tr key={row.ticker} className="border-b border-line/60 align-top last:border-0">
                <td className="px-4 py-4 font-display font-extrabold text-paper">{row.ticker}</td>
                <td className="px-4 py-4 text-muted">{row.name}</td>
                <td className={`px-4 py-4 font-mono text-xs uppercase tracking-wide ${s.text}`}>
                  {s.label}
                </td>
                <td className="px-4 py-4 text-sm text-paper/80">{row.note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeepDiveBlock({ dive, rank }: { dive: DeepDive; rank: number }) {
  return (
    <article className="border-t border-line pt-10">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-sm text-volt">{String(rank).padStart(2, "0")}</span>
        <span className="label">Deep dive</span>
      </div>
      <h3 className="display mt-3 text-[clamp(1.75rem,4vw,3rem)] text-paper">
        {dive.ticker} <span className="text-muted">· {dive.name}</span>
      </h3>

      <div className="mt-6">
        <LivePrice ticker={dive.ticker} />
      </div>

      <Block title="Business">{dive.business}</Block>
      <Block title="Moat">{dive.moat}</Block>

      <SubHead>Quality scorecard</SubHead>
      <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
        {dive.qualityScorecard.map((s) => (
          <div key={s.metric} className="bg-ink-raised p-5">
            <dt className="label">{s.metric}</dt>
            <dd className="mt-2 text-sm text-paper/90">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-paper/80">
        <span className="font-semibold text-paper">Owner earnings — </span>
        {dive.ownerEarningsNote}
      </p>

      <SubHead>Valuation — assumptions on the table</SubHead>
      <AssumptionsGrid dive={dive} />
      <p className="mt-4 text-sm leading-relaxed text-paper/80">{dive.valuationNote}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ListCard title="Pre-mortem — 3 ways the thesis is wrong" items={dive.thesisRisks} />
        <ListCard title="Sell triggers (business, never price)" items={dive.sellTriggers} accent />
      </div>

      <Block title="Bear case">{dive.bearCase}</Block>
      <Block title="Position sizing">{dive.positionSizing}</Block>
    </article>
  );
}

function AssumptionsGrid({ dive }: { dive: DeepDive }) {
  const a = dive.assumptions;
  const items: { k: string; v: string }[] = [
    { k: "Normalized owner earnings", v: `$${a.ownerEarnings}B` },
    { k: "Diluted shares", v: `${a.shares}B` },
    { k: "Net cash / (debt)", v: `$${a.netCash}B` },
    { k: "EPV required return", v: `${(a.requiredReturn * 100).toFixed(0)}%` },
    { k: "DCF discount rate", v: `${(a.discountRate * 100).toFixed(0)}%` },
    { k: "10-yr growth bracket", v: `${(a.growthLow * 100).toFixed(0)}–${(a.growthHigh * 100).toFixed(0)}%` },
    { k: "Terminal growth", v: `${(a.terminalGrowth * 100).toFixed(0)}%` },
    { k: "Horizon", v: `${a.years} yrs` },
  ];
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.k} className="bg-ink-raised p-4">
          <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-muted">{it.k}</dt>
          <dd className="mt-1 font-display text-lg font-extrabold text-paper">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ListCard({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line p-6">
      <p className={`label ${accent ? "text-volt" : ""}`}>{title}</p>
      <ul className="mt-4 space-y-3">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3 text-sm text-paper/90">
            <span aria-hidden className={accent ? "text-volt" : "text-muted"}>
              {accent ? "■" : `${i + 1}.`}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <SubHead>{title}</SubHead>
      <p className="text-paper/90 leading-relaxed">{children}</p>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="label mb-3 mt-8 first:mt-0">{children}</p>;
}

function Conclusion() {
  return (
    <section className="mt-24 rounded-xl border border-line bg-ink-raised p-8">
      <p className="label text-volt">Bottom line</p>
      <h2 className="display mt-4 text-[clamp(1.75rem,4vw,3rem)] text-paper">
        Mega-cap quality is rarely on sale.
      </h2>
      <p className="mt-5 max-w-2xl text-paper/90 leading-relaxed">
        All three survivors are exceptional businesses, which is precisely why a
        margin of safety seldom exists at the current price. Each buy-below price
        sits well under where great companies usually trade. If the live table
        shows every name in &ldquo;Wait,&rdquo; that is the honest answer:{" "}
        <span className="text-paper">hold cash and wait</span>. The tracker exists
        to flag the rare dislocation when price finally meets value — not to
        manufacture a reason to buy today.
      </p>
      <p className="mt-5 font-mono text-[0.7rem] leading-relaxed text-muted">
        Reminder: fundamentals here are an early-2026 training-data snapshot, not
        live filings. Rebuild every assumption from the latest 10-K/10-Q before
        acting. This page is educational, not investment advice.
      </p>
    </section>
  );
}
