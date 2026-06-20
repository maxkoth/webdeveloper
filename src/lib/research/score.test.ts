import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreStock } from "./score";
import type { Fundamentals } from "./edgar";

// A healthy, valuable business. Override fields per test.
const baseF = (over: Partial<Fundamentals> = {}): Fundamentals => ({
  entityName: "Test Co",
  fiscalYear: 2025,
  span: "FY2021–FY2025",
  revenue: 1_000_000_000,
  netIncome: 120_000_000,
  ocf: 150_000_000,
  capex: 30_000_000,
  fcfLatest: 120_000_000,
  fcfAvg3: 120_000_000,
  fcfHistory: [
    { year: 2023, val: 100_000_000 },
    { year: 2024, val: 110_000_000 },
    { year: 2025, val: 120_000_000 },
  ],
  fcfMargin: 0.12,
  fcfAllPositive: true,
  revenueCAGR: 0.05,
  fcfCAGR: 0.06,
  ebitda: 220_000_000,
  roic: 0.2,
  netCash: 50_000_000,
  netDebtToEbitda: 0.5,
  dilutedShares: 100_000_000,
  missing: [],
  ...over,
});

test("a healthy business prices into bargain / fair / rich correctly", () => {
  const rich = scoreStock(baseF(), 100_000); // absurdly high price
  assert.equal(rich.status, "rich");
  assert.ok(rich.bargainPrice! > 0);
  const bargain = scoreStock(baseF(), rich.bargainPrice! * 0.9); // below the buy line
  assert.equal(bargain.status, "bargain");
  assert.ok(bargain.marginOfSafety! > 0 && bargain.marginOfSafety! <= 0.9);
});

test("non-positive intrinsic (debt swamps earnings) → n/a, not a fake bargain", () => {
  const s = scoreStock(baseF({ netCash: -50_000_000_000 }), 10);
  assert.equal(s.status, "n/a");
  assert.equal(s.marginOfSafety, null);
});

test("implausible >90% discount (bad share count) → n/a, not a fake bargain", () => {
  // 185k shares for a $1B-revenue company → absurd per-share intrinsic.
  const s = scoreStock(baseF({ dilutedShares: 185_109 }), 3.61);
  assert.equal(s.status, "n/a");
  assert.equal(s.marginOfSafety, null);
});
