import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { config } from "../src/config.js";
import { buildSession, STRATEGIES, etMinutes } from "../src/strategies.js";

// epoch ms for a given minutes-from-midnight on a fixed ET weekday (Mon 2025-06-09)
const tsAt = (min) =>
  DateTime.fromObject(
    { year: 2025, month: 6, day: 9, hour: Math.floor(min / 60), minute: min % 60 },
    { zone: "America/New_York" },
  ).toMillis();

// 90 one-minute regular-session bars. Opening range (first 15) spans 99–101;
// after that price sits ~100 until a clear break above 101 at 9:30+30.
function breakoutBars() {
  const bars = [];
  for (let m = 570; m < 660; m++) {
    let bar = { t: tsAt(m), o: 100, h: 100.3, l: 99.7, c: 100, v: 1000 };
    if (m < 585) bar = { t: tsAt(m), o: 100, h: 101, l: 99, c: 100, v: 1000 }; // opening range
    if (m === 600) bar = { t: tsAt(m), o: 100.5, h: 101.6, l: 100.4, c: 101.5, v: 3000 }; // break
    bars.push(bar);
  }
  return bars;
}

test("etMinutes maps 9:30 ET to 570", () => {
  assert.equal(etMinutes(tsAt(570)), 570);
});

test("buildSession computes the opening range and the gap", () => {
  const s = buildSession("T", breakoutBars(), 95, config); // prevClose 95, open 100 → +5.3% gap
  assert.equal(s.orbHigh, 101);
  assert.equal(s.orbLow, 99);
  assert.ok(Math.abs(s.gapPct - (100 - 95) / 95) < 1e-9);
});

test("ORB fires on the break of the opening-range high", () => {
  const s = buildSession("T", breakoutBars(), 100, config);
  const hit = STRATEGIES.ORB(s, config);
  assert.ok(hit, "expected an ORB entry");
  assert.equal(hit.setup.type, "ORB");
  assert.ok(hit.setup.stop < hit.setup.entry && hit.setup.entry < hit.setup.target);
});

test("Gap-and-go requires a gap: fires when gapped up, not when flat", () => {
  const gapped = buildSession("T", breakoutBars(), 95, config); // +5.3% gap
  assert.ok(STRATEGIES["Gap-and-go"](gapped, config), "should fire on a gapper");
  const flat = buildSession("T", breakoutBars(), 100.0, config); // ~0% gap
  assert.equal(STRATEGIES["Gap-and-go"](flat, config), null);
});

test("VWAP reversion fires on a stretched dip that closes green", () => {
  const bars = [];
  for (let m = 570; m < 595; m++) bars.push({ t: tsAt(m), o: 100, h: 100.2, l: 99.8, c: 100, v: 1000 });
  bars.push({ t: tsAt(595), o: 99.1, h: 99.6, l: 99.0, c: 99.5, v: 4000 }); // deep dip, green close
  const s = buildSession("T", bars, 100, config);
  const hit = STRATEGIES["VWAP reversion"](s, config);
  assert.ok(hit, "expected a reversion entry");
  assert.equal(hit.setup.type, "VWAP reversion");
  assert.ok(hit.setup.target >= hit.setup.entry);
});
