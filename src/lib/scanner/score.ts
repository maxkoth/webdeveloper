// The scoring engine. Given a snapshot quote (TradingView) and optional price
// history (Yahoo), it grades a name across five dimensions, blends them into a
// single 0..100 score, classifies the setup, and sketches reference levels.
//
// Every number here is explainable on purpose: the goal is a screen a human
// can audit and argue with, not a black box. A high score means "many of the
// hallmarks of an in-play, technically constructive setup are present right
// now" — it is emphatically NOT a probability or a recommendation.

import { atr, clamp, levels, normalize, roc } from "./indicators";
import type {
  Dimension,
  Levels,
  NewsSignal,
  PriceSeries,
  RawQuote,
  Setup,
  SetupKind,
} from "./types";

const WEIGHTS = {
  momentum: 25,
  trend: 20,
  participation: 20,
  technical: 20,
  catalyst: 15,
} as const;

/** Momentum: is price moving with conviction, without being blown-off? */
function scoreMomentum(q: RawQuote, series?: PriceSeries): Dimension {
  // Day change, rewarded up to ~+8%.
  const dayMove = normalize(q.changePct, 0, 8);
  // Multi-week thrust from the price series when we have it.
  const thrust = series ? normalize(roc(series.closes, 20) ?? 0, -5, 25) : 0.5;
  // RSI sweet spot: 55–70 is strong-but-not-exhausted. Penalise >75 (extended).
  const rsiZone =
    q.rsi >= 55 && q.rsi <= 70
      ? 1
      : q.rsi > 70
        ? clamp(1 - (q.rsi - 70) / 20, 0, 1)
        : normalize(q.rsi, 40, 55);

  const score = clamp(0.45 * dayMove + 0.3 * thrust + 0.25 * rsiZone, 0, 1);
  const note =
    q.rsi > 75
      ? `Strong move (+${q.changePct.toFixed(1)}%) but RSI ${q.rsi.toFixed(0)} is extended`
      : `+${q.changePct.toFixed(1)}% today, RSI ${q.rsi.toFixed(0)} in a constructive zone`;
  return { key: "momentum", label: "Momentum", score, weight: WEIGHTS.momentum, note };
}

/** Trend: is the moving-average stack stacked, and is the trend real (ADX)? */
function scoreTrend(q: RawQuote): Dimension {
  const stacked =
    q.close > q.sma20 && q.sma20 > q.sma50 && q.sma50 > q.sma200 ? 1 : 0;
  const partial =
    q.close > q.sma50 && q.sma50 > q.sma200 ? 0.6 : q.close > q.sma200 ? 0.35 : 0;
  const structure = Math.max(stacked, partial);
  // ADX > 25 = trending; reward up to 40.
  const adxStrength = normalize(q.adx, 15, 40);
  // TradingView aggregate rating, -1..1 -> 0..1.
  const rating = normalize(q.rating, -0.5, 1);

  const score = clamp(0.5 * structure + 0.25 * adxStrength + 0.25 * rating, 0, 1);
  const note =
    stacked === 1
      ? `Full MA stack (20>50>200), ADX ${q.adx.toFixed(0)}`
      : structure > 0
        ? `Above the 200-day, ADX ${q.adx.toFixed(0)}`
        : `Below key moving averages — trend not confirmed`;
  return { key: "trend", label: "Trend", score, weight: WEIGHTS.trend, note };
}

/** Participation: unusual volume is the market voting with size. */
function scoreParticipation(q: RawQuote): Dimension {
  // relVolume of 1 = normal; 3+ = heavy. This is the single best "in play" tell.
  const score = normalize(q.relVolume, 1, 4);
  const note =
    q.relVolume >= 1.5
      ? `${q.relVolume.toFixed(1)}× normal volume — heavy participation`
      : `${q.relVolume.toFixed(1)}× normal volume — average interest`;
  return {
    key: "participation",
    label: "Volume",
    score,
    weight: WEIGHTS.participation,
    note,
  };
}

/** Technical setup: MACD posture + where price sits vs its 52-week range. */
function scoreTechnical(q: RawQuote, lv: Levels | null): Dimension {
  const macdBull = q.macd > q.macdSignal ? 1 : 0;
  const macdGap = normalize(q.macd - q.macdSignal, 0, Math.abs(q.macd) || 1);
  // Position in the 52-week range: breakouts live near the highs.
  const range52 =
    q.high52 > q.low52 ? normalize(q.close, q.low52, q.high52) : 0.5;

  // If we have intraday levels, reward names coiled just under resistance
  // (breakout pending) or holding above reclaimed support.
  let structureBonus = 0.5;
  if (lv) {
    const p = lv.positionInRange;
    structureBonus = p > 0.7 ? 0.9 : p < 0.3 ? 0.4 : 0.65;
  }

  const score = clamp(
    0.35 * (0.5 * macdBull + 0.5 * macdGap) + 0.35 * range52 + 0.3 * structureBonus,
    0,
    1,
  );
  const note = macdBull
    ? `MACD positive, trading in the top ${((1 - range52) * 100).toFixed(0)}% of its 52-wk range`
    : `MACD below signal — momentum cooling`;
  return { key: "technical", label: "Technicals", score, weight: WEIGHTS.technical, note };
}

/**
 * Catalyst. When real news data is supplied (Finnhub), we score actual
 * headline sentiment plus coverage volume. Without it we fall back to an
 * HONEST proxy: a meaningful overnight gap on heavy relative volume is the
 * statistical fingerprint of a news-driven move (earnings, upgrade, contract).
 * The note makes clear which of the two is in play.
 */
function scoreCatalyst(q: RawQuote, news?: NewsSignal): Dimension {
  if (news) {
    // Bullish sentiment (0..1 from -1..1), weighted by how much coverage there
    // is — one stray article shouldn't swing the score like a wall of them.
    const lean = normalize(news.sentiment, -0.4, 0.6);
    const coverage = normalize(news.articleCount, 1, 12);
    const score = clamp(0.7 * lean + 0.3 * coverage, 0, 1);
    const dir =
      news.sentiment > 0.1 ? "bullish" : news.sentiment < -0.1 ? "bearish" : "mixed";
    const note = `News ${dir} (${news.sentiment >= 0 ? "+" : ""}${news.sentiment.toFixed(2)}) across ${news.articleCount} articles`;
    return { key: "catalyst", label: "Catalyst", score, weight: WEIGHTS.catalyst, note };
  }

  const gapMag = normalize(Math.abs(q.gapPct), 1, 8);
  const volConfirm = normalize(q.relVolume, 1.5, 4);
  const score = clamp(0.6 * gapMag + 0.4 * volConfirm, 0, 1);
  const note =
    Math.abs(q.gapPct) >= 2
      ? `Gapped ${q.gapPct > 0 ? "+" : ""}${q.gapPct.toFixed(1)}% on heavy volume — likely catalyst (proxy)`
      : `No major gap — catalyst signal weak (proxy)`;
  return { key: "catalyst", label: "Catalyst", score, weight: WEIGHTS.catalyst, note };
}

/** Pick the label that best describes why this name screened. */
function classify(q: RawQuote, dims: Dimension[], lv: Levels | null): SetupKind {
  const by = (k: Dimension["key"]) => dims.find((d) => d.key === k)?.score ?? 0;
  const nearHighs = lv ? lv.positionInRange > 0.8 : q.close > q.sma20;

  if (q.rsi < 40 && q.changePct > 0) return "Oversold Bounce";
  if (by("participation") > 0.7 && by("momentum") > 0.6) return "Volume Surge";
  if (nearHighs && by("momentum") > 0.6 && by("trend") > 0.6)
    return "Momentum Breakout";
  if (by("trend") > 0.6 && q.changePct < 1 && q.close > q.sma50)
    return "Pullback in Uptrend";
  if (by("trend") > 0.6) return "Trend Continuation";
  return "In Play";
}

/** Reference levels for a plan — derived from ATR and support, never advice. */
function buildPlan(q: RawQuote, lv: Levels | null, series?: PriceSeries) {
  const a = series ? atr(series) : null;
  const risk = a ?? q.close * 0.03; // fall back to a 3% unit if ATR is absent
  const support = lv?.support ?? q.close - 2 * risk;
  const entryZone = q.close;
  const stop = Math.min(support - 0.2 * risk, q.close - 1.5 * risk);
  const target = q.close + 2 * (q.close - stop); // a 2R first objective
  const rMultiple = (target - entryZone) / Math.max(entryZone - stop, 1e-6);
  return {
    entryZone: round(entryZone),
    stop: round(stop),
    target: round(target),
    rMultiple: Math.round(rMultiple * 10) / 10,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Score one name end to end. `series` (Yahoo history) and `news` (Finnhub
 * sentiment) are both optional — the engine degrades cleanly without either.
 */
export function scoreSetup(
  q: RawQuote,
  series?: PriceSeries,
  news?: NewsSignal,
): Setup {
  const lv = series ? levels(series) : null;
  const dims: Dimension[] = [
    scoreMomentum(q, series),
    scoreTrend(q),
    scoreParticipation(q),
    scoreTechnical(q, lv),
    scoreCatalyst(q, news),
  ];

  const weighted = dims.reduce((sum, d) => sum + d.score * d.weight, 0);
  const totalWeight = dims.reduce((sum, d) => sum + d.weight, 0);
  const score = Math.round((weighted / totalWeight) * 100);

  const spark = series ? series.closes.slice(-30) : [];

  return {
    symbol: q.symbol,
    name: q.name,
    sector: q.sector,
    price: round(q.close),
    changePct: Math.round(q.changePct * 100) / 100,
    relVolume: Math.round(q.relVolume * 100) / 100,
    kind: classify(q, dims, lv),
    score,
    dimensions: dims,
    levels: lv ?? {
      support: round(q.close * 0.95),
      resistance: round(q.close * 1.05),
      positionInRange: 0.5,
    },
    plan: buildPlan(q, lv, series),
    spark,
    headline: news?.topHeadline,
  };
}
