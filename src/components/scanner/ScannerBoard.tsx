"use client";

// The interactive scanner surface. Hydrated with the server's first scan, it
// can re-run the scan against /api/scan, re-sort client-side, and expand any
// row to reveal exactly why it scored the way it did. All presentation — the
// ranking logic lives in src/lib/scanner.

import { useState } from "react";
import type { ScanResult, Setup } from "@/lib/scanner/types";
import { Sparkline } from "./Sparkline";

type SortKey = "score" | "changePct" | "relVolume";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Setup score" },
  { key: "changePct", label: "% change" },
  { key: "relVolume", label: "Rel. volume" },
];

export function ScannerBoard({ initial }: { initial: ScanResult }) {
  const [data, setData] = useState<ScanResult>(initial);
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function rescan() {
    setLoading(true);
    try {
      const res = await fetch("/api/scan", { cache: "no-store" });
      if (res.ok) setData((await res.json()) as ScanResult);
    } catch {
      // Keep the last good result on screen; the badge still reflects source.
    } finally {
      setLoading(false);
    }
  }

  const setups = [...data.setups].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div>
      <Toolbar
        data={data}
        sortKey={sortKey}
        onSort={setSortKey}
        onRescan={rescan}
        loading={loading}
      />

      <ol className="mt-8 flex flex-col gap-3">
        {setups.map((s, i) => (
          <SetupRow
            key={s.symbol}
            rank={i + 1}
            setup={s}
            open={expanded === s.symbol}
            onToggle={() =>
              setExpanded((cur) => (cur === s.symbol ? null : s.symbol))
            }
          />
        ))}
      </ol>

      {data.warnings.length > 0 && (
        <ul className="mt-6 flex flex-col gap-1">
          {data.warnings.map((w) => (
            <li key={w} className="label normal-case tracking-normal text-muted">
              ⚠ {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Toolbar({
  data,
  sortKey,
  onSort,
  onRescan,
  loading,
}: {
  data: ScanResult;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
  onRescan: () => void;
  loading: boolean;
}) {
  const time = new Date(data.generatedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
      <div className="flex items-center gap-3">
        <SourceBadge source={data.source} />
        <span className="label normal-case tracking-normal">
          {data.universeSize} scanned · {time}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label">Sort</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => onSort(s.key)}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors ${
              sortKey === s.key
                ? "border-volt bg-volt text-ink"
                : "border-line text-muted hover:text-paper"
            }`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={onRescan}
          disabled={loading}
          className="ml-2 rounded-full border border-volt px-4 py-1 font-mono text-xs font-medium text-volt transition-colors hover:bg-volt hover:text-ink disabled:opacity-50"
        >
          {loading ? "Scanning…" : "Re-scan"}
        </button>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: ScanResult["source"] }) {
  const live = source === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.7rem] uppercase tracking-wider ${
        live ? "bg-volt/15 text-volt" : "bg-paper/10 text-muted"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-volt" : "bg-muted"}`}
      />
      {live ? "Live data" : "Sample data"}
    </span>
  );
}

function SetupRow({
  rank,
  setup,
  open,
  onToggle,
}: {
  rank: number;
  setup: Setup;
  open: boolean;
  onToggle: () => void;
}) {
  const up = setup.changePct >= 0;
  return (
    <li className="overflow-hidden rounded-lg border border-line bg-ink-raised">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-paper/[0.03]"
      >
        <span className="w-6 shrink-0 font-mono text-sm text-muted">
          {String(rank).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-base font-medium">{setup.symbol}</span>
            <span className="truncate text-sm text-muted">{setup.name}</span>
          </div>
          <span className="label normal-case tracking-normal">{setup.kind}</span>
        </div>

        <Sparkline values={setup.spark} className="hidden shrink-0 sm:block" />

        <div className="hidden w-24 shrink-0 text-right md:block">
          <div className="font-mono text-sm">${setup.price.toFixed(2)}</div>
          <div
            className={`font-mono text-xs ${up ? "text-volt" : "text-muted"}`}
          >
            {up ? "+" : ""}
            {setup.changePct.toFixed(2)}%
          </div>
        </div>

        <ScoreDial score={setup.score} />
      </button>

      {open && <Breakdown setup={setup} />}
    </li>
  );
}

function ScoreDial({ score }: { score: number }) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center">
      <span className="display text-2xl text-volt">{score}</span>
      <span className="label text-[0.6rem]">score</span>
    </div>
  );
}

function Breakdown({ setup }: { setup: Setup }) {
  return (
    <div className="border-t border-line px-4 pb-5 pt-4">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="label mb-3">Why it scored</h4>
          <ul className="flex flex-col gap-3">
            {setup.dimensions.map((d) => (
              <li key={d.key}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs">{d.label}</span>
                  <span className="font-mono text-xs text-muted">
                    {Math.round(d.score * 100)}
                    <span className="text-[0.65rem]">/100 · w{d.weight}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper/10">
                  <div
                    className="h-full rounded-full bg-volt"
                    style={{ width: `${Math.round(d.score * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">{d.note}</p>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="label mb-3">Reference levels</h4>
          <dl className="flex flex-col gap-2 font-mono text-sm">
            <Row label="Sector" value={setup.sector} />
            <Row label="Rel. volume" value={`${setup.relVolume.toFixed(2)}×`} />
            <Row label="Support" value={`$${setup.levels.support.toFixed(2)}`} />
            <Row
              label="Resistance"
              value={`$${setup.levels.resistance.toFixed(2)}`}
            />
            <Row label="Entry zone" value={`$${setup.plan.entryZone.toFixed(2)}`} />
            <Row label="Stop (ref)" value={`$${setup.plan.stop.toFixed(2)}`} />
            <Row label="Target (ref)" value={`$${setup.plan.target.toFixed(2)}`} />
            <Row label="Reward : risk" value={`${setup.plan.rMultiple.toFixed(1)}R`} />
          </dl>
          <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">
            Reference levels derived from price structure &amp; ATR. Educational
            screening only — not a recommendation or financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-1">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
