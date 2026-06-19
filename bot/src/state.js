// Alert de-duplication. Keeps the bot from texting the same setup repeatedly.
// In-memory with optional JSON persistence so a restart mid-session doesn't
// re-fire everything.

import { readFileSync, writeFileSync, existsSync } from "node:fs";

export class AlertState {
  constructor(cooldownMin, file = ".alert-state.json") {
    this.cooldownMs = cooldownMin * 60_000;
    this.file = file;
    this.sent = new Map(); // key -> last sent epoch ms
    if (existsSync(file)) {
      try {
        const raw = JSON.parse(readFileSync(file, "utf8"));
        for (const [k, v] of Object.entries(raw)) this.sent.set(k, v);
      } catch {
        /* start fresh on a corrupt file */
      }
    }
  }

  key(setup) {
    return `${setup.symbol}:${setup.type}`;
  }

  /** True if this setup is outside its cooldown and may be alerted. */
  allow(setup, now = Date.now()) {
    const last = this.sent.get(this.key(setup));
    return last == null || now - last >= this.cooldownMs;
  }

  mark(setup, now = Date.now()) {
    this.sent.set(this.key(setup), now);
    this._prune(now);
    this._persist();
  }

  _prune(now) {
    for (const [k, t] of this.sent) {
      if (now - t > this.cooldownMs * 4) this.sent.delete(k);
    }
  }

  _persist() {
    try {
      writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.sent)));
    } catch {
      /* persistence is best-effort */
    }
  }
}
