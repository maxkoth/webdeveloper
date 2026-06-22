// Autopilot engine. Turns the scanner's setups (and optional pilot targets)
// into concrete bracket orders, applying every risk rail along the way, then
// hands them to whatever broker adapter it's given — dry-run or live. The
// engine never imports a broker implementation, so it can't accidentally place
// a real order: the caller decides which adapter to pass in.

import { promises as fs } from "node:fs";
import type { BracketOrder, BrokerAdapter } from "@/lib/broker/types";
import type { ScanResult, Setup } from "@/lib/scanner/types";
import { defaultPilot, type PilotSource } from "./pilot";
import {
  killSwitchTriggered,
  loadRiskConfig,
  remainingDeployable,
  sizePosition,
  type RiskConfig,
} from "./risk";

export type PlannedTrade = {
  order: BracketOrder;
  score: number;
  source: string;
  estCost: number;
};

export type CycleReport = {
  mode: string;
  haltedByKillSwitch: boolean;
  equity: number;
  openPositions: number;
  considered: number;
  planned: PlannedTrade[];
  skipped: { symbol: string; reason: string }[];
  placed: number;
  notes: string[];
};

export type CycleOptions = {
  scan: ScanResult;
  broker: BrokerAdapter;
  config?: RiskConfig;
  pilot?: PilotSource;
  /** When false, plan and report but place nothing (extra safety on top of dry-run). */
  execute?: boolean;
};

/** Track day-start equity so the kill-switch has a baseline. */
type DayMark = { date: string; equity: number };

export async function runCycle(opts: CycleOptions): Promise<CycleReport> {
  const cfg = opts.config ?? loadRiskConfig();
  const pilot = opts.pilot ?? defaultPilot;
  const notes: string[] = [];
  const skipped: { symbol: string; reason: string }[] = [];

  await opts.broker.connect();
  const account = await opts.broker.getAccount();
  const positions = await opts.broker.getPositions();
  const held = new Set(positions.map((p) => p.symbol));

  // Kill-switch: compare to the equity recorded at the start of today.
  const dayStart = await dayStartEquity(account.equity);
  const halted = killSwitchTriggered(dayStart, account.equity, cfg);
  if (halted) {
    notes.push(
      `KILL-SWITCH: equity ${account.equity.toFixed(0)} vs day-start ` +
        `${dayStart.toFixed(0)} breaches ${(cfg.dailyLossHaltPct * 100).toFixed(1)}% — no new entries.`,
    );
    await opts.broker.disconnect();
    return report(opts.broker.mode, true, account.equity, held.size, 0, [], skipped, 0, notes);
  }

  // Candidate setups: scanner picks above the score floor + any pilot targets.
  const candidates = await buildCandidates(opts.scan, pilot, cfg, notes);

  // Budget: how much more we can deploy without breaching the total cap.
  const invested = positions.reduce((s, p) => s + p.qty * p.avgPrice, 0);
  let budget = remainingDeployable(account.equity, invested, cfg);
  let openSlots = cfg.maxOpenPositions - held.size;

  const planned: PlannedTrade[] = [];
  for (const c of candidates) {
    if (openSlots <= 0) {
      skipped.push({ symbol: c.symbol, reason: "max open positions reached" });
      continue;
    }
    if (held.has(c.symbol)) {
      skipped.push({ symbol: c.symbol, reason: "already held" });
      continue;
    }
    const qty = sizePosition(account.equity, c.entry, c.stop, cfg);
    if (qty <= 0) {
      skipped.push({ symbol: c.symbol, reason: "risk sizing -> 0 shares" });
      continue;
    }
    const estCost = qty * c.entry;
    if (estCost > budget) {
      skipped.push({ symbol: c.symbol, reason: "total-deployed cap reached" });
      continue;
    }

    planned.push({
      score: c.score,
      source: c.source,
      estCost,
      order: {
        symbol: c.symbol,
        side: "BUY",
        qty,
        entryType: "LMT",
        limitPrice: round(c.entry),
        stopLoss: round(c.stop),
        takeProfit: round(c.target),
      },
    });
    budget -= estCost;
    openSlots -= 1;
  }

  // Place (or not). `execute` defaults to true; a dry-run broker still places
  // nothing real, so live placement requires BOTH execute=true AND a live broker.
  let placed = 0;
  if (opts.execute !== false) {
    for (const p of planned) {
      await opts.broker.placeBracket(p.order);
      placed++;
    }
  } else {
    notes.push("execute=false — planned only, nothing submitted.");
  }

  await opts.broker.disconnect();
  return report(
    opts.broker.mode,
    false,
    account.equity,
    held.size,
    candidates.length,
    planned,
    skipped,
    placed,
    notes,
  );
}

type Candidate = {
  symbol: string;
  score: number;
  entry: number;
  stop: number;
  target: number;
  source: string;
};

async function buildCandidates(
  scan: ScanResult,
  pilot: PilotSource,
  cfg: RiskConfig,
  notes: string[],
): Promise<Candidate[]> {
  // Strategy 1 — the scanner's setups above the score floor.
  const fromScanner: Candidate[] = scan.setups
    .filter((s) => s.score >= cfg.minScore)
    .map((s: Setup) => ({
      symbol: s.symbol,
      score: s.score,
      entry: s.plan.entryZone,
      stop: s.plan.stop,
      target: s.plan.target,
      source: `scanner:${s.kind}`,
    }));
  if (scan.source === "sample") {
    notes.push("Scanner is on SAMPLE data — orders are illustrative, not live.");
  }

  // Strategy 2 — pilot copy-trade targets (no-op unless a feed is configured).
  let fromPilot: Candidate[] = [];
  try {
    const targets = await pilot.fetchTargets();
    fromPilot = targets.map((t) => ({
      symbol: t.symbol,
      score: cfg.minScore, // pilot picks bypass the scanner score; treat as floor
      // Without a live quote here we can't set true levels; use placeholders the
      // broker/limit logic will refine. Pilot sleeve uses wider, weight-based risk.
      entry: 0,
      stop: 0,
      target: 0,
      source: t.reason,
    }));
    if (targets.length) notes.push(`Pilot "${pilot.name}" contributed ${targets.length} targets.`);
  } catch {
    notes.push("Pilot source errored — skipped.");
  }
  // Pilot candidates need real levels to be sizable; drop any without them so we
  // never place an unsized order. (Wire quotes into the pilot feed to enable.)
  fromPilot = fromPilot.filter((c) => c.entry > 0 && c.stop > 0);

  // Highest-conviction first.
  return [...fromScanner, ...fromPilot].sort((a, b) => b.score - a.score);
}

async function dayStartEquity(currentEquity: number): Promise<number> {
  const path = process.env.DAYMARK_FILE;
  const today = new Date().toISOString().slice(0, 10);
  if (!path) return currentEquity; // no persistence -> no intraday baseline
  try {
    const mark = JSON.parse(await fs.readFile(path, "utf8")) as DayMark;
    if (mark.date === today && mark.equity > 0) return mark.equity;
  } catch {
    // fall through and seed below
  }
  try {
    await fs.writeFile(path, JSON.stringify({ date: today, equity: currentEquity }));
  } catch {
    /* non-fatal */
  }
  return currentEquity;
}

function report(
  mode: string,
  halted: boolean,
  equity: number,
  openPositions: number,
  considered: number,
  planned: PlannedTrade[],
  skipped: { symbol: string; reason: string }[],
  placed: number,
  notes: string[],
): CycleReport {
  return { mode, haltedByKillSwitch: halted, equity, openPositions, considered, planned, skipped, placed, notes };
}

const round = (n: number) => Math.round(n * 100) / 100;
