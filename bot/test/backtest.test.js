import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTrade, summarize } from "../src/backtest.js";

const setup = { entry: 100, stop: 99, target: 102, rr: 2 }; // risk 1, target +2R

test("evaluateTrade: target hit → win at +rr", () => {
  const bars = [
    { o: 100, h: 100.5, l: 99.8, c: 100.2 },
    { o: 100.2, h: 102.1, l: 100, c: 101.9 }, // hits target 102
  ];
  assert.deepEqual(evaluateTrade(setup, bars, 60), { outcome: "win", r: 2 });
});

test("evaluateTrade: stop hit → loss at -1R", () => {
  const bars = [{ o: 100, h: 100.2, l: 98.5, c: 99.1 }]; // low 98.5 <= stop 99
  assert.deepEqual(evaluateTrade(setup, bars, 60), { outcome: "loss", r: -1 });
});

test("evaluateTrade: same-bar ambiguity assumes stop (conservative)", () => {
  const bars = [{ o: 100, h: 102.5, l: 98.5, c: 101 }]; // both stop & target inside
  assert.equal(evaluateTrade(setup, bars, 60).outcome, "loss");
});

test("evaluateTrade: neither hit → timeout marked to last close", () => {
  const bars = [
    { o: 100, h: 100.4, l: 99.6, c: 100.1 },
    { o: 100.1, h: 100.8, l: 99.7, c: 100.5 }, // close 100.5 → +0.5R
  ];
  const r = evaluateTrade(setup, bars, 60);
  assert.equal(r.outcome, "timeout");
  assert.ok(Math.abs(r.r - 0.5) < 1e-9);
});

test("summarize computes win rate, expectancy, profit factor", () => {
  const trades = [{ r: 2 }, { r: 2 }, { r: -1 }, { r: -1 }, { r: -1 }];
  const s = summarize(trades);
  assert.equal(s.trades, 5);
  assert.equal(s.wins, 2);
  assert.equal(s.winRate, 0.4);
  // totalR = 4 - 3 = 1 → expectancy 0.2R
  assert.ok(Math.abs(s.expectancyR - 0.2) < 1e-9);
  // PF = 4 / 3
  assert.ok(Math.abs(s.profitFactor - 4 / 3) < 1e-9);
});
