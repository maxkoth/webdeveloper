// Broker abstraction. The autopilot talks to this interface only, so the same
// engine drives a risk-free dry run or a live Interactive Brokers connection
// with a one-line swap. Nothing here is specific to a strategy.

export type OrderSide = "BUY" | "SELL";

/** A bracket order: an entry plus an attached stop-loss and take-profit. */
export type BracketOrder = {
  symbol: string;
  side: OrderSide;
  qty: number;
  /** "MKT" fills now; "LMT" waits for limitPrice. */
  entryType: "MKT" | "LMT";
  limitPrice?: number;
  stopLoss: number;
  takeProfit: number;
};

export type Position = {
  symbol: string;
  qty: number;
  avgPrice: number;
};

export type Account = {
  /** Net liquidation value — total account equity. */
  equity: number;
  cash: number;
  buyingPower: number;
};

export type PlacedOrder = {
  id: string;
  symbol: string;
  status: string;
};

/**
 * Everything the engine needs from a broker. Implementations must be safe to
 * call repeatedly and must never place an order from a read method.
 */
export interface BrokerAdapter {
  /** Human-readable mode for logs/reports, e.g. "dry-run" or "IBKR paper". */
  readonly mode: string;
  connect(): Promise<void>;
  getAccount(): Promise<Account>;
  getPositions(): Promise<Position[]>;
  placeBracket(order: BracketOrder): Promise<PlacedOrder>;
  disconnect(): Promise<void>;
}
