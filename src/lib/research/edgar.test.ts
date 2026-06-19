import { test } from "node:test";
import assert from "node:assert/strict";
import { computeFundamentals, type CompanyFacts } from "./edgar";

// Minimal companyfacts blob for a cash-rich filer (Apple-style): $30B cash,
// $25B short-term investments, $100B LONG-TERM marketable securities, $90B debt.
const usd = (val: number, extra: Record<string, unknown> = {}) => ({
  end: "2024-09-30",
  val,
  form: "10-K",
  fy: 2024,
  ...extra,
});
const dur = (val: number) => usd(val, { start: "2023-10-01" });

const FACTS: CompanyFacts = {
  entityName: "CashRich Co",
  facts: {
    "us-gaap": {
      Revenues: { units: { USD: [dur(100e9)] } },
      NetCashProvidedByUsedInOperatingActivities: { units: { USD: [dur(24e9)] } },
      PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [dur(4e9)] } },
      CashAndCashEquivalentsAtCarryingValue: { units: { USD: [usd(30e9)] } },
      ShortTermInvestments: { units: { USD: [usd(25e9)] } },
      MarketableSecuritiesNoncurrent: { units: { USD: [usd(100e9)] } },
      LongTermDebtNoncurrent: { units: { USD: [usd(90e9)] } },
      WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [dur(15e9)] } },
    },
  },
};

test("net cash now includes long-term marketable securities", () => {
  const f = computeFundamentals(FACTS);
  // (30 + 25 + 100) − 90 = 65B.  Before the fix it was (30 + 25) − 90 = −35B.
  assert.equal(f.netCash, 65e9);
});

test("excluding LT securities would have understated net cash (regression guard)", () => {
  const withoutLt: CompanyFacts = {
    ...FACTS,
    facts: {
      "us-gaap": Object.fromEntries(
        Object.entries(FACTS.facts!["us-gaap"]).filter(([k]) => k !== "MarketableSecuritiesNoncurrent"),
      ),
    },
  };
  const f = computeFundamentals(withoutLt);
  assert.equal(f.netCash, -35e9); // proves the 100B LT bucket is what flips it positive
});
