// Formats setups into a text and sends via Twilio — or, in dry-run mode, prints
// to the console so you can tune the scanner without spending a cent or spamming
// your phone.

import twilio from "twilio";

export function formatSetup(s) {
  // e.g. "AAPL  VWAP reclaim
  //       entry 150.20  SL 148.90  TP 152.80  (2R)
  //       RVOL 3.2x  +4.1%"
  const meta = [];
  if (s.meta?.volSurge != null) meta.push(`vol ${s.meta.volSurge}x`);
  if (s.meta?.changePct != null) meta.push(`${s.meta.changePct > 0 ? "+" : ""}${s.meta.changePct}%`);
  return (
    `${s.symbol}  ${s.type}\n` +
    `entry ${s.entry}  SL ${s.stop}  TP ${s.target}  (${s.rr}R)` +
    (meta.length ? `\n${meta.join("  ")}` : "")
  );
}

export class Notifier {
  constructor(cfg) {
    this.cfg = cfg;
    this.dryRun = cfg.mode !== "live";
    this.client = !this.dryRun ? twilio(cfg.twilio.sid, cfg.twilio.token) : null;
  }

  async send(setup) {
    const body = formatSetup(setup);
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
