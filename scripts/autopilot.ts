/**
 * Autopilot runner. Runs ONE cycle: scan -> plan orders under the risk rails
 * -> place them through the chosen broker.
 *
 *   npm run autopilot                 # dry-run (default) — places nothing
 *   BROKER=ibkr npm run autopilot     # IBKR paper (port 7497) by default
 *   BROKER=ibkr IBKR_PORT=7496 IBKR_ALLOW_LIVE=1 npm run autopilot   # LIVE
 *
 * Safety: the broker defaults to dry-run; IBKR defaults to the PAPER port; a
 * live port additionally requires IBKR_ALLOW_LIVE=1. Risk limits come from env
 * (see .env.example / SCANNER.md). Requires IB Gateway or TWS running locally
 * for any IBKR mode.
 */
import { runScan } from "../src/lib/scanner/scan";
import { runCycle } from "../src/lib/autopilot/engine";
import { loadRiskConfig } from "../src/lib/autopilot/risk";
import { DryRunBroker } from "../src/lib/broker/dryrun";
import type { BrokerAdapter } from "../src/lib/broker/types";

async function makeBroker(): Promise<BrokerAdapter> {
  if ((process.env.BROKER ?? "dryrun").toLowerCase() === "ibkr") {
    const { IbkrBroker } = await import("../src/lib/broker/ibkr");
    return new IbkrBroker();
  }
  const startEquity = Number(process.env.DRYRUN_EQUITY ?? 100_000);
  return new DryRunBroker(startEquity, process.env.STATE_FILE);
}

async function main() {
  const cfg = loadRiskConfig();
  const broker = await makeBroker();
  // `--plan` forces plan-only even on a live broker (nothing is submitted).
  const execute = !process.argv.includes("--plan");

  console.log(`Autopilot cycle — broker: ${broker.mode}${execute ? "" : " (plan-only)"}`);
  console.log(
    `Risk: maxPos ${pct(cfg.maxPositionPct)}, maxDeployed ${pct(cfg.maxTotalDeployedPct)}, ` +
      `risk/trade ${pct(cfg.riskPerTradePct)}, dailyHalt ${pct(cfg.dailyLossHaltPct)}, ` +
      `maxOpen ${cfg.maxOpenPositions}, minScore ${cfg.minScore}`,
  );

  const scan = await runScan();
  const rep = await runCycle({ scan, broker, config: cfg, execute });

  console.log(`\nEquity: $${rep.equity.toFixed(0)} | open: ${rep.openPositions} | considered: ${rep.considered}`);
  if (rep.haltedByKillSwitch) console.log("HALTED by kill-switch.");
  if (rep.planned.length) {
    console.log("Planned:");
    rep.planned.forEach((p) =>
      console.log(
        `  ${p.order.symbol}  ${p.order.qty} sh @ $${p.order.limitPrice}  ` +
          `stop ${p.order.stopLoss}  tgt ${p.order.takeProfit}  ` +
          `($${p.estCost.toFixed(0)}, ${p.source}, score ${p.score})`,
      ),
    );
  } else {
    console.log("Planned: (none qualified)");
  }
  if (rep.skipped.length) {
    console.log("Skipped:");
    rep.skipped.forEach((s) => console.log(`  ${s.symbol}: ${s.reason}`));
  }
  rep.notes.forEach((n) => console.log(`note: ${n}`));
  console.log(`\nPlaced: ${rep.placed} order(s) via ${rep.mode}.`);
  console.log("Not financial advice. Validate on paper before risking real money.");
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

main().catch((err) => {
  console.error("Autopilot failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
