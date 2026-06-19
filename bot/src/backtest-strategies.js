// Backtest the day-trade strategy hypotheses and report IN-SAMPLE vs
// OUT-OF-SAMPLE results side by side. The whole point: a strategy that looks
// great in-sample but dies out-of-sample is overfit noise. We keep only what
// stays positive on the held-out (right-hand) numbers.
//
//   npm run backtest:strategies                 # default symbols
//   npm run backtest:strategies AAPL TSLA ...    # custom symbols

import { DateTime } from "luxon";
import { config, validateConfig } from "./config.js";
import { makeProvider } from "./providers/index.js";
import { STRATEGIES, buildSession } from "./strategies.js";
import { evaluateTrade, summarize } from "./backtest.js";

// Volatile, frequently-gapping names give the gap strategies something to chew
// on. (A *proper* gap-and-go test needs each day's actual gapper list — a fixed
// roster understates trade count. See the note printed at the end.)
const DEFAULT_SYMBOLS = [
  "TSLA", "NVDA", "AMD", "PLTR", "COIN", "MARA", "RIOT", "SOFI", "SMCI", "AFRM",
  "RBLX", "DKNG", "UPST", "CVNA", "ENPH", "LCID", "RIVN", "NIO", "HOOD",
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

function fmt(s) {
  return (
    `${String(s.trades).padStart(4)}  ` +
    `${(s.winRate * 100).toFixed(0).padStart(3)}%  ` +
    `${s.expectancyR >= 0 ? "+" : ""}${s.expectancyR.toFixed(2)}  ` +
    `PF ${s.profitFactor === Infinity ? "inf" : s.profitFactor.toFixed(2)}`
  );
}

async function main() {
  const problems = validateConfig({ ...config, mode: "dry-run" });
  if (problems.length) {
    console.error("Config problems:\n - " + problems.join("\n - "));
    process.exit(1);
  }
  const args = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const symbols = args.length ? args.map((s) => s.toUpperCase()) : DEFAULT_SYMBOLS;
  const provider = makeProvider(config);
  const days = recentTradingDays(config.backtestDays, config.session.timezone);
  const cutoff = days[Math.floor(days.length * (1 - config.oosFraction))]?.toISODate();

  console.log(
    `Strategy backtest [${provider.name}/${config.alpaca.feed}] · ${symbols.length} symbols · ${days.length} days\n` +
      `slippage=${config.strategies.slippageBps}bps/side · out-of-sample = days on/after ${cutoff}\n`,
  );

  const results = {};
  for (const name of Object.keys(STRATEGIES)) results[name] = [];

  for (const sym of symbols) {
    let prevClose = null;
    for (const day of days) {
      const from = day.set({ hour: config.session.startHour }).toMillis();
      const to = day.set({ hour: config.session.endHour }).toMillis();
      let bars;
      try {
        bars = await provider.getBars(config, sym, from, to);
      } catch {
        continue;
      }
      const session = buildSession(sym, bars, prevClose, config);
      if (session) prevClose = session.lastClose;
      else if (bars.length) prevClose = bars[bars.length - 1].c;
      if (!session) continue;

      for (const [name, strat] of Object.entries(STRATEGIES)) {
        const hit = strat(session, config);
        if (!hit) continue;
        const next = session.reg[hit.idx + 1];
        if (!next) continue;
        const entry = next.o * (1 + config.strategies.slippageBps / 10000);
        const r = evaluateTrade(
          { entry, stop: hit.setup.stop, target: hit.setup.target },
          session.reg.slice(hit.idx + 1),
          { maxHoldBars: config.strategies.maxHoldBars, slippageBps: config.strategies.slippageBps },
        );
        results[name].push({ date: day.toISODate(), ...r });
      }
    }
  }

  console.log("Strategy            | IN-SAMPLE  trades win  expR   PF   | OUT-OF-SAMPLE trades win  expR   PF");
  console.log("-".repeat(100));
  for (const [name, trades] of Object.entries(results)) {
    const is = summarize(trades.filter((t) => t.date < cutoff));
    const oos = summarize(trades.filter((t) => t.date >= cutoff));
    console.log(`${name.padEnd(20)}| ${fmt(is)}  | ${fmt(oos)}`);
  }
  console.log(
    "\nHow to read this: ignore the left (in-sample) — it's where the rules were\n" +
      "set, so it flatters. Trust the RIGHT (out-of-sample). A strategy is only\n" +
      "interesting if expR stays meaningfully POSITIVE out-of-sample with enough\n" +
      "trades to matter. Most won't. Backtests still ignore the worst fills, so\n" +
      "shade everything down. Not advice.\n" +
      "NOTE: gap strategies undercount here — a fixed symbol list misses the day's\n" +
      "real gappers. Sparse gap-and-go results mean 'need a gapper universe', not\n" +
      "'no edge'.",
  );
}

main();
