// A broad set of liquid, frequently-volatile US names for the gap-and-go fair
// test. This is a PROXY for "the whole market" — it covers the usual gappers
// (high-beta tech, biotech, meme, EV, crypto-adjacent, small/mid momentum) but
// will still miss some one-off gappers in obscure tickers. To go truly
// whole-market you'd feed the full SEC/Alpaca symbol list here (slower).

export const DAYTRADE_UNIVERSE = [
  // mega/large-cap movers
  "AAPL", "MSFT", "NVDA", "AMD", "META", "AMZN", "GOOGL", "TSLA", "NFLX", "AVGO",
  "INTC", "MU", "QCOM", "ORCL", "CRM", "ADBE", "PYPL", "SHOP", "UBER", "ABNB",
  // high-beta / momentum / meme
  "PLTR", "COIN", "MARA", "RIOT", "CLSK", "MSTR", "SOFI", "HOOD", "AFRM", "UPST",
  "RBLX", "DKNG", "CVNA", "GME", "AMC", "BBAI", "SOUN", "IONQ", "RGTI", "QBTS",
  "SMCI", "ARM", "DELL", "ANET", "MRVL", "ON", "WOLF", "ENPH", "FSLR", "RUN",
  // EV / clean / China ADRs
  "RIVN", "LCID", "NIO", "XPEV", "LI", "BABA", "PDD", "JD", "BIDU", "FUTU",
  // biotech (frequent catalyst gappers)
  "MRNA", "BNTX", "NVAX", "SAVA", "VKTX", "CRSP", "BEAM", "NTLA", "EXAS", "ALNY",
  // financials / energy / other liquid movers
  "BAC", "JPM", "WFC", "C", "GS", "OXY", "DVN", "MPC", "SLB", "HAL",
  "DIS", "BA", "F", "GM", "T", "WBD", "PARA", "SNAP", "PINS", "ROKU",
  "DASH", "NET", "DDOG", "SNOW", "CRWD", "ZS", "PANW", "MDB", "OKTA", "TWLO",
  "LULU", "NKE", "SBUX", "CMG", "TGT", "WMT", "COST", "DLTR", "KSS", "M",
  "CHWY", "ETSY", "W", "PTON", "BYND", "TDOC", "DKS", "ULTA", "RH", "FIVE",
];
