// Shared types for the daily setup scanner.
//
// The pipeline is: pull a universe of active/high-momentum names from
// TradingView's public scanner -> enrich the top candidates with Yahoo
// daily OHLC -> score each one across five transparent dimensions -> rank.
// Nothing here predicts the future; it ranks how closely today's tape
// matches the profile of a strong, in-play setup. Not financial advice.

/** One row straight off the TradingView scanner, already mapped to names. */
export type RawQuote = {
  symbol: string;
  name: string;
  close: number;
  /** Day change, percent. */
  changePct: number;
  volume: number;
  /** Volume today vs its own 10-day average. >1 means unusual participation. */
  relVolume: number;
  marketCap: number;
  rsi: number;
  /** Momentum oscillator value from TradingView. */
  momentum: number;
  /** Trend strength. ADX > 25 is a trending (not chopping) name. */
  adx: number;
  macd: number;
  macdSignal: number;
  sma20: number;
  sma50: number;
  sma200: number;
  /** Opening gap vs prior close, percent — a fingerprint of overnight news. */
  gapPct: number;
  high52: number;
  low52: number;
  /** TradingView's aggregate technical rating, -1 (sell) .. 1 (buy). */
  rating: number;
  sector: string;
};

/** Daily OHLC series for one symbol (from Yahoo), oldest -> newest. */
export type PriceSeries = {
  symbol: string;
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
};

/** Support / resistance derived from recent price structure. */
export type Levels = {
  support: number;
  resistance: number;
  /** How far price sits inside the [support, resistance] band, 0..1. */
  positionInRange: number;
};

/** One scored dimension of a setup. `score` is 0..1, pre-weighting. */
export type Dimension = {
  key: "momentum" | "trend" | "participation" | "technical" | "catalyst";
  label: string;
  score: number;
  weight: number;
  /** One-line, human-readable justification shown in the UI. */
  note: string;
};

export type SetupKind =
  | "Momentum Breakout"
  | "Pullback in Uptrend"
  | "Volume Surge"
  | "Trend Continuation"
  | "Oversold Bounce"
  | "In Play";

/** A fully scored, rankable trade setup. */
export type Setup = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  relVolume: number;
  kind: SetupKind;
  /** Composite 0..100. Higher = more of the boxes ticked, not a probability. */
  score: number;
  dimensions: Dimension[];
  levels: Levels;
  /** Plan scaffolding — reference levels only, never a recommendation. */
  plan: {
    entryZone: number;
    stop: number;
    target: number;
    /** target-to-stop distance ratio from the entry zone. */
    rMultiple: number;
  };
  /** Last 30 closes for the sparkline. */
  spark: number[];
};

export type ScanResult = {
  generatedAt: string;
  /** "live" when both data sources answered; "sample" on the bundled fallback. */
  source: "live" | "sample";
  /** Non-fatal notes — e.g. which data source was unreachable. */
  warnings: string[];
  universeSize: number;
  setups: Setup[];
};
