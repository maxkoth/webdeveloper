// Risk engine. Every limit is env-configurable (you said you'd set your own),
// with conservative defaults so a missing value never means "unlimited". This
// module decides position size and whether trading should halt — it is the
// difference between an autopilot and a money shredder, so it fails CLOSED:
// any ambiguity returns the safest (smallest / halted) outcome.

export type RiskConfig = {
  /** Max fraction of equity in a single position (0.05 = 5%). */
  maxPositionPct: number;
  /** Max fraction of equity deployed across all autopilot positions. */
  maxTotalDeployedPct: number;
  /** Fraction of equity risked per trade on the entry→stop distance. */
  riskPerTradePct: number;
  /** Halt all new entries if account drops this fraction intraday. */
  dailyLossHaltPct: number;
  /** Hard cap on number of open positions. */
  maxOpenPositions: number;
  /** Only trade setups scoring at/above this. */
  minScore: number;
};

const numEnv = (key: string, fallback: number): number => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/** Load limits from the environment. Conservative, overridable defaults. */
export function loadRiskConfig(): RiskConfig {
  return {
    maxPositionPct: numEnv("MAX_POSITION_PCT", 0.05),
    maxTotalDeployedPct: numEnv("MAX_TOTAL_DEPLOYED_PCT", 0.25),
    riskPerTradePct: numEnv("RISK_PER_TRADE_PCT", 0.01),
    dailyLossHaltPct: numEnv("DAILY_LOSS_HALT_PCT", 0.03),
    maxOpenPositions: Math.floor(numEnv("MAX_OPEN_POSITIONS", 10)),
    minScore: numEnv("AUTOPILOT_MIN_SCORE", 70),
  };
}

/**
 * Whole-share quantity for one entry, bounded by BOTH the per-trade risk budget
 * and the per-position cap — whichever is smaller wins. Returns 0 when the
 * inputs are unsafe (e.g. stop above entry), so a bad setup is simply skipped.
 */
export function sizePosition(
  equity: number,
  entry: number,
  stop: number,
  cfg: RiskConfig,
): number {
  if (!(equity > 0) || !(entry > 0) || !(stop > 0) || stop >= entry) return 0;

  // 1. Risk-based size: how many shares put `riskPerTradePct` of equity at risk
  //    over the entry→stop distance.
  const perShareRisk = entry - stop;
  const riskBudget = equity * cfg.riskPerTradePct;
  const riskShares = Math.floor(riskBudget / perShareRisk);

  // 2. Notional cap: never let one position exceed `maxPositionPct` of equity.
  const capShares = Math.floor((equity * cfg.maxPositionPct) / entry);

  return Math.max(0, Math.min(riskShares, capShares));
}

/** True when the daily drawdown breaches the halt threshold. */
export function killSwitchTriggered(
  dayStartEquity: number,
  currentEquity: number,
  cfg: RiskConfig,
): boolean {
  if (!(dayStartEquity > 0)) return true; // unknown baseline -> fail closed
  const drawdown = (dayStartEquity - currentEquity) / dayStartEquity;
  return drawdown >= cfg.dailyLossHaltPct;
}

/** Capital still deployable without breaching the total-exposure cap. */
export function remainingDeployable(
  equity: number,
  currentInvested: number,
  cfg: RiskConfig,
): number {
  const ceiling = equity * cfg.maxTotalDeployedPct;
  return Math.max(0, ceiling - currentInvested);
}
