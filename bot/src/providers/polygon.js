// Polygon provider: one snapshot call returns the whole market; the prefilter
// (in scanner.js) narrows it. Real-time + extended hours needs Polygon's paid
// Advanced tier.

import { getFullSnapshot, getIntradayBars, readSnapshot } from "../polygon.js";

export function polygonProvider() {
  return {
    name: "polygon",
    async getRawTickers(cfg) {
      const tickers = await getFullSnapshot(cfg.polygon.apiKey);
      return tickers.map(readSnapshot);
    },
    async getBars(cfg, ticker, fromMs, toMs) {
      return getIntradayBars(cfg.polygon.apiKey, ticker, fromMs, toMs);
    },
  };
}
