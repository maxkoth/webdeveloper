// Interactive Brokers adapter (TWS / IB Gateway socket API via @stoqey/ib).
//
// IBKR has no cloud REST API: this connects to IB Gateway or Trader Workstation
// running on YOUR machine — paper port 7497, live port 7496. The library is
// lazy-imported so the dry-run path and tests never load it.
//
// !! NOT EXERCISED IN CI: placing real orders requires a live Gateway socket,
// which can't run in this sandbox. The protocol calls below follow the IB API
// faithfully, but VALIDATE ON PAPER (port 7497) before trusting a live port.
// Live placement additionally requires IBKR_ALLOW_LIVE=1 (see assertLiveAllowed).

import type { IBApi as IBApiType, Contract } from "@stoqey/ib";
import type {
  Account,
  BracketOrder,
  BrokerAdapter,
  PlacedOrder,
  Position,
} from "./types";

const DEFAULT_HOST = "127.0.0.1";
const PAPER_PORT = 7497;

export class IbkrBroker implements BrokerAdapter {
  readonly mode: string;
  private api: IBApiType | null = null;
  private nextId = -1;
  private readonly host: string;
  private readonly port: number;
  private readonly clientId: number;

  constructor() {
    this.host = process.env.IBKR_HOST ?? DEFAULT_HOST;
    this.port = Number(process.env.IBKR_PORT ?? PAPER_PORT);
    this.clientId = Number(process.env.IBKR_CLIENT_ID ?? 101);
    this.mode = `IBKR ${this.port === PAPER_PORT ? "paper" : "LIVE"} (${this.host}:${this.port})`;
  }

  async connect(): Promise<void> {
    assertLiveAllowed(this.port);
    const ib = await import("@stoqey/ib");
    const { IBApi, EventName } = ib;
    const api = new IBApi({ host: this.host, port: this.port, clientId: this.clientId });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("IBKR connect timed out — is IB Gateway/TWS running and API enabled?")),
        10_000,
      );
      api.once(EventName.nextValidId, (id: number) => {
        this.nextId = id;
        clearTimeout(timer);
        resolve();
      });
      api.on(EventName.error, (err: Error, code: number) => {
        // Codes < 2000 are connectivity/auth errors worth surfacing on connect.
        if (this.nextId < 0 && code < 2000) {
          clearTimeout(timer);
          reject(new Error(`IBKR error ${code}: ${err.message}`));
        }
      });
      api.connect();
    });
    this.api = api;
  }

  async getAccount(): Promise<Account> {
    const api = this.require();
    const ib = await import("@stoqey/ib");
    const { EventName } = ib;
    const reqId = this.takeId();
    const values: Record<string, number> = {};

    return new Promise<Account>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("account summary timed out")), 10_000);
      const onSummary = (id: number, _acct: string, tag: string, value: string) => {
        if (id === reqId) values[tag] = Number(value);
      };
      api.on(EventName.accountSummary, onSummary);
      api.once(EventName.accountSummaryEnd, (id: number) => {
        if (id !== reqId) return;
        clearTimeout(timer);
        api.off(EventName.accountSummary, onSummary);
        api.cancelAccountSummary(reqId);
        resolve({
          equity: values["NetLiquidation"] ?? 0,
          cash: values["TotalCashValue"] ?? 0,
          buyingPower: values["BuyingPower"] ?? 0,
        });
      });
      api.reqAccountSummary(reqId, "All", "NetLiquidation,TotalCashValue,BuyingPower");
    });
  }

  async getPositions(): Promise<Position[]> {
    const api = this.require();
    const ib = await import("@stoqey/ib");
    const { EventName } = ib;
    const out: Position[] = [];

    return new Promise<Position[]>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("positions timed out")), 10_000);
      const onPos = (
        _acct: string,
        contract: Contract,
        pos: number,
        avgCost?: number,
      ) => {
        if (contract.symbol && pos !== 0) {
          out.push({ symbol: contract.symbol, qty: pos, avgPrice: avgCost ?? 0 });
        }
      };
      api.on(EventName.position, onPos);
      api.once(EventName.positionEnd, () => {
        clearTimeout(timer);
        api.off(EventName.position, onPos);
        api.cancelPositions();
        resolve(out);
      });
      api.reqPositions();
    });
  }

  /** Submit a native IB bracket: parent entry + OCA stop-loss + take-profit. */
  async placeBracket(order: BracketOrder): Promise<PlacedOrder> {
    const api = this.require();
    const ib = await import("@stoqey/ib");
    const { OrderAction, OrderType, SecType } = ib;

    const contract = {
      symbol: order.symbol,
      secType: SecType.STK,
      exchange: "SMART",
      currency: "USD",
    };

    const parentId = this.takeId();
    const tpId = this.takeId();
    const slId = this.takeId();
    const exit = order.side === "BUY" ? OrderAction.SELL : OrderAction.BUY;

    // Parent entry. transmit=false so the children attach before anything fires.
    api.placeOrder(parentId, contract, {
      action: order.side === "BUY" ? OrderAction.BUY : OrderAction.SELL,
      orderType: order.entryType === "LMT" ? OrderType.LMT : OrderType.MKT,
      totalQuantity: order.qty,
      lmtPrice: order.entryType === "LMT" ? order.limitPrice : undefined,
      transmit: false,
    });
    // Take-profit child.
    api.placeOrder(tpId, contract, {
      action: exit,
      orderType: OrderType.LMT,
      totalQuantity: order.qty,
      lmtPrice: order.takeProfit,
      parentId,
      transmit: false,
    });
    // Stop-loss child — transmit=true releases the whole bracket.
    api.placeOrder(slId, contract, {
      action: exit,
      orderType: OrderType.STP,
      auxPrice: order.stopLoss,
      totalQuantity: order.qty,
      parentId,
      transmit: true,
    });

    return { id: String(parentId), symbol: order.symbol, status: "submitted" };
  }

  async disconnect(): Promise<void> {
    try {
      this.api?.disconnect();
    } catch {
      /* already down */
    }
    this.api = null;
  }

  private require(): IBApiType {
    if (!this.api) throw new Error("IBKR not connected — call connect() first");
    return this.api;
  }

  private takeId(): number {
    return this.nextId++;
  }
}

/** Refuse a live port unless the operator has explicitly opted in. */
function assertLiveAllowed(port: number): void {
  if (port !== PAPER_PORT && process.env.IBKR_ALLOW_LIVE !== "1") {
    throw new Error(
      `Refusing to connect to a LIVE IBKR port (${port}) without IBKR_ALLOW_LIVE=1. ` +
        `Use the paper port (${PAPER_PORT}) or set the flag deliberately.`,
    );
  }
}
