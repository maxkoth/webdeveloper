// Long-term value BUY alerter. Calls the screener and texts quality businesses
// trading at/below their margin-of-safety price.
//   npm run value         — one check and exit
//   npm run value:watch   — checks twice a day on weekdays (value moves slowly)

import cron from "node-cron";
import { DateTime } from "luxon";
import { config } from "./config.js";
import { Notifier } from "./notifier.js";
import { AlertState } from "./state.js";
import { runValueScan } from "./value.js";

const _log = console.log.bind(console);
const _stamp = () => DateTime.now().setZone(config.session.timezone).toFormat("MM-dd HH:mm:ss");
console.log = (...a) => _log(`[${_stamp()}]`, ...a);
console.error = (...a) => _log(`[${_stamp()}] ERROR`, ...a);

async function main() {
  console.log("Value BUY alerter — quality businesses at/below their margin-of-safety price.");
  console.log("Model-flagged research candidates, NOT advice. Read the filing before buying.");
  if (config.mode === "live") {
    const missing = ["sid", "token", "from", "to"].filter((k) => !config.twilio[k]);
    if (missing.length) {
      console.error(`live mode needs Twilio: missing ${missing.join(", ")}`);
      process.exit(1);
    }
  } else {
    console.log("DRY-RUN: alerts print to console, no texts sent.\n");
  }

  const notifier = new Notifier(config);
  const valueState = new AlertState(config.value.cooldownHours * 60, ".value-alert-state.json");
  const deps = { notifier, valueState };

  const check = async () => {
    try {
      await runValueScan(config, deps);
    } catch (e) {
      console.error(`value error: ${e.message}`);
    }
  };

  if (process.argv.includes("--once")) {
    await check();
    return;
  }

  // 10:00 and 16:00 ET on weekdays — value doesn't need minute-by-minute checks.
  cron.schedule("0 10,16 * * 1-5", check, { timezone: config.session.timezone });
  console.log("Scheduled: 10:00 & 16:00 ET on weekdays. Ctrl+C to stop.");
  await check(); // run one now
}

main();
