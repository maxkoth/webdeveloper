/**
 * Alert runner for schedulers (GitHub Actions / cron). Runs a fresh scan and
 * sends the requested alert over SMS — no web server required.
 *
 *   npx tsx scripts/run-alerts.ts digest
 *   npx tsx scripts/run-alerts.ts threshold
 *
 * Needs FINNHUB_API_KEY (optional, for news), TWILIO_* + ALERT_TO (to text),
 * and respects ALERT_SCORE / STATE_FILE / MARKET_HOURS_ONLY.
 */
import { runScan } from "../src/lib/scanner/scan";
import { dispatchAlerts, type AlertMode } from "../src/lib/alerts/dispatch";

/** Skip outside US cash-session hours when MARKET_HOURS_ONLY=1 (UTC-based). */
function withinMarketHours(): boolean {
  if (process.env.MARKET_HOURS_ONLY !== "1") return true;
  const now = new Date();
  const day = now.getUTCDay(); // 0 Sun .. 6 Sat
  if (day === 0 || day === 6) return false;
  const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
  // ~13:30–20:00 UTC ≈ 9:30–16:00 ET (ignoring DST nuance; widen if needed).
  return mins >= 13 * 60 + 30 && mins <= 20 * 60;
}

async function main() {
  const mode = (process.argv[2] ?? "digest") as AlertMode;
  if (mode !== "digest" && mode !== "threshold") {
    console.error("usage: run-alerts.ts <digest|threshold>");
    process.exit(1);
  }
  if (mode === "threshold" && !withinMarketHours()) {
    console.log("Outside market hours — skipping threshold run.");
    return;
  }

  const scan = await runScan();
  const outcome = await dispatchAlerts(scan, mode);
  console.log(JSON.stringify(outcome, null, 2));
  // Surface a send failure as a non-zero exit so the Action shows red.
  if (outcome.candidates > 0 && outcome.configured && !outcome.sent) {
    process.exit(1);
  }
}

main();
