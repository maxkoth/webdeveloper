import { alpacaProvider } from "./alpaca.js";
import { polygonProvider } from "./polygon.js";

/** Returns the data provider selected in config. A provider exposes:
 *    getRawTickers(cfg) -> [{ticker, price, dayVolume, prevVolume, changePct}]
 *    getBars(cfg, ticker, fromMs, toMs) -> [{t,o,h,l,c,v}]
 */
export function makeProvider(cfg) {
  return cfg.dataProvider === "polygon" ? polygonProvider() : alpacaProvider();
}
