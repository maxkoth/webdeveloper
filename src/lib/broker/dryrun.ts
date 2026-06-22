// Dry-run broker. Places nothing — it logs the exact orders the autopilot
// would submit and tracks a simulated portfolio in memory (optionally persisted
// to STATE_FILE). This is the default mode: it lets you watch the autopilot
// pick and size positions over real sessions with zero financial risk before
// you ever connect a live account.

import { promises as fs } from "node:fs";
import type {
  Account,
  BracketOrder,
  BrokerAdapter,
  PlacedOrder,
  Position,
} from "./types";

type DryState = {
  cash: number;
  startEquity: number;
  positions: Position[];
};

export class DryRunBroker implements BrokerAdapter {
  readonly mode = "dry-run";
  private state: DryState;
  private readonly statePath?: string;
  private counter = 0;

  constructor(startEquity = 100_000, statePath?: string) {
    this.statePath = statePath;
    this.state = { cash: startEquity, startEquity, positions: [] };
  }

  async connect(): Promise<void> {
    if (!this.statePath) return;
    try {
      const raw = await fs.readFile(this.statePath, "utf8");
      this.state = JSON.parse(raw) as DryState;
    } catch {
      await this.persist(); // first run — seed the file
    }
  }

  async getAccount(): Promise<Account> {
    // Mark positions at cost (no live quotes in dry run); equity = cash + cost.
    const invested = this.state.positions.reduce(
      (sum, p) => sum + p.qty * p.avgPrice,
      0,
    );
    const equity = this.state.cash + invested;
    return { equity, cash: this.state.cash, buyingPower: this.state.cash };
  }

  async getPositions(): Promise<Position[]> {
    return [...this.state.positions];
  }

  async placeBracket(order: BracketOrder): Promise<PlacedOrder> {
    const fill =
      order.entryType === "LMT" && order.limitPrice
        ? order.limitPrice
        : estimateFill(order);
    const cost = order.qty * fill;

    if (order.side === "BUY") {
      this.state.cash -= cost;
      const existing = this.state.positions.find((p) => p.symbol === order.symbol);
      if (existing) {
        const totalQty = existing.qty + order.qty;
        existing.avgPrice =
          (existing.avgPrice * existing.qty + fill * order.qty) / totalQty;
        existing.qty = totalQty;
      } else {
        this.state.positions.push({
          symbol: order.symbol,
          qty: order.qty,
          avgPrice: fill,
        });
      }
    }

    const id = `DRY-${++this.counter}`;
    console.log(
      `  [dry-run] ${order.side} ${order.qty} ${order.symbol} ` +
        `@~${fill.toFixed(2)}  stop ${order.stopLoss.toFixed(2)}  ` +
        `target ${order.takeProfit.toFixed(2)}  (cost ~$${cost.toFixed(0)})`,
    );
    await this.persist();
    return { id, symbol: order.symbol, status: "simulated" };
  }

  async disconnect(): Promise<void> {
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.statePath) return;
    try {
      await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2));
    } catch {
      // Non-fatal in a dry run.
    }
  }
}

/** Without live quotes we assume entry near the take-profit-implied reference. */
function estimateFill(order: BracketOrder): number {
  // Midpoint between stop and target is a neutral stand-in for the entry price.
  return (order.stopLoss + order.takeProfit) / 2;
}
