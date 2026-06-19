// Gap-and-go FAIR TEST. Instead of a fixed symbol list, this finds each day's
// ACTUAL top gappers across a broad universe (from daily bars), then trades the
// gap-and-go strategy on them. Reports in-sample vs out-of-sample.
//
//   npm run backtest:gap
//
// Honest caveats baked into the output: the universe is a broad proxy (not
// literally every ticker), entries are the opening-range break AFTER 9:30 (the
// testable version — pure premarket entries are a worse game), and real
// premarket spreads are wider than the 5bps modeled, so shade results DOWN.

import { DateTime } from "luxon";
import { config, validateConfig } from "./config.js";
import { makeProvider } from "./providers/index.js";
import { buildSession, STRATEGIES } from "./strategies.js";
import { evaluateTrade, summarize } from "./backtest.js";
import { gapRows, topByDay } from "./gappers.js";
import { DAYTRADE_UNIVERSE } from "./universe-daytrade.js";

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
  const provider = makeProvider(config);
  if (!provider.getDailyBars) {
    console.error("The gap fair-test needs the Alpaca provider (set DATA_PROVIDER=alpaca).");
    process.exit(1);
  }
  const tz = config.session.timezone;
  const now = DateTime.now().setZone(tz);
  const fromMs = now.minus({ days: Math.ceil(config.backtestDays * 1.5) }).toMillis();
  const toMs = now.toMillis();
  const dateOf = (t) => DateTime.fromMillis(t, { zone: tz }).toISODate();

  console.log(
    `Gap-and-go fair test [${provider.name}/${config.alpaca.feed}] · universe ${DAYTRADE_UNIVERSE.length} · ~${config.backtestDays} days\n` +
      `gap≥${(config.strategies.gapMin * 100).toFixed(0)}% · top ${config.gapTopK}/day · slippage=${config.strategies.slippageBps}bps/side\n`,
  );

  console.log("Fetching daily bars to find gappers…");
  const daily = await provider.getDailyBars(config, DAYTRADE_UNIVERSE, fromMs, toMs);
  const byDay = topByDay(gapRows(daily), config, dateOf);
  const dates = [...byDay.keys()].sort();
  const totalGappers = [...byDay.values()].reduce((s, l) => s + l.length, 0);
  console.log(`Found ${totalGappers} gapper-days across ${dates.length} sessions. Trading each…\n`);

  const cutoff = dates[Math.floor(dates.length * (1 - config.oosFraction))];
  const trades = [];
  for (const date of dates) {
    const from = DateTime.fromISO(date, { zone: tz }).set({ hour: config.session.startHour }).toMillis();
    const to = DateTime.fromISO(date, { zone: tz }).set({ hour: config.session.endHour }).toMillis();
    for (const g of byDay.get(date)) {
      let bars;
      try {
        bars = await provider.getBars(config, g.symbol, from, to);
      } catch {
        continue;
      }
      const session = buildSession(g.symbol, bars, g.prevClose, config);
      if (!session) continue;
      const hit = STRATEGIES["Gap-and-go"](session, config);
      if (!hit) continue;
      const next = session.reg[hit.idx + 1];
      if (!next) continue;
      const entry = next.o * (1 + config.strategies.slippageBps / 10000);
      const r = evaluateTrade(
        { entry, stop: hit.setup.stop, target: hit.setup.target },
        session.reg.slice(hit.idx + 1),
        { maxHoldBars: config.strategies.maxHoldBars, slippageBps: config.strategies.slippageBps },
      );
      trades.push({ date, symbol: g.symbol, gapPct: g.gapPct, ...r });
    }
  }

  const is = summarize(trades.filter((t) => t.date < cutoff));
  const oos = summarize(trades.filter((t) => t.date >= cutoff));
  console.log("                IN-SAMPLE  trades win  expR   PF   |  OUT-OF-SAMPLE trades win  expR   PF");
  console.log("-".repeat(92));
  console.log(`Gap-and-go      ${fmt(is)}  | ${fmt(oos)}`);
  console.log(
    "\nVerdict rule: only the OUT-OF-SAMPLE (right) column counts, and only if expR\n" +
      "is clearly POSITIVE with enough trades. If it's negative or thin, gap-and-go\n" +
      "fails its fair test too — and that's the answer: stop. Not advice.",
  );
}

main();
