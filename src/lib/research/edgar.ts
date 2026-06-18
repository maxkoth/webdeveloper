// SEC EDGAR extraction — pure, testable functions that turn a parsed
// `companyfacts` JSON blob into the fundamentals the screener needs. No network
// here (the route does the fetching); this file is just parsing + arithmetic so
// it can be unit-tested against a known sample.
//
// EDGAR's companyfacts mixes annual, quarterly, and restated facts for every
// concept, and tag names vary by filer — so each metric is resolved against a
// PRIORITY LIST of candidate tags, and annual values are isolated by form +
// period length (see the helpers below).

export type Fact = {
  start?: string;
  end: string;
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  frame?: string;
};

export type CompanyFacts = {
  cik?: number;
  entityName?: string;
  facts?: Record<string, Record<string, { units?: Record<string, Fact[]> }>>;
};

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);

/** First candidate tag that exists for the given taxonomy + unit. */
function conceptFacts(
  cf: CompanyFacts,
  taxonomy: string,
  names: string[],
  unit: string,
): Fact[] | null {
  const tax = cf.facts?.[taxonomy];
  if (!tax) return null;
  for (const name of names) {
    const facts = tax[name]?.units?.[unit];
    if (facts && facts.length) return facts;
  }
  return null;
}

/** Full-year DURATION facts (income statement / cash flow), keyed by the
 *  calendar year of the period end. Filters to annual forms and a ~365-day
 *  span so quarterly and year-to-date rows are excluded. Prefers the highest
 *  `fy` when a year appears in multiple filings (the original, not a stale
 *  comparative). */
export function annualDurations(facts: Fact[]): Map<number, number> {
  const best = new Map<number, { val: number; fy: number }>();
  for (const f of facts) {
    if (!f.start || !f.end || !f.form || !ANNUAL_FORMS.has(f.form)) continue;
    const days = (Date.parse(f.end) - Date.parse(f.start)) / 86_400_000;
    if (!(days >= 330 && days <= 372)) continue;
    const year = new Date(f.end).getUTCFullYear();
    const prev = best.get(year);
    const fy = f.fy ?? year;
    if (!prev || fy >= prev.fy) best.set(year, { val: f.val, fy });
  }
  return new Map([...best].map(([y, v]) => [y, v.val]));
}

/** Balance-sheet INSTANT facts (no `start`), keyed by the year of `end`. */
export function annualInstants(facts: Fact[]): Map<number, number> {
  const best = new Map<number, { val: number; fy: number }>();
  for (const f of facts) {
    if (f.start || !f.end || !f.form || !ANNUAL_FORMS.has(f.form)) continue;
    const year = new Date(f.end).getUTCFullYear();
    const prev = best.get(year);
    const fy = f.fy ?? year;
    if (!prev || fy >= prev.fy) best.set(year, { val: f.val, fy });
  }
  return new Map([...best].map(([y, v]) => [y, v.val]));
}

function latestYear(map: Map<number, number>): number | null {
  if (map.size === 0) return null;
  return Math.max(...map.keys());
}

/** Distinct positive fact values at the latest period end, preferring annual
 *  forms. `kind` selects full-year DURATION facts vs balance-sheet INSTANT
 *  facts. Used for share counts, where multiple share classes appear as
 *  several facts sharing the same end date. */
function distinctAtLatestPeriod(facts: Fact[], kind: "duration" | "instant"): number[] {
  const isKind = (f: Fact) => {
    if (kind === "instant") return !f.start;
    if (!f.start) return false;
    const days = (Date.parse(f.end) - Date.parse(f.start)) / 86_400_000;
    return days >= 330 && days <= 372;
  };
  let pool = facts.filter((f) => f.form && ANNUAL_FORMS.has(f.form) && isKind(f));
  if (!pool.length) pool = facts.filter(isKind);
  if (!pool.length) return [];
  const latestEnd = pool.reduce((m, f) => (f.end > m ? f.end : m), pool[0].end);
  const at = pool.filter((f) => f.end === latestEnd);
  return [...new Set(at.map((f) => f.val))].filter((v) => isFinite(v) && v > 0);
}

/** Total diluted share count, robust to multiple share classes (the bug that
 *  made Visa/Mastercard look 4–10× undervalued: only one class was counted).
 *  Uses the LARGER of (a) the max single weighted-average-diluted value — which
 *  for as-converted filers like Visa is the full ~2.03B total — and (b) the SUM
 *  of the distinct dei cover-page class counts. Biasing to the larger count
 *  keeps the per-share valuation conservative when the two sources disagree. */
export function extractShares(cf: CompanyFacts): number | null {
  const diluted = conceptFacts(cf, "us-gaap", TAGS.dilutedShares, "shares");
  const dilutedMax = diluted ? Math.max(0, ...distinctAtLatestPeriod(diluted, "duration")) : 0;
  const dei = conceptFacts(cf, "dei", ["EntityCommonStockSharesOutstanding"], "shares");
  const deiSum = dei ? distinctAtLatestPeriod(dei, "instant").reduce((s, v) => s + v, 0) : 0;
  const shares = Math.max(dilutedMax, deiSum);
  return shares > 0 ? shares : null;
}

/** Value at `year`, else the most recent value not after `year`, else latest. */
function valueAt(map: Map<number, number>, year: number | null): number | null {
  if (map.size === 0) return null;
  if (year != null && map.has(year)) return map.get(year)!;
  const years = [...map.keys()].sort((a, b) => a - b);
  const le = years.filter((y) => year == null || y <= year);
  const pick = le.length ? le[le.length - 1] : years[years.length - 1];
  return map.get(pick)!;
}

/** Last `n` values (year-ascending). */
function lastN(map: Map<number, number>, n: number): { year: number; val: number }[] {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-n)
    .map(([year, val]) => ({ year, val }));
}

function cagr(points: { year: number; val: number }[]): number | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const years = last.year - first.year;
  if (years <= 0 || first.val <= 0 || last.val <= 0) return null;
  return Math.pow(last.val / first.val, 1 / years) - 1;
}

const TAGS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
  ],
  netIncome: ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
  ocf: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  capex: [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
    "PaymentsForCapitalImprovements",
  ],
  da: [
    "DepreciationDepletionAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
    "DepreciationAndAmortization",
  ],
  operatingIncome: ["OperatingIncomeLoss"],
  tax: ["IncomeTaxExpenseBenefit", "CurrentIncomeTaxExpenseBenefit"],
  pretax: [
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
  ],
  longTermDebt: ["LongTermDebtNoncurrent", "LongTermDebt", "LongTermDebtAndCapitalLeaseObligations"],
  debtCurrent: ["LongTermDebtCurrent", "LongTermDebtCurrentMaturities", "DebtCurrent"],
  cash: [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    "Cash",
  ],
  shortTermInvestments: ["ShortTermInvestments", "MarketableSecuritiesCurrent", "AvailableForSaleSecuritiesCurrent"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  dilutedShares: [
    "WeightedAverageNumberOfDilutedSharesOutstanding",
    "WeightedAverageNumberOfShareOutstandingBasicAndDiluted",
  ],
};

export type Fundamentals = {
  entityName: string | null;
  /** Fiscal year (calendar year of period end) the income/CF figures align to. */
  fiscalYear: number | null;
  /** Span label, e.g. "FY2020–FY2024". */
  span: string | null;
  revenue: number | null;
  netIncome: number | null;
  ocf: number | null;
  capex: number | null;
  fcfLatest: number | null;
  /** Normalized owner-earnings proxy: average FCF over last 3 available years. */
  fcfAvg3: number | null;
  fcfHistory: { year: number; val: number }[];
  fcfMargin: number | null;
  fcfAllPositive: boolean;
  revenueCAGR: number | null;
  fcfCAGR: number | null;
  ebitda: number | null;
  roic: number | null;
  netCash: number | null; // cash + ST investments − total debt
  netDebtToEbitda: number | null;
  dilutedShares: number | null; // actual share count
  /** Concepts that could not be resolved (transparency for verification). */
  missing: string[];
};

/** Build a Fundamentals object from a parsed companyfacts blob. Pure. */
export function computeFundamentals(cf: CompanyFacts): Fundamentals {
  // Only CRITICAL concepts (those required to screen + value) are tracked as
  // "missing"; optional ones (e.g. current debt, ST investments) just leave a
  // derived metric null and shouldn't look like a data problem.
  const missing: string[] = [];
  const dur = (key: keyof typeof TAGS, critical = false) => {
    const f = conceptFacts(cf, "us-gaap", TAGS[key], "USD");
    if (!f && critical) missing.push(key);
    return f ? annualDurations(f) : new Map<number, number>();
  };
  const inst = (key: keyof typeof TAGS) => {
    const f = conceptFacts(cf, "us-gaap", TAGS[key], "USD");
    return f ? annualInstants(f) : new Map<number, number>();
  };

  const revenue = dur("revenue", true);
  const netIncome = dur("netIncome");
  const ocf = dur("ocf", true);
  const capex = dur("capex", true);
  const da = dur("da");
  const opInc = dur("operatingIncome");
  const tax = dur("tax");
  const pretax = dur("pretax");
  const ltDebt = inst("longTermDebt");
  const curDebt = inst("debtCurrent");
  const cash = inst("cash");
  const sti = inst("shortTermInvestments");
  const equity = inst("equity");

  // Total diluted shares, aggregated across share classes (see extractShares).
  const dilutedShares = extractShares(cf);
  if (dilutedShares == null) missing.push("shares");

  const fy = latestYear(revenue) ?? latestYear(netIncome);

  // FCF history (years where both OCF and capex exist).
  const fcfByYear = new Map<number, number>();
  for (const [year, ocfVal] of ocf) {
    const capexVal = capex.get(year);
    if (capexVal != null) fcfByYear.set(year, ocfVal - Math.abs(capexVal));
  }
  const fcfHistory = lastN(fcfByYear, 5);
  const fcfLatest = fcfHistory.length ? fcfHistory[fcfHistory.length - 1].val : null;
  const fcf3 = fcfHistory.slice(-3);
  const fcfAvg3 = fcf3.length ? fcf3.reduce((s, p) => s + p.val, 0) / fcf3.length : null;
  const fcfAllPositive = fcfHistory.length >= 3 && fcfHistory.every((p) => p.val > 0);

  const revenueVal = valueAt(revenue, fy);
  const fcfMargin = fcfLatest != null && revenueVal ? fcfLatest / revenueVal : null;

  const debtTotal = (valueAt(ltDebt, fy) ?? 0) + (valueAt(curDebt, fy) ?? 0);
  const cashTotal = (valueAt(cash, fy) ?? 0) + (valueAt(sti, fy) ?? 0);
  const netCash = cashTotal - debtTotal;

  const opIncVal = valueAt(opInc, fy);
  const daVal = valueAt(da, fy);
  const ebitda = opIncVal != null && daVal != null ? opIncVal + daVal : null;

  const taxVal = valueAt(tax, fy);
  const pretaxVal = valueAt(pretax, fy);
  let taxRate = 0.21;
  if (taxVal != null && pretaxVal && pretaxVal > 0) {
    taxRate = Math.min(0.35, Math.max(0, taxVal / pretaxVal));
  }
  const equityVal = valueAt(equity, fy);
  let roic: number | null = null;
  if (opIncVal != null && equityVal != null) {
    const nopat = opIncVal * (1 - taxRate);
    const investedCapital = debtTotal + equityVal - cashTotal;
    if (investedCapital > 0) roic = nopat / investedCapital;
  }

  const netDebt = debtTotal - cashTotal;
  const netDebtToEbitda = ebitda && ebitda > 0 ? netDebt / ebitda : null;

  const years = fcfHistory.map((p) => p.year);
  const span = years.length ? `FY${years[0]}–FY${years[years.length - 1]}` : null;

  return {
    entityName: cf.entityName ?? null,
    fiscalYear: fy,
    span,
    revenue: revenueVal,
    netIncome: valueAt(netIncome, fy),
    ocf: valueAt(ocf, fy),
    capex: valueAt(capex, fy),
    fcfLatest,
    fcfAvg3,
    fcfHistory,
    fcfMargin,
    fcfAllPositive,
    revenueCAGR: cagr(lastN(revenue, 5)),
    fcfCAGR: cagr(fcfHistory),
    ebitda,
    roic,
    netCash,
    netDebtToEbitda,
    dilutedShares,
    missing,
  };
}
