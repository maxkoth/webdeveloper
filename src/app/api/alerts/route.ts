// POST /api/alerts?mode=digest|threshold — runs a fresh scan and sends the
// matching SMS alert. Meant to be called by a scheduler (Vercel Cron, GitHub
// Action, etc.). Protected by a shared secret so randoms can't make you text
// yourself: send `Authorization: Bearer <ALERT_SECRET>` or `?secret=`.

import { NextResponse } from "next/server";
import { runScan } from "@/lib/scanner/scan";
import { dispatchAlerts, type AlertMode } from "@/lib/alerts/dispatch";

export const dynamic = "force-dynamic";

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret) return false; // refuse to run unprotected
  const url = new URL(request.url);
  const bearer = request.headers.get("authorization");
  return bearer === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

async function handle(request: Request) {
  const secret = process.env.ALERT_SECRET;
  if (!authorized(request, secret)) {
    return NextResponse.json(
      { error: "unauthorized (set ALERT_SECRET and pass it)" },
      { status: 401 },
    );
  }

  const mode = (new URL(request.url).searchParams.get("mode") ??
    "digest") as AlertMode;
  if (mode !== "digest" && mode !== "threshold") {
    return NextResponse.json({ error: "mode must be digest|threshold" }, {
      status: 400,
    });
  }

  const scan = await runScan();
  const outcome = await dispatchAlerts(scan, mode);
  return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
}

export const POST = handle;
// Allow GET too, so simple cron services that only do GETs still work.
export const GET = handle;
