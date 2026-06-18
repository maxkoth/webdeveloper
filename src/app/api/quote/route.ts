import { NextRequest } from "next/server";
import { quoteFor } from "@/lib/research/price";

// Live quote route. The only genuinely real-time piece of the research page:
// fetches current and baseline prices at REQUEST time so margin of safety and
// return-since-analysis are computed against a live market price. Route Handlers
// are uncached by default in this Next version; a short s-maxage keeps client
// polling cheap without hammering the upstream feed.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const symbols = (params.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  const since = /^\d{4}-\d{2}-\d{2}$/.test(params.get("since") ?? "")
    ? (params.get("since") as string)
    : "1970-01-01";

  if (symbols.length === 0) {
    return Response.json({ error: "no symbols" }, { status: 400 });
  }

  const quotes = await Promise.all(symbols.map((s) => quoteFor(s, since)));

  return Response.json(
    { since, quotes },
    {
      headers: {
        // Short edge cache so client polling (~60s) sees fresh quotes without
        // hammering the upstream feed on every visitor's every poll.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
