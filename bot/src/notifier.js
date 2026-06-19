// Formats alerts into a text and sends via Twilio — or, in dry-run mode, prints
// to the console so you can tune things without spending a cent or spamming your
// phone. Handles two kinds of alert: long-term value BUYs and (parked,
// unvalidated) day-trade setups.

import twilio from "twilio";

const fmtP = (n) => (n == null || !isFinite(n) ? "—" : `$${Number(n).toFixed(2)}`);

export function formatAlert(a) {
  if (a.kind === "LONG-TERM BUY") {
    const lines = [`${a.symbol} — LONG-TERM BUY candidate`];
    if (a.name) lines.push(a.name);
    lines.push(`price ${fmtP(a.price)} · buy-below ${fmtP(a.buyBelow)} · fair ${fmtP(a.fair)}`);
    if (a.mos != null) lines.push(`${(a.mos * 100).toFixed(0)}% below intrinsic`);
    lines.push(`(model-flagged · verify the filing · not advice)`);
    return lines.join("\n");
  }
  // Day-trade setup (negative backtested edge — kept observation-only).
  const meta = [];
  if (a.meta?.volSurge != null) meta.push(`vol ${a.meta.volSurge}x`);
  if (a.meta?.changePct != null) meta.push(`${a.meta.changePct > 0 ? "+" : ""}${a.meta.changePct}%`);
  return (
    `${a.symbol}  ${a.type}  ⚠ UNVALIDATED (paper only)\n` +
    `entry ${a.entry}  SL ${a.stop}  TP ${a.target}  (${a.rr}R)` +
    (meta.length ? `\n${meta.join("  ")}` : "")
  );
}

// Back-compat alias (older callers import formatSetup).
export const formatSetup = formatAlert;

export class Notifier {
  constructor(cfg) {
    this.cfg = cfg;
    this.dryRun = cfg.mode !== "live";
    this.client = !this.dryRun ? twilio(cfg.twilio.sid, cfg.twilio.token) : null;
  }

  async send(alert) {
    const body = formatAlert(alert);
    if (this.dryRun) {
      console.log(`[DRY-RUN alert]\n${body}\n`);
      return { dryRun: true };
    }
    return this.client.messages.create({
      to: this.cfg.twilio.to,
      from: this.cfg.twilio.from,
      body,
    });
  }
}
