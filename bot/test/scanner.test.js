import { test } from "node:test";
import assert from "node:assert/strict";
import { ema, vwap, atr, volumeSurge, crossedAbove, isBullishEngulfing } from "../src/indicators.js";
import { detectSetups } from "../src/signals.js";
import { prefilter } from "../src/scanner.js";
import { config } from "../src/config.js";

test("ema matches a hand-computed series", () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const e = ema(v, 3);
  assert.equal(e[0], null);
  assert.equal(e[2], 2); // SMA seed of [1,2,3]
  // next: 4*0.5 + 2*0.5 = 3
  assert.equal(e[3], 3);
});

test("vwap is volume-weighted typical price", () => {
  const bars = [
    { h: 10, l: 10, c: 10, v: 100 },
    { h: 20, l: 20, c: 20, v: 300 },
  ];
  const w = vwap(bars);
  assert.equal(w[0], 10);
  // (10*100 + 20*300) / 400 = 17.5
  assert.equal(w[1], 17.5);
});

test("atr is positive when there is range", () => {
  const bars = Array.from({ length: 20 }, (_, i) => ({
    t: i,
    o: 100 + (i % 2),
    h: 101 + (i % 2),
    l: 99 + (i % 2),
    c: 100 + (i % 2),
    v: 1000,
  }));
  const a = atr(bars, 14);
  assert.ok(a > 0);
});

test("volumeSurge flags a volume spike", () => {
  const bars = Array.from({ length: 21 }, () => ({ v: 1000, h: 1, l: 1, c: 1, o: 1 }));
  bars[bars.length - 1].v = 5000;
  assert.ok(volumeSurge(bars, 20) >= 4.9);
});

test("bullish engulfing detected", () => {
  const bars = [
    { o: 10, h: 10.2, l: 9, c: 9.2 }, // down candle
    { o: 9.1, h: 11, l: 9, c: 10.5 }, // engulfs
  ];
  assert.equal(isBullishEngulfing(bars), true);
});

// Construct a VWAP-reclaim scenario and assert the engine produces a sane trade.
function reclaimBars() {
  const bars = [];
  for (let i = 0; i < 28; i++) bars.push({ t: i, o: 100, h: 100, l: 100, c: 100, v: 1000 });
  bars.push({ t: 28, o: 100, h: 100.2, l: 98, c: 99, v: 1000 }); // dip below VWAP
  bars.push({ t: 29, o: 99, h: 101.5, l: 99, c: 101, v: 5000 }); // reclaim on volume
  return bars;
}

test("crossedAbove fires on the reclaim bar", () => {
  const bars = reclaimBars();
  const closes = bars.map((b) => b.c);
  assert.equal(crossedAbove(closes, vwap(bars)), true);
});

test("detectSetups returns a VWAP reclaim with stop<entry<target and 2R", () => {
  const setups = detectSetups({ symbol: "TEST", bars: reclaimBars() }, config.signals);
  const vr = setups.find((s) => s.type === "VWAP reclaim");
  assert.ok(vr, "expected a VWAP reclaim setup");
  assert.ok(vr.stop < vr.entry && vr.entry < vr.target, "entry/stop/target ordering");
  assert.equal(vr.rr, 2);
  // target distance ≈ 2× stop distance
  const risk = vr.entry - vr.stop;
  const reward = vr.target - vr.entry;
  assert.ok(Math.abs(reward - 2 * risk) < 0.01);
});

test("detectSetups returns nothing without enough bars", () => {
  assert.deepEqual(detectSetups({ symbol: "X", bars: [{ o: 1, h: 1, l: 1, c: 1, v: 1 }] }, config.signals), []);
});

test("prefilter keeps only liquid, moving names (normalized rows)", () => {
  const rows = [
    // mover + unusual volume → kept
    { ticker: "GOOD", price: 10, dayVolume: 5_000_000, prevVolume: 2_000_000, changePct: 6 },
    // flat, low volume → dropped (change below threshold)
    { ticker: "FLAT", price: 10, dayVolume: 100_000, prevVolume: 5_000_000, changePct: 0.2 },
    // too cheap → dropped
    { ticker: "PENNY", price: 0.5, dayVolume: 9_000_000, prevVolume: 1_000_000, changePct: 40 },
    // Alpaca-style row: no prevVolume (relVol unknown) but moving → kept
    { ticker: "ALP", price: 25, dayVolume: null, prevVolume: 0, changePct: 8 },
  ];
  const out = prefilter(rows, config, 0.5);
  const kept = out.map((o) => o.ticker);
  assert.ok(kept.includes("GOOD"));
  assert.ok(kept.includes("ALP"));
  assert.ok(!kept.includes("FLAT"));
  assert.ok(!kept.includes("PENNY"));
});
