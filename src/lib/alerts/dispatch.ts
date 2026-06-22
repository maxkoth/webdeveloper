// Turns a scan result into the two kinds of alerts you asked for and sends
// them over SMS:
//   - "digest":    once-a-day top setups text
//   - "threshold": fires when a name scores >= ALERT_SCORE (default 80)
//
// Threshold alerts dedupe against a small JSON state file (when STATE_FILE is
// set) so an intraday cron doesn't text you about the same name every run on
// the same day. Without a state file it dedupes within the single run only.

import { promises as fs } from "node:fs";
import { sendSms, smsConfigured, type SmsResult } from "./twilio";
import type { ScanResult, Setup } from "@/lib/scanner/types";

export type AlertMode = "digest" | "threshold";

export type DispatchOutcome = {
  mode: AlertMode;
  configured: boolean;
  source: ScanResult["source"];
  candidates: number; // setups that qualified to be alerted
  sent: boolean;
  detail: string;
};

const SCORE_THRESHOLD = () => Number(process.env.ALERT_SCORE ?? 80);

export async function dispatchAlerts(
  scan: ScanResult,
  mode: AlertMode,
): Promise<DispatchOutcome> {
  const configured = smsConfigured();

  if (mode === "digest") {
    const top = scan.setups.slice(0, 5);
    const body = digestMessage(scan, top);
    return finish(mode, scan, top.length, configured, () => sendSms(body));
  }

  // threshold
  const threshold = SCORE_THRESHOLD();
  const hot = scan.setups.filter((s) => s.score >= threshold);
  const fresh = await filterAlreadySent(hot);
  if (fresh.length === 0) {
    return {
      mode,
      configured,
      source: scan.source,
      candidates: 0,
      sent: false,
      detail: `No new setups at/above ${threshold}.`,
    };
  }
  const body = thresholdMessage(threshold, fresh);
  const outcome = await finish(mode, scan, fresh.length, configured, () =>
    sendSms(body),
  );
  if (outcome.sent) await rememberSent(fresh);
  return outcome;
}

async function finish(
  mode: AlertMode,
  scan: ScanResult,
  candidates: number,
  configured: boolean,
  send: () => Promise<SmsResult>,
): Promise<DispatchOutcome> {
  if (candidates === 0) {
    return {
      mode,
      configured,
      source: scan.source,
      candidates,
      sent: false,
      detail: "Nothing to send.",
    };
  }
  if (!configured) {
    return {
      mode,
      configured,
      source: scan.source,
      candidates,
      sent: false,
      detail: "SMS not configured (set TWILIO_* and ALERT_TO) — message not sent.",
    };
  }
  const res = await send();
  return {
    mode,
    configured,
    source: scan.source,
    candidates,
    sent: res.ok,
    detail: res.ok ? `Sent (sid ${res.sid}).` : `Send failed: ${res.reason}`,
  };
}

// ---- message formatting (kept short; SMS segments are 160 chars) ----------

function digestMessage(scan: ScanResult, top: Setup[]): string {
  const tag = scan.source === "sample" ? " [SAMPLE]" : "";
  const lines = top.map(
    (s) =>
      `${s.symbol} ${s.score} ${s.kind} ${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%`,
  );
  return [`Top setups${tag}:`, ...lines, "Not advice. DYOR."].join("\n");
}

function thresholdMessage(threshold: number, hot: Setup[]): string {
  const lines = hot.map(
    (s) => `${s.symbol} ${s.score} ${s.kind} @ $${s.price.toFixed(2)}`,
  );
  return [`Setup alert (>=${threshold}):`, ...lines, "Not advice. DYOR."].join(
    "\n",
  );
}

// ---- dedupe state ---------------------------------------------------------

type SentState = { date: string; symbols: string[] };

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readState(): Promise<SentState> {
  const path = process.env.STATE_FILE;
  if (!path) return { date: today(), symbols: [] };
  try {
    const raw = await fs.readFile(path, "utf8");
    const parsed = JSON.parse(raw) as SentState;
    // A new day wipes the slate so you get fresh alerts each session.
    return parsed.date === today() ? parsed : { date: today(), symbols: [] };
  } catch {
    return { date: today(), symbols: [] };
  }
}

async function filterAlreadySent(setups: Setup[]): Promise<Setup[]> {
  const state = await readState();
  const seen = new Set(state.symbols);
  return setups.filter((s) => !seen.has(s.symbol));
}

async function rememberSent(setups: Setup[]): Promise<void> {
  const path = process.env.STATE_FILE;
  if (!path) return;
  const state = await readState();
  const symbols = Array.from(
    new Set([...state.symbols, ...setups.map((s) => s.symbol)]),
  );
  try {
    await fs.writeFile(path, JSON.stringify({ date: today(), symbols }));
  } catch {
    // Non-fatal: worst case is a duplicate alert later.
  }
}
