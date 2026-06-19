// Entry point. Runs the scanner on an interval during the 4am–8pm ET session.
// `--once` runs a single pass and exits (useful for testing / cron).

import cron from "node-cron";
import { DateTime } from "luxon";
import { config, validateConfig } from "./config.js";
import { makeProvider } from "./providers/index.js";
import { Notifier } from "./notifier.js";
import { AlertState } from "./state.js";
import { runScan } from "./scanner.js";
import { isWithinSession, nowET } from "./clock.js";

// Prefix every log line with an ET timestamp so an overnight log file is
// reviewable ("when did this fire?").
const _log = console.log.bind(console);
const _stamp = () => DateTime.now().setZone(config.session.timezone).toFormat("MM-dd HH:mm:ss");
console.log = (...a) => _log(`[${_stamp()}]`, ...a);
console.error = (...a) => _log(`[${_stamp()}] ERROR`, ...a);

const BANNER = `
╔══════════════════════════════════════════════════════════════════╗
║  Play Scanner — ALERTS ONLY. It never places trades.             ║
║  Rule-based setups are NOT a proven edge and WILL produce noise.  ║
║  Backtest + paper-trade for weeks before risking real money.      ║
║  Not financial advice.                                           ║
╚══════════════════════════════════════════════════════════════════╝`;

async function main() {
  console.log(BANNER);
  const problems = validateConfig(config);
  if (problems.length) {
    console.error("Config problems:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  console.log(
    `provider=${config.dataProvider}  mode=${config.mode}  ` +
      `interval=${config.scanIntervalMin}m  session=${config.session.startHour}:00-${config.session.endHour}:00 ET`,
  );
  if (config.mode === "dry-run") console.log("DRY-RUN: alerts print to console, no texts sent.\n");

  const provider = makeProvider(config);
  const notifier = new Notifier(config);
  const state = new AlertState(config.alerts.cooldownMin);
  const deps = { provider, notifier, state };

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

  const tick = async () => {
    if (isWithinSession(config, nowET(config))) await scanOnce();
  };

  cron.schedule(`*/${config.scanIntervalMin} * * * *`, tick, { timezone: config.session.timezone });
  console.log(`Scheduled. Scanning every ${config.scanIntervalMin}m during the session. Ctrl+C to stop.`);
  console.log("Note: holidays are not detected — on a market holiday it simply finds nothing.");
  if (isWithinSession(config)) tick();
}

main();
