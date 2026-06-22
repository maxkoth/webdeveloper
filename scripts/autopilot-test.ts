/**
 * Offline self-test for the autopilot's safety logic — runs with no network and
 * no broker. Verifies position sizing honours BOTH caps, the kill-switch fires
 * at the threshold, and a full dry-run cycle plans sane, deduped orders.
 *
 *   npx tsx scripts/autopilot-test.ts
 */
import {
  killSwitchTriggered,
  remainingDeployable,
  sizePosition,
  type RiskConfig,
} from "../src/lib/autopilot/risk";
import { runCycle } from "../src/lib/autopilot/engine";
import { DryRunBroker } from "../src/lib/broker/dryrun";
import { runScan } from "../src/lib/scanner/scan";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  console.log(`  ${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
}

const cfg: RiskConfig = {
  maxPositionPct: 0.05,
  maxTotalDeployedPct: 0.25,
  riskPerTradePct: 0.01,
  dailyLossHaltPct: 0.03,
  maxOpenPositions: 10,
  minScore: 70,
};

console.log("Position sizing:");
// equity 100k, entry 100, stop 95 -> per-share risk 5. Risk budget = 1% = $1000
// -> 200 shares by risk. Notional cap = 5% = $5000 / 100 = 50 shares. Cap wins.
{
  const q = sizePosition(100_000, 100, 95, cfg);
  check("notional cap binds (50 sh)", q === 50, `got ${q}`);
}
// Tight stop (entry 100, stop 99.5 -> risk 0.5). Risk budget 1000 / 0.5 = 2000
// shares, but notional cap still 50. Cap binds again.
{
  const q = sizePosition(100_000, 100, 99.5, cfg);
  check("cap still binds on tight stop (50 sh)", q === 50, `got ${q}`);
}
// Wide stop (entry 100, stop 80 -> risk 20). Risk budget 1000/20 = 50 shares.
// Notional cap 50. Both equal here; risk-based must not exceed cap.
{
  const q = sizePosition(100_000, 100, 70, cfg); // risk 30 -> 33 sh by risk
  check("risk budget binds on wide stop (33 sh)", q === 33, `got ${q}`);
}
// Unsafe inputs -> 0 (skip, never throw).
check("stop>=entry -> 0", sizePosition(100_000, 100, 100, cfg) === 0);
check("zero equity -> 0", sizePosition(0, 100, 95, cfg) === 0);

console.log("\nKill-switch & budget:");
check("halts at -3%", killSwitchTriggered(100_000, 97_000, cfg) === true);
check("ok at -2.9%", killSwitchTriggered(100_000, 97_100, cfg) === false);
check("unknown baseline fails closed", killSwitchTriggered(0, 50_000, cfg) === true);
check(
  "deployable respects cap",
  remainingDeployable(100_000, 20_000, cfg) === 5_000,
  `got ${remainingDeployable(100_000, 20_000, cfg)}`,
);

(async () => {
  console.log("\nDry-run cycle (sample scan):");
  const scan = await runScan({ sample: true });
  const broker = new DryRunBroker(100_000);
  const rep = await runCycle({ scan, broker, config: cfg });

  check("cycle not halted", rep.haltedByKillSwitch === false);
  check("planned some orders", rep.planned.length > 0, `${rep.planned.length} planned`);
  check(
    "respects max open positions",
    rep.planned.length <= cfg.maxOpenPositions,
  );
  // Total estimated cost must respect the 25% deployment ceiling.
  const totalCost = rep.planned.reduce((s, p) => s + p.estCost, 0);
  check(
    "total deployed <= 25% of equity",
    totalCost <= 100_000 * cfg.maxTotalDeployedPct + 1,
    `$${totalCost.toFixed(0)}`,
  );
  // Every planned order must have a stop strictly below entry.
  check(
    "all stops below entry",
    rep.planned.every((p) => p.order.stopLoss < (p.order.limitPrice ?? 0)),
  );
  // No symbol planned twice.
  const syms = rep.planned.map((p) => p.order.symbol);
  check("no duplicate symbols", new Set(syms).size === syms.length);

  console.log(
    failures === 0
      ? "\nAll autopilot self-tests passed."
      : `\n${failures} autopilot self-test(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
})();
