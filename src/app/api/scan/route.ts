// GET /api/scan — returns the day's ranked setups as JSON.
//
// Always runs at request time (the data is intraday). Pass `?sample=1` to force
// the bundled fallback, or `?limit=N` to change how many setups come back.

import { NextResponse } from "next/server";
import { runScan } from "@/lib/scanner/scan";

// Never prerender or cache: this must reflect the live tape on each request.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sample = searchParams.get("sample") === "1";
  const limitParam = Number(searchParams.get("limit"));
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 50
      ? limitParam
      : undefined;

  const result = await runScan({ sample, limit });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
