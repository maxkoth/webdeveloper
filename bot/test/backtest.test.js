import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTrade, summarize } from "../src/backtest.js";

const trade = { entry: 100, stop: 99, target: 102 }; // risk 1, target +2R

test("evaluateTrade: target hit → win (no slippage = +2R)", () => {
  const bars = [
    { o: 100, h: 100.5, l: 99.8, c: 100.2 },
    { o: 100.2, h: 102.1, l: 100, c: 101.9 }, // hits target 102
  ];
  const r = evaluateTrade(trade, bars, { maxHoldBars: 60, slippageBps: 0 });
  assert.equal(r.outcome, "win");
  assert.ok(Math.abs(r.r - 2) < 1e-9);
});

test("evaluateTrade: stop hit → loss (no slippage = -1R)", () => {
  const bars = [{ o: 100, h: 100.2, l: 98.5, c: 99.1 }];
  const r = evaluateTrade(trade, bars, { maxHoldBars: 60, slippageBps: 0 });
  assert.equal(r.outcome, "loss");
  assert.ok(Math.abs(r.r + 1) < 1e-9);
});

test("evaluateTrade: same-bar ambiguity assumes stop (conservative)", () => {
  const bars = [{ o: 100, h: 102.5, l: 98.5, c: 101 }];
  assert.equal(evaluateTrade(trade, bars, { maxHoldBars: 60, slippageBps: 0 }).outcome, "loss");
});

test("evaluateTrade: neither hit → timeout marked to last close", () => {
  const bars = [
    { o: 100, h: 100.4, l: 99.6, c: 100.1 },
    { o: 100.1, h: 100.8, l: 99.7, c: 100.5 }, // close 100.5 → +0.5R
  ];
  const r = evaluateTrade(trade, bars, { maxHoldBars: 60, slippageBps: 0 });
  assert.equal(r.outcome, "timeout");
  assert.ok(Math.abs(r.r - 0.5) < 1e-9);
});

test("evaluateTrade: slippage haircuts the win below +2R", () => {
  const bars = [{ o: 100, h: 102.1, l: 100, c: 101.9 }];
  const r = evaluateTrade(trade, bars, { maxHoldBars: 60, slippageBps: 10 });
  assert.equal(r.outcome, "win");
  // exit = 102*(1-0.001)=101.898 → r=(101.898-100)/1=1.898 < 2
  assert.ok(r.r < 2 && r.r > 1.8);
});

test("summarize computes win rate, expectancy, profit factor", () => {
  const trades = [{ r: 2 }, { r: 2 }, { r: -1 }, { r: -1 }, { r: -1 }];
  const s = summarize(trades);
  assert.equal(s.trades, 5);
  assert.equal(s.wins, 2);
  assert.equal(s.winRate, 0.4);
  assert.ok(Math.abs(s.expectancyR - 0.2) < 1e-9);
  assert.ok(Math.abs(s.profitFactor - 4 / 3) < 1e-9);
});
