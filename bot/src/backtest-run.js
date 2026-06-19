// CLI: backtest the signal rules over recent history for a watchlist.
//   node src/backtest-run.js                 # default symbols, config.backtest.lookbackDays
//   node src/backtest-run.js AAPL TSLA NVDA   # custom symbols
//
// Uses the configured provider (Alpaca free/IEX works). Fetches each symbol's
// 1-min bars per trading day so VWAP resets daily, then scores every setup.

import { DateTime } from "luxon";
import { config, validateConfig } from "./config.js";
import { makeProvider } from "./providers/index.js";
import { backtestBars, summarize, summarizeByType } from "./backtest.js";

const DEFAULT_SYMBOLS = [
  "AAPL", "TSLA", "NVDA", "AMD", "META", "AMZN", "MSFT", "GOOGL",
  "NFLX", "COIN", "PLTR", "SOFI", "MARA", "RIOT", "SMCI", "AVGO",
];

function recentTradingDays(n, tz) {
  const days = [];
  let d = DateTime.now().setZone(tz).startOf("day");
  while (days.length < n) {
    if (d.weekday >= 1 && d.weekday <= 5) days.push(d);
    d = d.minus({ days: 1 });
  }
  return days.reverse();
}

async function main() {
  const problems = validateConfig({ ...config, mode: "dry-run" });
  if (problems.length) {
    console.error("Config problems:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  const symbols = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const watch = symbols.length ? symbols.map((s) => s.toUpperCase()) : DEFAULT_SYMBOLS;
  const provider = makeProvider(config);
  const days = recentTradingDays(config.backtest.lookbackDays, config.session.timezone);

  console.log(
    `Backtest [${provider.name}/${config.alpaca.feed}] · ${watch.length} symbols · ${days.length} days\n`,
  );

  const allTrades = [];
  for (const sym of watch) {
    let symTrades = [];
    for (const day of days) {
      const from = day.set({ hour: config.session.startHour }).toMillis();
      const to = day.set({ hour: config.session.endHour }).toMillis();
      try {
        const bars = await provider.getBars(config, sym, from, to);
        if (bars.length >= config.signals.minBars) symTrades = symTrades.concat(backtestBars(sym, bars, config));
      } catch (e) {
        console.error(`  ${sym} ${day.toISODate()}: ${e.message}`);
      }
    }
    const s = summarize(symTrades);
    if (s.trades) console.log(`  ${sym.padEnd(6)} ${fmt(s)}`);
    allTrades.push(...symTrades);
  }

  console.log("\n── By setup type ──");
  for (const [type, s] of Object.entries(summarizeByType(allTrades))) {
    console.log(`  ${type.padEnd(20)} ${fmt(s)}`);
  }
  console.log("\n── TOTAL ──");
  console.log(`  ${fmt(summarize(allTrades))}`);
  console.log(
    "\nReminder: positive expectancy on a SMALL sample is not proof. Use many days,\n" +
      "watch for overfitting, and remember backtests ignore slippage, fees, and the\n" +
      "fact that you can't always get the fill. Not advice.",
  );
}

function fmt(s) {
  return (
    `trades ${String(s.trades).padStart(4)}  ` +
    `win ${(s.winRate * 100).toFixed(0).padStart(3)}%  ` +
    `expR ${s.expectancyR >= 0 ? "+" : ""}${s.expectancyR.toFixed(2)}  ` +
    `PF ${s.profitFactor === Infinity ? "∞" : s.profitFactor.toFixed(2)}  ` +
    `totalR ${s.totalR >= 0 ? "+" : ""}${s.totalR.toFixed(1)}`
  );
}

main();
