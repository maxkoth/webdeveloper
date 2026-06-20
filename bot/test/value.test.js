import { test } from "node:test";
import assert from "node:assert/strict";
import { getValueBargains } from "../src/value.js";
import { formatAlert } from "../src/notifier.js";

const cfg = { value: { screenUrl: "http://x/api/screen", statuses: ["bargain"], maxPerRun: 20 } };

function mockScreen(rows) {
  global.fetch = async () => ({ ok: true, json: async () => ({ rows }) });
}

test("getValueBargains keeps only pass + bargain, ranked by margin of safety", async () => {
  mockScreen([
    { ticker: "DEEP", name: "Deep Value", price: 30, scored: { verdict: "pass", status: "bargain", bargainPrice: 50, fairPrice: 77, marginOfSafety: 0.6 } },
    { ticker: "MILD", name: "Mild Value", price: 48, scored: { verdict: "pass", status: "bargain", bargainPrice: 50, fairPrice: 77, marginOfSafety: 0.2 } },
    { ticker: "RICH", name: "Expensive", price: 200, scored: { verdict: "pass", status: "rich", bargainPrice: 50, fairPrice: 77, marginOfSafety: -1.6 } },
    { ticker: "JUNK", name: "Low Quality", price: 5, scored: { verdict: "reject", status: "bargain", bargainPrice: 9, fairPrice: 14, marginOfSafety: 0.5 } },
  ]);
  const out = await getValueBargains(cfg);
  assert.deepEqual(out.map((o) => o.symbol), ["DEEP", "MILD"]); // RICH (price) + JUNK (quality) dropped, sorted by MoS
  assert.equal(out[0].kind, "LONG-TERM BUY");
});

test("watchlist mode alerts only my names at/below buy price", async () => {
  const watchCfg = { value: { ...cfg.value, watchlist: ["COST", "AAPL"] } };
  mockScreen([
    { ticker: "COST", name: "Costco", price: 40, scored: { verdict: "pass", status: "bargain", bargainPrice: 50, fairPrice: 77, marginOfSafety: 0.4 } },
    { ticker: "AAPL", name: "Apple", price: 200, scored: { verdict: "pass", status: "rich", bargainPrice: 120, fairPrice: 180, marginOfSafety: -0.1 } }, // watched but not on sale
    { ticker: "DEEP", name: "Deep Value", price: 5, scored: { verdict: "pass", status: "bargain", bargainPrice: 9, fairPrice: 14, marginOfSafety: 0.6 } }, // bargain but not watched
  ]);
  const out = await getValueBargains(watchCfg);
  assert.deepEqual(out.map((o) => o.symbol), ["COST"]); // AAPL not on sale, DEEP not watched
});

test("getValueBargains throws a helpful error when the screen is unreachable", async () => {
  global.fetch = async () => ({ ok: false, status: 502, json: async () => ({}) });
  await assert.rejects(getValueBargains(cfg), /is the website running/);
});

test("formatAlert renders a long-term buy with buy-below price and a not-advice note", () => {
  const body = formatAlert({ kind: "LONG-TERM BUY", symbol: "DEEP", name: "Deep Value", price: 30, buyBelow: 50, fair: 77, mos: 0.6 });
  assert.match(body, /LONG-TERM BUY candidate/);
  assert.match(body, /buy-below \$50\.00/);
  assert.match(body, /60% below intrinsic/);
  assert.match(body, /not advice/);
});
