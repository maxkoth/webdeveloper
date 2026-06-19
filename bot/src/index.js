// Entry point. Runs the scanner on an interval during the 4am–8pm ET session.
// `--once` runs a single pass and exits (useful for testing / cron).

import cron from "node-cron";
import { config, validateConfig } from "./config.js";
import { getFullSnapshot, getIntradayBars, getMarketStatus } from "./polygon.js";
import { Notifier } from "./notifier.js";
import { AlertState } from "./state.js";
import { runScan } from "./scanner.js";
import { isWithinSession, nowET } from "./clock.js";

const BANNER = `
╔══════════════════════════════════════════════════════════════════╗
║  Play Scanner — ALERTS ONLY. It never places trades.             ║
║  Rule-based setups are NOT a proven edge and WILL produce noise.  ║
║  Paper-test for weeks before risking real money. Not advice.      ║
╚══════════════════════════════════════════════════════════════════╝`;

async function main() {
  console.log(BANNER);
  const problems = validateConfig(config);
  if (problems.length) {
    console.error("Config problems:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  console.log(
    `mode=${config.mode}  realtime=${config.polygon.realtime}  ` +
      `interval=${config.scanIntervalMin}m  session=${config.session.startHour}:00-${config.session.endHour}:00 ET`,
  );
  if (config.mode === "dry-run") console.log("DRY-RUN: alerts print to console, no texts sent.\n");

  const notifier = new Notifier(config);
  const state = new AlertState(config.alerts.cooldownMin);
  const deps = { getFullSnapshot, getIntradayBars, notifier, state };

  const scanOnce = async () => {
    try {
      await runScan(config, deps);
    } catch (e) {
      console.error(`scan error: ${e.message}`);
    }
  };

  if (process.argv.includes("--once")) {
    await scanOnce();
    return;
  }

  // Gate each tick on the session window and (when realtime) market status.
  const tick = async () => {
    const dt = nowET(config);
    if (!isWithinSession(config, dt)) return;
    if (config.polygon.realtime) {
      try {
        const st = await getMarketStatus(config.polygon.apiKey);
        if (st.market === "closed") return; // weekend/holiday safety net
      } catch {
        /* if status check fails, fall through and try the scan */
      }
    }
    await scanOnce();
  };

  // node-cron expression: every N minutes.
  cron.schedule(`*/${config.scanIntervalMin} * * * *`, tick, { timezone: config.session.timezone });
  console.log(`Scheduled. Scanning every ${config.scanIntervalMin}m during the session. Ctrl+C to stop.`);
  // Kick one immediately if we're already in-session.
  if (isWithinSession(config)) tick();
}

main();
