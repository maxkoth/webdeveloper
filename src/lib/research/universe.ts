// The screening universe: a curated set of large, well-documented businesses
// whose SEC filings use standard tags (so EDGAR extraction is reliable). This
// is deliberately NOT the whole market — it's a quality-biased watchlist across
// sectors. CIKs are resolved at runtime from SEC's ticker map, so only the
// ticker is needed here. `quoteSymbol` is the Stooq/Yahoo symbol for prices.
//
// Edit this list to add or remove names; the screener picks them up.

export type UniverseEntry = { ticker: string; name: string; sector: string };

export const UNIVERSE: UniverseEntry[] = [
  { ticker: "AAPL", name: "Apple", sector: "Tech" },
  { ticker: "MSFT", name: "Microsoft", sector: "Tech" },
  { ticker: "GOOGL", name: "Alphabet", sector: "Tech" },
  { ticker: "META", name: "Meta Platforms", sector: "Tech" },
  { ticker: "NVDA", name: "NVIDIA", sector: "Semis" },
  { ticker: "AVGO", name: "Broadcom", sector: "Semis" },
  { ticker: "TXN", name: "Texas Instruments", sector: "Semis" },
  { ticker: "QCOM", name: "Qualcomm", sector: "Semis" },
  { ticker: "ADBE", name: "Adobe", sector: "Software" },
  { ticker: "ORCL", name: "Oracle", sector: "Software" },
  { ticker: "CRM", name: "Salesforce", sector: "Software" },
  { ticker: "V", name: "Visa", sector: "Financials" },
  { ticker: "MA", name: "Mastercard", sector: "Financials" },
  { ticker: "MCO", name: "Moody's", sector: "Financials" },
  { ticker: "SPGI", name: "S&P Global", sector: "Financials" },
  { ticker: "HD", name: "Home Depot", sector: "Consumer" },
  { ticker: "COST", name: "Costco", sector: "Consumer" },
  { ticker: "NKE", name: "Nike", sector: "Consumer" },
  { ticker: "SBUX", name: "Starbucks", sector: "Consumer" },
  { ticker: "PG", name: "Procter & Gamble", sector: "Staples" },
  { ticker: "KO", name: "Coca-Cola", sector: "Staples" },
  { ticker: "PEP", name: "PepsiCo", sector: "Staples" },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { ticker: "ABBV", name: "AbbVie", sector: "Healthcare" },
  { ticker: "MRK", name: "Merck", sector: "Healthcare" },
  { ticker: "UNH", name: "UnitedHealth", sector: "Healthcare" },
];

export function quoteSymbolFor(ticker: string): string {
  return `${ticker.toUpperCase()}.US`;
}
