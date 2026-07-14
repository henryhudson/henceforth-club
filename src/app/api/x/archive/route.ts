import { NextResponse } from "next/server";
import { fetchXArchive, fetchProfileHead, pagesForPostCount, X_TIMELINE_CEILING } from "@/lib/xfetch";
import { selectRefs } from "@/lib/xArchive";
import { payAndReserve, resourcesForPosts } from "@/lib/xGate";
import { releaseXApiSpend } from "@/lib/xSpend";

/**
 * GET /api/x/archive?handle=<h>&payment=<txid>&images=1&videos=1&full=1
 *
 * A profile's posts and the REFERENCES to their media, bought with an on-chain
 * payment. Two things changed on 2026-07-12, and together they are what makes a
 * whole-profile media archive possible at all:
 *
 * 1. ONE read, not two. The media expansions ride the text request — X bills per
 *    resource RETURNED, not per field, so they are free. The old second pass
 *    doubled the bill to fetch what the first read could have returned for
 *    nothing, and (capped at a single page to contain that cost) it is the reason
 *    only the newest ~100 posts ever had their photos and videos archived.
 *
 * 2. References, not bytes. The client fetches media from X's public CDN itself,
 *    free and without a credential. Base64-ing every photo and video through this
 *    route is what made a whole-profile media response impossible to serve.
 *
 * `full=1` buys the whole reachable timeline. The fee is priced from the posts
 * actually read (lib/xGate `resourcesForPosts`), so a large profile pays for a
 * large read — a flat price would sell a 1,500-post archive for the price of a
 * 100-post one. Ask /api/x/quote first; it is free.
 */

function flag(value: string | null, defaultValue: boolean): boolean {
  return value === null ? defaultValue : value !== "0";
}

export async function GET(req: Request) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, reason: "server-token-unset" }, { status: 503 });
  }

  const url = new URL(req.url);
  const handle = url.searchParams.get("handle")?.trim().replace(/^@/, "") ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }
  const includeImages = flag(url.searchParams.get("images"), true);
  const includeVideos = flag(url.searchParams.get("videos"), true);
  const full = flag(url.searchParams.get("full"), false);

  // How big is this read? A full archive is priced from the profile's real post
  // count, so the gate demands a fee that covers what X will actually charge us.
  // The head costs ONE resource and is not gated — the same half-cent /api/x/quote
  // spends, and the price of knowing the price.
  let maxPages = 1;
  let billedPosts = 100;
  if (full) {
    const head = await fetchProfileHead(handle, token);
    if (!head) {
      return NextResponse.json({ ok: false, reason: "no-user" }, { status: 404 });
    }
    maxPages = pagesForPostCount(head.postCount);
    billedPosts = Math.min(head.postCount, X_TIMELINE_CEILING);
  }

  const gate = await payAndReserve(
    url.searchParams.get("payment"),
    resourcesForPosts(billedPosts),
  );
  if (!gate.ok) return gate.response;

  const result = await fetchXArchive(handle, token, maxPages);
  if (!result) {
    // The gate reserved budget and burned the payment for a read X then
    // failed to serve. The payment's fate is the client's to settle (the app
    // holds it; a truly burned fee answers "replayed" next run and is
    // released loudly there). The RESERVATION is ours, and keeping it would
    // shrink the day's budget by a read that never happened — hand it back,
    // the same settlement the gate's own replayed arm makes (lib/xGate).
    await releaseXApiSpend(resourcesForPosts(billedPosts));
    return NextResponse.json({ ok: false, reason: "no-user" }, { status: 404 });
  }

  const media = selectRefs(result.mediaRefs, includeImages, includeVideos);

  return Response.json({
    archive: result.archive,
    // References, not bytes: { postId, contentType, url }. The client downloads
    // them from X's public CDN — no credential, no cost, no ceiling.
    media,
    pagesRead: maxPages,
    postsRead: result.archive.posts.length,
  });
}
