import type { Fundamentals } from "./edgar";
import { valuation, type Assumptions, type Valuation, MOS_DISCOUNT } from "./valuation";

// Turns raw fundamentals + a live price into a screen verdict and a valuation.
// Two "buy lines" support the two strategies the tool serves:
//   • bargainPrice  = MOS_DISCOUNT × intrinsic low  → strict deep-value entry.
//   • fairPrice     = intrinsic low                 → reasonable long-term entry
//                                                      for a quality business.
// All pure: same inputs → same output, so it can be unit-tested.

export type ScreenVerdict = "pass" | "reject" | "insufficient";

export type Scored = {
  // Screen
  verdict: ScreenVerdict;
  /** Reasons a candidate was rejected (empty when it passes). */
  rejections: string[];
  /** Quality metrics surfaced regardless of pass/fail, for the table. */
  roic: number | null;
  fcfMargin: number | null;
  netDebtToEbitda: number | null;
  revenueCAGR: number | null;
  fcfAllPositive: boolean;
  // Valuation (only when verdict !== "insufficient")
  assumptions: Assumptions | null;
  valuation: Valuation | null;
  fairPrice: number | null;
  bargainPrice: number | null;
  // Live
  marginOfSafety: number | null; // vs intrinsic low
  status: "bargain" | "fair" | "rich" | "n/a";
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Conservative valuation assumptions derived from history. Growth is bracketed
 *  by historical revenue/FCF CAGR and HARD-CAPPED at 10% so the model can never
 *  justify a price on heroic growth. Returns null if owner earnings or shares
 *  are missing/non-positive (can't value it honestly). */
export function buildAssumptions(f: Fundamentals): Assumptions | null {
  if (f.fcfAvg3 == null || f.fcfAvg3 <= 0 || f.dilutedShares == null || f.dilutedShares <= 0) {
    return null;
  }
  const rev = f.revenueCAGR ?? 0;
  const fcf = f.fcfCAGR ?? 0;
  const growthLow = clamp(Math.min(rev, fcf), 0, 0.06);
  const growthHigh = clamp(Math.max(rev, fcf, growthLow), growthLow, 0.1);
  return {
    ownerEarnings: f.fcfAvg3 / 1e9, // $B
    shares: f.dilutedShares / 1e9, // billions
    netCash: (f.netCash ?? 0) / 1e9, // $B
    requiredReturn: 0.09,
    discountRate: 0.1,
    growthLow,
    growthHigh,
    years: 10,
    terminalGrowth: 0.03,
  };
}

/** Apply the "reject fast" screen. Insufficient data is its own verdict — we
 *  never guess past a missing number. */
export function screen(f: Fundamentals): { verdict: ScreenVerdict; rejections: string[] } {
  if (f.revenue == null || f.fcfAvg3 == null || f.dilutedShares == null || f.fcfHistory.length < 3) {
    return { verdict: "insufficient", rejections: [] };
  }
  const rejections: string[] = [];
  if (!f.fcfAllPositive || f.fcfAvg3 <= 0) rejections.push("Negative or erratic FCF (5-yr)");
  if (f.netDebtToEbitda != null && f.netDebtToEbitda > 3) rejections.push("Net debt / EBITDA > 3");
  if (f.roic != null && f.roic < 0.1) rejections.push("ROIC below ~10%");
  if (f.revenueCAGR != null && f.revenueCAGR < 0) rejections.push("Revenue trending down");
  return { verdict: rejections.length ? "reject" : "pass", rejections };
}

export function scoreStock(f: Fundamentals, price: number | null): Scored {
  const { verdict, rejections } = screen(f);
  const base = {
    verdict,
    rejections,
    roic: f.roic,
    fcfMargin: f.fcfMargin,
    netDebtToEbitda: f.netDebtToEbitda,
    revenueCAGR: f.revenueCAGR,
    fcfAllPositive: f.fcfAllPositive,
  };

  const a = buildAssumptions(f);
  if (verdict === "insufficient" || !a) {
    // Keep the screen's verdict (a "reject" with reasons stays a reject even if
    // negative owner earnings mean we can't put a value on it).
    return {
      ...base,
      assumptions: null,
      valuation: null,
      fairPrice: null,
      bargainPrice: null,
      marginOfSafety: null,
      status: "n/a",
    };
  }

  const v = valuation(a);
  const fairPrice = v.intrinsicLow;
  const bargainPrice = v.intrinsicLow * MOS_DISCOUNT; // == v.buyBelow
  let mos: number | null = null;
  let status: Scored["status"] = "n/a";
  if (price != null && price > 0) {
    mos = (v.intrinsicLow - price) / v.intrinsicLow;
    status = price <= bargainPrice ? "bargain" : price <= fairPrice ? "fair" : "rich";
  }

  return { ...base, assumptions: a, valuation: v, fairPrice, bargainPrice, marginOfSafety: mos, status };
}
