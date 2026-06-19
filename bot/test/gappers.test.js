import { test } from "node:test";
import assert from "node:assert/strict";
import { gapRows, topByDay } from "../src/gappers.js";

const cfg = { strategies: { gapMin: 0.04 }, gapTopK: 2 };

test("gapRows computes the overnight gap vs prior close", () => {
  const daily = new Map([
    ["AAA", [
      { t: 1, o: 100, h: 101, l: 99, c: 100, v: 1e6 },
      { t: 2, o: 110, h: 112, l: 109, c: 111, v: 2e6 }, // +10% gap
    ]],
  ]);
  const rows = gapRows(daily);
  assert.equal(rows.length, 1);
  assert.ok(Math.abs(rows[0].gapPct - 0.1) < 1e-9);
  assert.equal(rows[0].prevClose, 100);
  assert.equal(rows[0].open, 110);
});

test("topByDay keeps gappers above threshold, top-K, sorted by gap", () => {
  const dateOf = () => "2026-06-09"; // collapse everything to one day
  const rows = [
    { t: 1, symbol: "BIG", gapPct: 0.20, prevClose: 10, open: 12, volume: 2e6 },
    { t: 1, symbol: "MID", gapPct: 0.08, prevClose: 10, open: 10.8, volume: 2e6 },
    { t: 1, symbol: "SMALL", gapPct: 0.05, prevClose: 10, open: 10.5, volume: 2e6 },
    { t: 1, symbol: "FLAT", gapPct: 0.01, prevClose: 10, open: 10.1, volume: 2e6 }, // below gapMin
    { t: 1, symbol: "ILLIQUID", gapPct: 0.30, prevClose: 10, open: 13, volume: 1000 }, // too thin
    { t: 1, symbol: "PENNY", gapPct: 0.50, prevClose: 1, open: 1.4, volume: 2e6 }, // sub-$1.50
  ];
  const byDay = topByDay(rows, cfg, dateOf);
  const picks = byDay.get("2026-06-09").map((r) => r.symbol);
  assert.deepEqual(picks, ["BIG", "MID"]); // top 2 by gap; FLAT/ILLIQUID/PENNY excluded, SMALL beyond K
});
