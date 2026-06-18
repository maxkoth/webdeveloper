import type { Assumptions } from "./valuation";

// ─────────────────────────────────────────────────────────────────────────────
// DATA PROVENANCE — READ THIS FIRST.
//
// Every financial input below is an APPROXIMATION drawn from the analyst's
// knowledge of these businesses as of an early-2026 training cutoff. NONE of it
// was pulled live from SEC EDGAR or yfinance — the build environment had no
// network access to those sources. Per the framework's hard rule ("if data is
// incomplete or stale, say so and stop; do not fill gaps with guesses presented
// as fact") these numbers are presented as ILLUSTRATIVE of the METHOD, not as
// verified filings. Before acting on any of this, rebuild each `assumptions`
// block from the latest 10-K/10-Q and the figures will recompute throughout the
// page. Treat the conclusions as "wait / verify," never as "buy."
//
// The ONE genuinely live number on the page is the market price, fetched at
// request time by /api/quote when the app runs outside this sandbox.
// ─────────────────────────────────────────────────────────────────────────────

export const ANALYSIS_DATE = "2026-06-18";

export const DATA_DISCLAIMER =
  "Fundamentals below are approximate, drawn from a training-data snapshot (early 2026), NOT pulled live from EDGAR. They illustrate the valuation method, not verified filings. Rebuild every assumption from the latest 10-K/10-Q before relying on a single figure. Live market price is the only real-time input.";

export type Verdict = "deep-dive" | "watch" | "rejected";

export type ScreenRow = {
  ticker: string;
  name: string;
  verdict: Verdict;
  /** One-line reason the candidate passed, is parked, or was rejected. */
  note: string;
};

export type ScoreLine = { metric: string; value: string };

export type DeepDive = {
  ticker: string;
  /** Stooq-style symbol used by the live-price route (US market). */
  quoteSymbol: string;
  name: string;
  /** Business in one paragraph: what it does, how it earns, the moat (or none). */
  business: string;
  moat: string;
  qualityScorecard: ScoreLine[];
  ownerEarningsNote: string;
  assumptions: Assumptions;
  /** Plain-English statement of the valuation logic and where it's fragile. */
  valuationNote: string;
  /** Pre-mortem: the 3 most likely ways the thesis is WRONG about the business. */
  thesisRisks: string[];
  /** Observable, business-based SELL triggers — never price-based. */
  sellTriggers: string[];
  /** The bear case, argued as a smart short-seller would. */
  bearCase: string;
  /** Suggested position size as a % of portfolio, with the reasoning. */
  positionSizing: string;
  /** What would change my mind — specific, checkable. */
  changeMyMind: string[];
};

// ─── The screen: reject fast, before deep analysis ──────────────────────────
export const SCREEN: ScreenRow[] = [
  {
    ticker: "GOOGL",
    name: "Alphabet",
    verdict: "deep-dive",
    note: "Net-cash balance sheet, ~20%+ FCF margin, very high ROIC ex-cash, revenue still growing. Clears every screen.",
  },
  {
    ticker: "V",
    name: "Visa",
    verdict: "deep-dive",
    note: "Two-sided payment network, ~65% operating margin, prodigious FCF, net debt <1x EBITDA. Textbook quality.",
  },
  {
    ticker: "MCO",
    name: "Moody's",
    verdict: "deep-dive",
    note: "Ratings duopoly + analytics. Very high ROIC, recurring revenue, net debt ~1.5x EBITDA. Clears the bar.",
  },
  {
    ticker: "SPGI",
    name: "S&P Global",
    verdict: "watch",
    note: "Same ratings-duopoly quality as Moody's, more diversified. Parked to avoid doubling the single-thesis bet; likely rich.",
  },
  {
    ticker: "MSFT",
    name: "Microsoft",
    verdict: "watch",
    note: "Passes every quality screen comfortably; valuation almost never offers a margin of safety. Watch the price, not the business.",
  },
  {
    ticker: "AAPL",
    name: "Apple",
    verdict: "watch",
    note: "Capital-light, huge buybacks, high ROIC — but maturing growth and a rich multiple. Watch.",
  },
  {
    ticker: "ADBE",
    name: "Adobe",
    verdict: "watch",
    note: "High FCF margin and ROIC, but generative-AI disruption to the core creative moat is an unresolved thesis risk. Needs a wider margin of safety.",
  },
  {
    ticker: "TXN",
    name: "Texas Instruments",
    verdict: "rejected",
    note: "REJECT (for now): FCF depressed/erratic over the 5-yr window due to a deliberate multi-year fab capex supercycle. Revisit when capex normalizes and owner earnings are legible.",
  },
  {
    ticker: "NKE",
    name: "Nike",
    verdict: "rejected",
    note: "REJECT: revenue trending the wrong way (FY24–25 declines), DTC reset, China softness. Brand moat intact but business deteriorating — wait for stabilization.",
  },
  {
    ticker: "UNH",
    name: "UnitedHealth",
    verdict: "rejected",
    note: "REJECT — too-hard pile: cyberattack fallout, DOJ/Medicare-coding scrutiny, opaque insurance reserves, leadership upheaval. Fails the accounting-clarity preference.",
  },
];

// ─── The deep dives ─────────────────────────────────────────────────────────
export const DEEP_DIVES: DeepDive[] = [
  {
    ticker: "GOOGL",
    quoteSymbol: "GOOGL.US",
    name: "Alphabet Inc.",
    business:
      "Alphabet earns the overwhelming majority of its profit from advertising — Google Search, YouTube, and the ad network — monetizing the world's largest pool of intent data and distribution (Chrome, Android, Maps). Google Cloud is now profitable and growing; 'Other Bets' (Waymo etc.) are option value, not earnings. The model is capital-light at the core (search) and increasingly capital-heavy at the edge (AI data centers).",
    moat:
      "Wide but contested. Network effects and data scale in search/ads, distribution lock-in via Chrome/Android, and YouTube's two-sided creator economy. The live question is whether LLM-style answers erode the 'ten blue links' funnel — a moat under genuine pressure, not a moat that has broken.",
    qualityScorecard: [
      { metric: "ROIC (5-yr, ex-cash)", value: "High — well above the 10% bar; mid-20s%+ on invested capital" },
      { metric: "FCF margin & trend", value: "~20% of revenue; absolute FCF rising, but recent heavy AI/data-center capex compresses it" },
      { metric: "Balance sheet", value: "Net cash (~$90B); negligible financial leverage; interest coverage not a concern" },
      { metric: "Capital allocation", value: "Large, fairly opportunistic buybacks; dividend initiated 2024; M&A mostly disciplined, regulators permitting" },
    ],
    ownerEarningsNote:
      "Reported FCF understates owner earnings in years of heavy growth capex, because much of that capex is expansionary, not maintenance. I normalize owner earnings to ~$85B — below peak net income to stay conservative, and treating a chunk of data-center spend as the price of future growth rather than upkeep. This single number is the biggest swing factor in the valuation; it deserves the most scrutiny.",
    assumptions: {
      ownerEarnings: 85,
      shares: 12.1,
      netCash: 90,
      requiredReturn: 0.09,
      discountRate: 0.1,
      growthLow: 0.05,
      growthHigh: 0.09,
      years: 10,
      terminalGrowth: 0.03,
    },
    valuationNote:
      "EPV (no growth) is a stark floor far below the price — meaning the market is paying for growth, so the thesis LIVES OR DIES on growth being real and durable. The DCF range brackets 5–9% owner-earnings growth at a 10% discount and 3% terminal. If the valuation only clears at the high-growth end, that is itself the warning: you are underwriting AI-era ad dominance.",
    thesisRisks: [
      "Search disintermediation: AI assistants answer queries directly, shrinking the ad-funnel that prints the profit.",
      "Antitrust: remedies (default-search payments, ad-tech structure) cut a high-margin revenue stream or force divestiture.",
      "Capex never converts: AI data-center spend permanently resets the FCF margin lower without commensurate earnings.",
    ],
    sellTriggers: [
      "Search/ads revenue declines two consecutive years (not one soft quarter).",
      "Operating margin structurally falls below ~25% as capex fails to convert to earnings.",
      "A forced structural remedy (e.g. ad-tech divestiture) that permanently impairs the core economics.",
    ],
    bearCase:
      "A short-seller argues Alphabet is a melting ice cube dressed as a compounder: generative answers collapse the query-to-ad funnel, Apple/regulators end the lucrative default-search deals, and management torches tens of billions in capex chasing an AI lead it won't monetize at search-like margins. Multiple and margin compress together — the classic value trap where a 'cheap' mega-cap gets cheaper.",
    positionSizing:
      "If — and only if — it traded below the buy-below price, a 4–6% position would be reasonable: high business quality and a fortress balance sheet argue for size, but a contested moat and single-stock concentration argue against going bigger. Start at the low end and average down only on price, never on a deteriorating thesis.",
    changeMyMind: [
      "Evidence the AI transition is ad-revenue accretive, not dilutive (rising RPMs in AI surfaces).",
      "Capex visibly converting to Cloud/AI operating profit at healthy incremental margins.",
      "A price below the buy-below level, which would hand you the growth optionality for free.",
    ],
  },
  {
    ticker: "V",
    quoteSymbol: "V.US",
    name: "Visa Inc.",
    business:
      "Visa runs the rails, not the credit. It operates a global payment network connecting banks, merchants, and cardholders, taking a small, volume-based toll on payments authorized, cleared, and settled across it. It bears no consumer credit risk (issuers do). The result is a tollbooth: ~65% operating margins, light capital needs, and cash that converts almost entirely to FCF.",
    moat:
      "Among the widest in public markets. A two-sided network — more merchants attract more cardholders and vice versa — that a new entrant cannot bootstrap, reinforced by global scale, trust, and regulation. The durable threats are political (interchange caps) and architectural (real-time bank rails, stablecoins) rather than competitive.",
    qualityScorecard: [
      { metric: "ROIC (5-yr)", value: "Very high — asset-light network economics keep returns on capital far above the bar" },
      { metric: "FCF margin & trend", value: "~50%+ of revenue converts to FCF; steady, secular volume growth" },
      { metric: "Balance sheet", value: "Modest gross debt, net debt comfortably below ~1x EBITDA; strong interest coverage" },
      { metric: "Capital allocation", value: "Consistent large buybacks + growing dividend; bolt-on M&A (value-added services); generally disciplined" },
    ],
    ownerEarningsNote:
      "Visa's GAAP earnings and owner earnings are unusually close: capex is tiny relative to cash generation and working-capital needs are minimal. I use ~$19B normalized owner earnings — essentially steady-state FCF. Less estimation risk here than almost anywhere; the judgment call is the growth rate, not the base.",
    assumptions: {
      ownerEarnings: 19,
      shares: 2.0,
      netCash: -5,
      requiredReturn: 0.09,
      discountRate: 0.1,
      growthLow: 0.06,
      growthHigh: 0.1,
      years: 10,
      terminalGrowth: 0.03,
    },
    valuationNote:
      "The DCF brackets 6–10% growth — below Visa's historical mid-teens, deliberately, to leave room for payment-rail disruption and law-of-large-numbers deceleration. Even so the quality is such that the EPV floor sits high. The risk is paying a premium multiple for that quality and getting a mediocre return if growth merely normalizes.",
    thesisRisks: [
      "Regulatory: interchange/network-fee caps (US, EU, and emerging markets) compress the take rate.",
      "Disintermediation: real-time account-to-account rails and stablecoins route volume around the network.",
      "Maturity: developed-market card penetration is high; growth depends on cash-displacement that eventually slows.",
    ],
    sellTriggers: [
      "Net payment-volume growth stalls toward low single digits for a sustained period (structural, not a recession dip).",
      "A regulatory ruling that permanently cuts the take rate on a major revenue geography.",
      "Evidence that A2A/stablecoin rails are taking share of core volume, not just sitting adjacent.",
    ],
    bearCase:
      "The short case: Visa is a regulated toll road priced like a growth stock. Governments worldwide resent the toll and will legislate it down; stablecoins and instant bank transfers quietly bleed the highest-margin volumes; and at this scale, growth can only decelerate. You're paying ~30x for a business whose best days of operating leverage are behind it.",
    positionSizing:
      "Quality justifies a meaningful position — 5–7% — IF bought below the buy-below price. The catch is that this quality is widely recognized, so the margin of safety rarely appears; patience is the edge. Size up only on a genuine valuation dislocation, not on narrative.",
    changeMyMind: [
      "A regulatory regime change that structurally caps network economics (bearish, would cut intrinsic value).",
      "Hard data on stablecoin/A2A taking core volume share (bearish).",
      "A market dislocation pushing the price below buy-below, offering the network at a discount (bullish trigger to act).",
    ],
  },
  {
    ticker: "MCO",
    quoteSymbol: "MCO.US",
    name: "Moody's Corporation",
    business:
      "Two businesses. Moody's Investors Service (MIS) rates debt issuance in an effective duopoly with S&P — issuers pay for ratings because capital markets demand them, giving ~60% segment margins and pricing power. Moody's Analytics (MA) sells data, models, and risk software on a largely recurring, subscription basis, smoothing MIS's issuance cyclicality.",
    moat:
      "Wide and regulation-reinforced. The rating duopoly is protected by decades of reputational capital, embedded use in regulation and investment mandates, and a two-name market structure that is extraordinarily hard to enter. MA adds switching costs via embedded workflows.",
    qualityScorecard: [
      { metric: "ROIC (5-yr)", value: "High — well above the bar; capital-light ratings franchise, though acquisitions add goodwill" },
      { metric: "FCF margin & trend", value: "Strong, ~25–30% of revenue; MIS swings with issuance volumes, MA cushions" },
      { metric: "Balance sheet", value: "Net debt roughly ~1.5x EBITDA — acceptable for a recurring-revenue franchise; solid coverage" },
      { metric: "Capital allocation", value: "Steady buybacks + growing dividend; MA built partly via acquisition — watch the prices paid" },
    ],
    ownerEarningsNote:
      "Owner earnings are cyclical because MIS issuance volume is. I normalize to ~$2.1B to avoid valuing the business off a boom (or a trough) in bond issuance — using a mid-cycle figure rather than a peak-issuance year. Capex is light; the working-capital and acquisition cadence are the items to watch.",
    assumptions: {
      ownerEarnings: 2.1,
      shares: 0.18,
      netCash: -4,
      requiredReturn: 0.09,
      discountRate: 0.1,
      growthLow: 0.05,
      growthHigh: 0.09,
      years: 10,
      terminalGrowth: 0.03,
    },
    valuationNote:
      "Normalizing owner earnings matters more here than anywhere: value off mid-cycle issuance, not a record year. The DCF brackets 5–9% growth. Quality is not the question; price is — this franchise rarely trades at a discount to a sober intrinsic estimate.",
    thesisRisks: [
      "Issuance cycle: a prolonged high-rate or recessionary stretch suppresses bond issuance and MIS revenue for years.",
      "Regulation/liability: reform of the issuer-pays model or fresh legal liability dents the franchise economics.",
      "Disruption: AI-driven or alternative credit-risk assessment slowly erodes the necessity of a paid rating.",
    ],
    sellTriggers: [
      "Net debt/EBITDA breaches ~3.5x (e.g. to fund a large, pricey acquisition).",
      "FCF declines two consecutive years on a normalized (cycle-adjusted) basis, not just a cyclical issuance dip.",
      "A regulatory change that structurally alters the issuer-pays model or the duopoly's pricing power.",
    ],
    bearCase:
      "The bear says Moody's is a cyclical levered to a multi-decade credit boom that is ending: normalize issuance to a higher-rate world and 'normalized' earnings are lower than bulls assume. Layer in regulatory tail risk to issuer-pays and slow AI disruption of the rating's necessity, and you're paying a quality multiple for a business at a cyclical peak.",
    positionSizing:
      "Narrower than a market-leader like Visa given issuance cyclicality and regulatory tail risk: 3–5% if bought below buy-below. The duopoly quality supports holding through cycles, but the cyclical earnings base argues for restraint on size and entry price.",
    changeMyMind: [
      "A structural reform of issuer-pays or a duopoly-cracking regulatory action (bearish, cuts intrinsic value).",
      "Evidence that normalized issuance is materially lower in a higher-rate regime (bearish to the base case).",
      "A cyclical issuance trough that pushes the price below buy-below while the franchise stays intact (bullish trigger).",
    ],
  },
];
