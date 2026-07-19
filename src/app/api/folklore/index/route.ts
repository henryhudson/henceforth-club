import { NextResponse } from "next/server";
import { indexSince } from "@/lib/folkloreBoard";

// A cached delta would freeze a client's watermark, so this route is dynamic
// and the response is never stored.
export const dynamic = "force-dynamic";

/**
 * GET /api/folklore/index?since=<ms> → { txids: string[], now: number }
 *
 * The delta feed the app's folklore file syncs against: every txid the board
 * index learned of at or since `since` (index-insertion time, never block
 * time), oldest first, plus the server's own clock for the client to store
 * verbatim as its next watermark. Read-only and public — txids are
 * already-public data, the same posture as the showroom reads. A garbage or
 * negative `since` reads as 0 (the full first sync), never an error.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("since");
  const parsed = Number.parseInt(raw ?? "0", 10);
  const since = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const result = await indexSince(since);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
