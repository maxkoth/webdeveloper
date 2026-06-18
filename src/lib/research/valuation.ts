// Valuation engine.
//
// Every number shown on the research page is DERIVED from the explicit
// `Assumptions` in `picks.ts` by the pure functions below. Nothing is a magic
// constant typed into the UI. This is deliberate: the framework's first rule is
// "show every assumption — an unstated assumption is a hidden lie." Here the
// assumptions ARE the inputs, and the intrinsic value falls out of them, so the
// page can render the inputs next to the output and the reader can check the
// arithmetic. To re-value a business with fresh filing data, edit the
// assumptions; the value and buy-below price recompute.

export type Assumptions = {
  /** Normalized owner earnings, $B. Buffett's definition: net income + D&A
   *  − maintenance capex − incremental working capital, normalized across the
   *  cycle. NOT a single year's GAAP earnings. */
  ownerEarnings: number;
  /** Diluted shares outstanding, billions. */
  shares: number;
  /** Net cash (+) or net debt (−), $B. Added to enterprise value to get equity. */
  netCash: number;
  /** Required return for the Earnings Power Value (no-growth) method, e.g. 0.09. */
  requiredReturn: number;
  /** Discount rate for the DCF, e.g. 0.10. */
  discountRate: number;
  /** Conservative end of the 10-yr owner-earnings growth bracket, e.g. 0.05. */
  growthLow: number;
  /** Higher (still deliberately restrained) end of the growth bracket. */
  growthHigh: number;
  /** Projection horizon in years (the framework asks for 10). */
  years: number;
  /** Terminal growth rate, e.g. 0.03 (≈ long-run nominal GDP, never higher). */
  terminalGrowth: number;
};

export type Valuation = {
  /** Earnings Power Value per share: owner earnings ÷ required return, no growth.
   *  For a growing business this is a stark FLOOR, not a target. */
  epvPerShare: number;
  /** DCF per share at the conservative growth rate. */
  dcfLowPerShare: number;
  /** DCF per share at the higher growth rate. */
  dcfHighPerShare: number;
  /** Low end of the stated intrinsic-value RANGE (the conservative DCF). */
  intrinsicLow: number;
  /** High end of the intrinsic-value range. */
  intrinsicHigh: number;
  /** Buy-below price: ~65% of the LOW end of the range. The only honest
   *  "entry price" — the price at which a margin of safety exists. */
  buyBelow: number;
};

/** Margin-of-safety discount applied to the low end of the intrinsic range. */
export const MOS_DISCOUNT = 0.65;

/**
 * Two-stage DCF, computed year-by-year (no closed-form annuity) so it stays
 * correct even when growth approaches the discount rate. Owner earnings grow at
 * `growth` for `years`, then a Gordon terminal value at `terminalGrowth`.
 * Inputs in $B, shares in billions → result is per-share in dollars.
 */
export function dcfPerShare(a: Assumptions, growth: number): number {
  const { ownerEarnings, discountRate: r, years, terminalGrowth: tg, netCash, shares } = a;
  let pv = 0;
  for (let t = 1; t <= years; t++) {
    const cashFlow = ownerEarnings * Math.pow(1 + growth, t);
    pv += cashFlow / Math.pow(1 + r, t);
  }
  const terminalCashFlow = ownerEarnings * Math.pow(1 + growth, years) * (1 + tg);
  const terminalValue = terminalCashFlow / (r - tg);
  pv += terminalValue / Math.pow(1 + r, years);
  return (pv + netCash) / shares;
}

/** Earnings Power Value per share (perpetuity of normalized owner earnings). */
export function epvPerShare(a: Assumptions): number {
  return (a.ownerEarnings / a.requiredReturn + a.netCash) / a.shares;
}

export function valuation(a: Assumptions): Valuation {
  const epv = epvPerShare(a);
  const dcfLow = dcfPerShare(a, a.growthLow);
  const dcfHigh = dcfPerShare(a, a.growthHigh);
  const intrinsicLow = dcfLow;
  const intrinsicHigh = dcfHigh;
  return {
    epvPerShare: epv,
    dcfLowPerShare: dcfLow,
    dcfHighPerShare: dcfHigh,
    intrinsicLow,
    intrinsicHigh,
    buyBelow: intrinsicLow * MOS_DISCOUNT,
  };
}

/** Live margin of safety vs. the conservative intrinsic low. Positive = price
 *  is below intrinsic low. Returns null when price is unknown. */
export function marginOfSafety(price: number | null, v: Valuation): number | null {
  if (price == null || !isFinite(price) || price <= 0) return null;
  return (v.intrinsicLow - price) / v.intrinsicLow;
}

/** Gap from current price down to the buy-below price, as a fraction of
 *  buy-below. Positive = price still has to FALL this much to reach the entry. */
export function gapToBuyBelow(price: number | null, v: Valuation): number | null {
  if (price == null || !isFinite(price) || price <= 0) return null;
  return (price - v.buyBelow) / v.buyBelow;
}
