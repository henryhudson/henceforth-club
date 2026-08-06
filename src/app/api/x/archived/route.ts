import { NextResponse } from "next/server";
import { archivedTweetIds } from "@/lib/xArchived";

/**
 * GET /api/x/archived?handle=<handle>
 *
 * The set of tweet IDs already archived on chain for a handle — unioned across all
 * of that handle's archive transactions. The app uses this to inscribe only the
 * DELTA (the tweets not yet on chain) instead of duplicating the whole profile.
 * Public data: a TXID and its posts are already public on the blockchain.
 *
 * The union itself lives in lib/xArchived, shared with the archive and quote
 * routes' read-bound check so that "already archived" has exactly one meaning.
 */
export async function GET(req: Request) {
  const handle = new URL(req.url).searchParams
    .get("handle")
    ?.trim()
    .replace(/^@/, "");
  if (!handle || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }

  const archived = await archivedTweetIds(handle);
  if (!archived) {
    // Never present a partial union as authoritative. A dropped transaction
    // would make the app think its tweets are not yet on chain and inscribe
    // (and pay for) them a second time — better to refuse outright.
    return NextResponse.json(
      { ok: false, reason: "index-read-incomplete" },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    archived: archived.txids.length > 0,
    txids: archived.txids,
    tweetIds: [...archived.tweetIds],
    mediaPostIds: [...archived.mediaPostIds],
    count: archived.tweetIds.size,
  });
}
