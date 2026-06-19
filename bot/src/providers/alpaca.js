// Alpaca provider. Uses the screener (movers + most-actives) as the candidate
// source — cheaper and works on the FREE tier. `feed=iex` is free (a subset of
// volume, real-time); `feed=sip` is the paid full-market feed.

const DATA = "https://data.alpaca.markets";

function headers(cfg) {
  return {
    "APCA-API-KEY-ID": cfg.alpaca.keyId,
    "APCA-API-SECRET-KEY": cfg.alpaca.secret,
    Accept: "application/json",
  };
}

async function aget(url, cfg) {
  const res = await fetch(url, { headers: headers(cfg) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Alpaca ${res.status} ${url.replace(DATA, "")}: ${body.slice(0, 160)}`);
  }
  return res.json();
}

export function alpacaProvider() {
  return {
    name: "alpaca",
    async getRawTickers(cfg) {
      // Movers carry price + % change (the "moving" filter); most-actives add
      // volume. Both are cheap single calls and cover the day's plays.
      const [movers, actives] = await Promise.all([
        aget(`${DATA}/v1beta1/screener/stocks/movers?top=50`, cfg).catch(() => ({ gainers: [], losers: [] })),
        aget(`${DATA}/v1beta1/screener/stocks/most-actives?by=volume&top=50`, cfg).catch(() => ({ most_actives: [] })),
      ]);
      const volBySym = new Map((actives.most_actives || []).map((a) => [a.symbol, a.volume]));
      const rows = [];
      const seen = new Set();
      for (const m of [...(movers.gainers || []), ...(movers.losers || [])]) {
        seen.add(m.symbol);
        rows.push({
          ticker: m.symbol,
          price: m.price ?? null,
          dayVolume: volBySym.get(m.symbol) ?? null,
          prevVolume: 0, // unknown from screener → relVol simply not enforced
          changePct: m.percent_change ?? null,
        });
      }
      for (const a of actives.most_actives || []) {
        if (seen.has(a.symbol)) continue;
        rows.push({ ticker: a.symbol, price: null, dayVolume: a.volume, prevVolume: 0, changePct: null });
      }
      return rows;
    },
    async getBars(cfg, ticker, fromMs, toMs) {
      const start = new Date(fromMs).toISOString();
      const end = new Date(toMs).toISOString();
      const url =
        `${DATA}/v2/stocks/${encodeURIComponent(ticker)}/bars` +
        `?timeframe=1Min&start=${start}&end=${end}&limit=10000&adjustment=raw&feed=${cfg.alpaca.feed}`;
      const d = await aget(url, cfg);
      return (d.bars || []).map((b) => ({ t: Date.parse(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
    },
    // Multi-symbol DAILY bars (for detecting gappers across a universe). Batches
    // symbols and follows pagination. Returns Map<symbol, bars[]>.
    async getDailyBars(cfg, symbols, fromMs, toMs) {
      const out = new Map();
      const CHUNK = 100;
      for (let i = 0; i < symbols.length; i += CHUNK) {
        const batch = symbols.slice(i, i + CHUNK);
        let pageToken = null;
        do {
          const params = new URLSearchParams({
            symbols: batch.join(","),
            timeframe: "1Day",
            start: new Date(fromMs).toISOString(),
            end: new Date(toMs).toISOString(),
            limit: "10000",
            adjustment: "raw",
            feed: cfg.alpaca.feed,
          });
          if (pageToken) params.set("page_token", pageToken);
          const d = await aget(`${DATA}/v2/stocks/bars?${params}`, cfg);
          for (const [sym, bars] of Object.entries(d.bars || {})) {
            const mapped = bars.map((b) => ({ t: Date.parse(b.t), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
            out.set(sym, (out.get(sym) || []).concat(mapped));
          }
          pageToken = d.next_page_token || null;
        } while (pageToken);
      }
      return out;
    },
  };
}
