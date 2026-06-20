"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { money, pct } from "@/lib/research/format";
import type { Scored } from "@/lib/research/score";

type Fundamentals = {
  revenue: number | null;
  netIncome: number | null;
  fcfLatest: number | null;
  fcfAvg3: number | null;
  netCash: number | null;
  dilutedShares: number | null;
  missing: string[];
};

type Row = {
  ticker: string;
  name: string;
  sector: string;
  price: number | null;
  entityName: string | null;
  fiscalYear: number | null;
  span: string | null;
  fundamentals: Fundamentals | null;
  scored: Scored | null;
  error?: string;
};

type ScreenResponse = { asOf: string; count: number; rows: Row[]; error?: string; detail?: string };

type Lens = "bargain" | "fair";

const bil = (n: number | null | undefined) =>
  n == null || !isFinite(n) ? "—" : `$${(n / 1e9).toLocaleString("en-US", { maximumFractionDigits: 1 })}B`;

export default function ScreenerClient() {
  const [data, setData] = useState<ScreenResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [lens, setLens] = useState<Lens>("fair");
  const [open, setOpen] = useState<string | null>(null);
  // Size / quality filters, applied server-side via /api/screen query params.
  const [maxPrice, setMaxPrice] = useState("");
  const [smallCap, setSmallCap] = useState(false);
  const [qualityOnly, setQualityOnly] = useState(false);

  const run = useCallback(() => {
    setState("loading");
    const p = new URLSearchParams({ limit: "300" });
    if (maxPrice && Number(maxPrice) > 0) p.set("maxPrice", maxPrice);
    if (smallCap) p.set("maxCap", "2000000000");
    if (qualityOnly) p.set("quality", "1");
    fetch(`/api/screen?${p.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: ScreenResponse) => {
        setData(d);
        setState(d.error ? "error" : "ready");
      })
      .catch(() => setState("error"));
  }, [maxPrice, smallCap, qualityOnly]);

  // Run once on mount; after that the user re-runs via the Apply button.
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => run();

  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    const rank = (r: Row) => {
      if (r.scored?.verdict === "pass") return 0;
      if (r.scored?.verdict === "reject") return 1;
      return 2;
    };
    return [...all].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      const ma = a.scored?.marginOfSafety ?? -Infinity;
      const mb = b.scored?.marginOfSafety ?? -Infinity;
      return mb - ma;
    });
  }, [data]);

  const counts = useMemo(() => {
    const c = { pass: 0, reject: 0, insufficient: 0, inZone: 0 };
    for (const r of data?.rows ?? []) {
      const v = r.scored?.verdict;
      if (v === "pass") c.pass++;
      else if (v === "reject") c.reject++;
      else c.insufficient++;
      if (inZone(r, lens)) c.inZone++;
    }
    return c;
  }, [data, lens]);

  if (state === "loading") {
    return (
      <Panel>
        <p className="font-mono text-sm text-muted">
          Pulling live filings from SEC EDGAR and prices for the universe — this
          can take 20–40 seconds on a cold load. Nothing is cached on first run.
        </p>
        <div className="mt-4 h-1 w-full overflow-hidden rounded bg-line">
          <div className="h-full w-1/3 animate-pulse bg-volt" />
        </div>
      </Panel>
    );
  }

  if (state === "error") {
    return (
      <Panel>
        <p className="label text-volt">Couldn&rsquo;t run the screen</p>
        <p className="mt-3 text-sm text-paper/90">
          {data?.error ??
            "The screen needs outbound access to SEC EDGAR. That works when you run this on your own machine or on Vercel, but not inside a restricted sandbox."}
        </p>
        {data?.detail && <p className="mt-2 font-mono text-xs text-muted">{data.detail}</p>}
        <button
          onClick={retry}
          className="mt-5 inline-flex items-center rounded-full bg-volt px-4 py-2 font-semibold text-ink transition-transform hover:-translate-y-0.5"
        >
          Retry
        </button>
      </Panel>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-full border border-line p-1">
          <LensButton active={lens === "fair"} onClick={() => setLens("fair")} label="Fair value" />
          <LensButton active={lens === "bargain"} onClick={() => setLens("bargain")} label="Deep bargain" />
        </div>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
          {counts.pass} pass · {counts.reject} rejected · {counts.insufficient} no data ·{" "}
          <span className="text-volt">{counts.inZone} in buy zone</span>
        </p>
      </div>

      {/* Size / quality filters */}
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line p-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Max price $
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="any"
            className="w-20 rounded border border-line bg-ink px-2 py-1 font-mono text-paper"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={smallCap} onChange={(e) => setSmallCap(e.target.checked)} />
          Small-cap only (≤ $2B)
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={qualityOnly} onChange={(e) => setQualityOnly(e.target.checked)} />
          Quality only (passes screen)
        </label>
        <button
          onClick={run}
          className="rounded-full bg-volt px-4 py-1.5 font-semibold text-ink transition-transform hover:-translate-y-0.5"
        >
          Apply
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        {lens === "fair" ? (
          <>
            <span className="text-paper">Fair-value lens</span> — buy zone = price at
            or below the conservative intrinsic low. Reasonable long-term entry for
            a business that also passes the quality screen.
          </>
        ) : (
          <>
            <span className="text-paper">Deep-bargain lens</span> — buy zone = price
            at or below 65% of the intrinsic low. Strict Graham margin of safety;
            triggers rarely.
          </>
        )}
      </p>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">
              <th className="px-3 py-3 font-normal">#</th>
              <th className="px-3 py-3 font-normal">Company</th>
              <th className="px-3 py-3 text-right font-normal">Price</th>
              <th className="px-3 py-3 text-right font-normal">{lens === "fair" ? "Fair value" : "Bargain ≤"}</th>
              <th className="px-3 py-3 text-right font-normal">Margin of safety</th>
              <th className="px-3 py-3 text-right font-normal">ROIC</th>
              <th className="px-3 py-3 text-right font-normal">ND/EBITDA</th>
              <th className="px-3 py-3 text-right font-normal">Screen</th>
              <th className="px-3 py-3 text-right font-normal">Zone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = r.scored;
              const lensPrice = lens === "fair" ? s?.fairPrice : s?.bargainPrice;
              const zone = inZone(r, lens);
              const expanded = open === r.ticker;
              return (
                <FragmentRow
                  key={r.ticker}
                  index={i + 1}
                  row={r}
                  lensPrice={lensPrice ?? null}
                  zone={zone}
                  expanded={expanded}
                  onToggle={() => setOpen(expanded ? null : r.ticker)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      {data?.asOf && (
        <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">
          Filings pulled {new Date(data.asOf).toLocaleString()} · prices live · click a row for the raw figures
        </p>
      )}
    </div>
  );
}

function inZone(r: Row, lens: Lens): boolean {
  const s = r.scored;
  if (!s || s.verdict !== "pass" || r.price == null) return false;
  const line = lens === "fair" ? s.fairPrice : s.bargainPrice;
  return line != null && r.price <= line;
}

function FragmentRow({
  index,
  row,
  lensPrice,
  zone,
  expanded,
  onToggle,
}: {
  index: number;
  row: Row;
  lensPrice: number | null;
  zone: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const s = row.scored;
  const verdict = s?.verdict ?? "insufficient";
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-b border-line/50 transition-colors hover:bg-ink-raised ${
          zone ? "bg-volt/[0.05]" : ""
        }`}
      >
        <td className="px-3 py-3 font-mono text-muted">{index}</td>
        <td className="px-3 py-3">
          <span className="font-display font-extrabold text-paper">{row.ticker}</span>
          <span className="ml-2 text-muted">{row.name}</span>
          {row.error && <span className="ml-2 font-mono text-[0.6rem] text-muted">({row.error})</span>}
        </td>
        <td className="px-3 py-3 text-right font-mono">{money(row.price)}</td>
        <td className="px-3 py-3 text-right font-mono text-volt">{money(lensPrice)}</td>
        <td className={`px-3 py-3 text-right font-mono ${(s?.marginOfSafety ?? 0) > 0 ? "text-volt" : "text-paper"}`}>
          {s?.marginOfSafety == null ? "—" : pct(s.marginOfSafety)}
        </td>
        <td className="px-3 py-3 text-right font-mono">{s?.roic == null ? "—" : pct(s.roic, false)}</td>
        <td className="px-3 py-3 text-right font-mono">
          {s?.netDebtToEbitda == null ? "—" : `${s.netDebtToEbitda.toFixed(1)}x`}
        </td>
        <td className="px-3 py-3 text-right">
          <VerdictPill verdict={verdict} />
        </td>
        <td className="px-3 py-3 text-right font-mono text-xs uppercase">
          {row.price == null ? "—" : zone ? <span className="text-volt">Buy zone</span> : <span className="text-muted">Wait</span>}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-line/50 bg-ink">
          <td colSpan={9} className="px-3 py-5">
            <Detail row={row} />
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ row }: { row: Row }) {
  const f = row.fundamentals;
  const s = row.scored;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div>
        <p className="label">Pulled from {row.span ?? "filings"}</p>
        <dl className="mt-3 space-y-1.5 font-mono text-xs text-paper/80">
          <Line k="Entity" v={row.entityName ?? "—"} />
          <Line k="Revenue (FY)" v={bil(f?.revenue)} />
          <Line k="Net income (FY)" v={bil(f?.netIncome)} />
          <Line k="FCF (latest)" v={bil(f?.fcfLatest)} />
          <Line k="Owner earnings (3-yr avg FCF)" v={bil(f?.fcfAvg3)} />
          <Line k="Net cash / (debt)" v={bil(f?.netCash)} />
          <Line k="Diluted shares" v={f?.dilutedShares ? `${(f.dilutedShares / 1e9).toFixed(2)}B` : "—"} />
        </dl>
        {f?.missing?.length ? (
          <p className="mt-2 font-mono text-[0.65rem] text-muted">missing tags: {f.missing.join(", ")}</p>
        ) : null}
      </div>
      <div>
        <p className="label">Valuation</p>
        {s?.valuation ? (
          <dl className="mt-3 space-y-1.5 font-mono text-xs text-paper/80">
            <Line k="EPV floor (no growth)" v={money(s.valuation.epvPerShare)} />
            <Line k="DCF low → high" v={`${money(s.valuation.dcfLowPerShare)} → ${money(s.valuation.dcfHighPerShare)}`} />
            <Line k="Intrinsic range" v={`${money(s.valuation.intrinsicLow)}–${money(s.valuation.intrinsicHigh)}`} />
            <Line k="Fair value (buy ≤)" v={money(s.fairPrice)} />
            <Line k="Deep-bargain (buy ≤)" v={money(s.bargainPrice)} />
            {s.assumptions && (
              <Line
                k="Growth bracket used"
                v={`${(s.assumptions.growthLow * 100).toFixed(0)}–${(s.assumptions.growthHigh * 100).toFixed(0)}% · disc ${(s.assumptions.discountRate * 100).toFixed(0)}%`}
              />
            )}
          </dl>
        ) : (
          <p className="mt-3 text-xs text-muted">Not valued — insufficient or non-positive owner earnings.</p>
        )}
      </div>
      <div>
        <p className="label">Screen</p>
        {s?.rejections.length ? (
          <ul className="mt-3 space-y-1.5 text-xs text-paper/80">
            {s.rejections.map((rej, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted">✕</span> {rej}
              </li>
            ))}
          </ul>
        ) : s?.verdict === "pass" ? (
          <p className="mt-3 text-xs text-volt">Clears every quality screen.</p>
        ) : (
          <p className="mt-3 text-xs text-muted">Insufficient data to screen.</p>
        )}
        <p className="mt-4 font-mono text-[0.65rem] leading-relaxed text-muted">
          Auto-extracted from EDGAR — verify against the actual 10-K before
          acting. Owner earnings use a 3-yr FCF average; growth is capped at 10%.
        </p>
      </div>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right text-paper/90">{v}</dd>
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: Scored["verdict"] }) {
  const map = {
    pass: { t: "Pass", c: "text-volt border-volt/40" },
    reject: { t: "Reject", c: "text-muted border-line" },
    insufficient: { t: "No data", c: "text-muted border-line" },
  } as const;
  const m = map[verdict];
  return <span className={`rounded-full border px-2 py-0.5 font-mono text-[0.6rem] uppercase ${m.c}`}>{m.t}</span>;
}

function LensButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-[0.12em] transition-colors ${
        active ? "bg-volt text-ink" : "text-muted hover:text-paper"
      }`}
    >
      {label}
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-line bg-ink-raised p-8">{children}</div>;
}
