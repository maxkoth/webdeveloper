// "Pilot" copy-trading — the second strategy, modelled on the Autopilot app:
// mirror an external source's positions (a momentum portfolio, a fund, or
// disclosed Congress trades) into your account.
//
// HONESTY: copy-trading needs a feed of someone's actual trades. Those feeds
// are either paid (e.g. Quiver/Unusual Whales for Congress disclosures) or
// scraped, and disclosures lag the real trade by days to weeks — so this is
// NOT "trade alongside Pelosi in real time". The interface below is real and
// wired into the engine; the built-in source returns nothing until you plug a
// feed into `fetchPilotTargets`. This keeps the "both strategies" structure
// honest instead of faking a data source we don't have.

export type PilotTarget = {
  symbol: string;
  /** Desired weight of this name within the pilot sleeve, 0..1. */
  weight: number;
  /** Where it came from, for the order's audit note. */
  reason: string;
};

export interface PilotSource {
  readonly name: string;
  fetchTargets(): Promise<PilotTarget[]>;
}

/**
 * Default source: a no-op until configured. Set PILOT_FEED_URL to a JSON
 * endpoint returning `{ symbol, weight }[]` (your own screener, a Congress-
 * trade provider, etc.) and it will be honoured. Returns [] otherwise.
 */
export const defaultPilot: PilotSource = {
  name: process.env.PILOT_NAME ?? "pilot",
  async fetchTargets() {
    const url = process.env.PILOT_FEED_URL;
    if (!url) return [];
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return [];
      const raw = (await res.json()) as { symbol?: string; weight?: number }[];
      return raw
        .filter((r) => r.symbol)
        .map((r) => ({
          symbol: r.symbol!.toUpperCase(),
          weight: clamp01(r.weight ?? 0),
          reason: `pilot:${process.env.PILOT_NAME ?? "feed"}`,
        }));
    } catch {
      return [];
    }
  },
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
