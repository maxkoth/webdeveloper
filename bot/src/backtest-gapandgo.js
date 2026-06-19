// Gap-and-go FAIR TEST. Finds each day's ACTUAL top gappers, then trades the
// gap-and-go strategy on them. Reports in-sample vs out-of-sample.
//
//   npm run backtest:gap                         # curated ~120-name universe
//   GAP_FULL=1 npm run backtest:gap              # the WHOLE market (real gappers)
//   GAP_FULL=1 GAP_DAYS=120 npm run backtest:gap # more history = more trades
//   GAP_SLIPPAGE_BPS=30 GAP_FULL=1 npm run ...    # stress-test costs
//
// Honesty baked in: with the full universe the gappers are mostly small-caps,
// whose spreads are far wider than large-caps — so slippage DEFAULTS to 20bps in
// full mode (vs 5). Raise it further to see how fragile any edge is.

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

  const useFull = process.env.GAP_FULL === "1";
  const days = Number(process.env.GAP_DAYS) || config.backtestDays;
  // Small-cap gappers slip far more than large-caps; default full mode to 20bps.
  const defaultSlip = useFull ? 20 : config.strategies.slippageBps;
  const slipBps = process.env.GAP_SLIPPAGE_BPS != null ? Number(process.env.GAP_SLIPPAGE_BPS) : defaultSlip;
  // Optional FIXED percentage exits (e.g. GAP_TP_PCT=20 GAP_SL_PCT=7) that
  // override the strategy's ATR stop / 2R target. maxHold defaults higher when
  // using a fat % target so it has the session to get there.
  const tpPct = process.env.GAP_TP_PCT != null ? Number(process.env.GAP_TP_PCT) / 100 : null;
  const slPct = process.env.GAP_SL_PCT != null ? Number(process.env.GAP_SL_PCT) / 100 : null;
  const maxHold = Number(process.env.GAP_MAXHOLD) || (tpPct != null ? 390 : config.strategies.maxHoldBars);

  let universe = DAYTRADE_UNIVERSE;
  if (useFull) {
    if (!provider.getAssets) {
      console.error("Full universe needs the Alpaca provider.");
      process.exit(1);
    }
    console.log("Fetching the full tradable US equity universe…");
    universe = await provider.getAssets(config);
    const cap = Number(process.env.GAP_MAX_SYMBOLS) || 0;
    if (cap > 0) universe = universe.slice(0, cap);
  }

  const tz = config.session.timezone;
  const now = DateTime.now().setZone(tz);
  const fromMs = now.minus({ days: Math.ceil(days * 1.5) }).toMillis();
  const toMs = now.toMillis();
  const dateOf = (t) => DateTime.fromMillis(t, { zone: tz }).toISODate();

  const exitLabel = tpPct != null || slPct != null
    ? `exits: TP ${tpPct != null ? (tpPct * 100).toFixed(0) + "%" : "2R"} / SL ${slPct != null ? (slPct * 100).toFixed(0) + "%" : "ATR"} · hold ${maxHold}m`
    : `exits: ATR stop / 2R target`;
  console.log(
    `Gap-and-go fair test [${provider.name}/${config.alpaca.feed}] · universe ${universe.length} · ~${days} days\n` +
      `gap≥${(config.strategies.gapMin * 100).toFixed(0)}% · top ${config.gapTopK}/day · slippage=${slipBps}bps/side · ${exitLabel}\n`,
  );

  console.log("Fetching daily bars to find gappers… (full universe can take a few minutes)");
  const daily = await provider.getDailyBars(config, universe, fromMs, toMs);
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
      const entry = next.o * (1 + slipBps / 10000);
      const stop = slPct != null ? entry * (1 - slPct) : hit.setup.stop;
      const target = tpPct != null ? entry * (1 + tpPct) : hit.setup.target;
      const r = evaluateTrade(
        { entry, stop, target },
        session.reg.slice(hit.idx + 1),
        { maxHoldBars: maxHold, slippageBps: slipBps },
      );
      trades.push({ date, symbol: g.symbol, gapPct: g.gapPct, ...r });
    }
  }

  const is = summarize(trades.filter((t) => t.date < cutoff));
  const oos = summarize(trades.filter((t) => t.date >= cutoff));
  console.log("                IN-SAMPLE  trades win  expR   PF   |  OUT-OF-SAMPLE trades win  expR   PF");
  console.log("-".repeat(92));
  console.log(`Gap-and-go      ${fmt(is)}  | ${fmt(oos)}`);

  // Sample-size honesty: a positive expR on a handful of trades is meaningless.
  const verdict =
    oos.trades < 30
      ? `\n⚠ ONLY ${oos.trades} out-of-sample trades — NOT enough to conclude anything (need ~30+,\n  ideally 100+). Re-run with GAP_FULL=1 and a larger GAP_DAYS to grow the sample.`
      : oos.expectancyR > 0.05
        ? `\n${oos.trades} OOS trades, expR ${oos.expectancyR.toFixed(2)}. Encouraging at this slippage —\n  now stress it: bump GAP_SLIPPAGE_BPS up. If the edge survives realistic costs\n  AND a parameter sweep, THEN paper-trade. Still not proof, still not advice.`
        : `\n${oos.trades} OOS trades, expR ${oos.expectancyR.toFixed(2)} — not positive after costs. Verdict: stop.`;
  console.log(verdict);
  console.log("Reminder: only the OUT-OF-SAMPLE column counts, and a backtest still gets the\nbest fills. Shade it down. Not advice.");
}

main();
