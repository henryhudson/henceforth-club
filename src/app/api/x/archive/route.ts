import { NextResponse } from "next/server";
import {
  fetchXArchive,
  fetchProfileHead,
  pagesForPostCount,
  X_TIMELINE_CEILING,
  type XProfileHead,
} from "@/lib/xfetch";
import { selectRefs } from "@/lib/xArchive";
import { payAndReserve, resourcesForPosts } from "@/lib/xGate";
import { releaseXApiSpend } from "@/lib/xSpend";
import { releaseHeadRead, reserveHeadRead } from "@/lib/xHeadSpend";
import { isTxid } from "@/lib/xPayment";

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
  //
  // This head read happens BEFORE any payment is checked, and it is billed. It
  // used to be justified by pointing at /api/x/quote ("the same half-cent
  // /api/x/quote spends") — which pointed back here, so neither was bounded by
  // anything. It is now booked against the unpaid head ceiling
  // (lib/xHeadSpend), a bucket separate from the paid one so that anonymous
  // sizing requests cannot exhaust the budget paying callers depend on.
  //
  // This is the ONLY head read a full archive makes (2026-08-06). It used to be
  // one of two: `fetchXArchive` read the head AGAIN internally, so a full
  // archive genuinely billed two user objects for one profile. The head is now
  // handed to `fetchXArchive` as an argument, which cannot re-read it. The +1
  // inside `resourcesForPosts` still stands — it is the fee's floor and it
  // covers the one-page path's single head read below — so on THIS path the
  // paid bucket over-reserves by one resource: half a cent of conservatism,
  // erring closed. The FEE is untouched — `payAndReserve` derives that from its
  // own argument, which is unchanged.
  let maxPages = 1;
  let billedPosts = 100;
  let head: XProfileHead | null = null;
  if (full) {
    // A well-formed payment id is demanded BEFORE the billed read, not after.
    // This costs nothing (`isTxid` is a regex) and it is the difference between
    // a tap anyone can open from a browser bar and one that at least requires a
    // 64-hex transaction id. It duplicates the gate's own first act
    // deliberately: the gate cannot run yet, because it needs a fee sized from
    // the post count this read exists to discover.
    if (!isTxid(url.searchParams.get("payment"))) {
      return NextResponse.json({ ok: false, reason: "payment-required" }, { status: 402 });
    }

    // One moment for the reserve/release pair, so they cannot land in different
    // UTC buckets across a midnight boundary.
    const now = new Date();
    const reserved = await reserveHeadRead(now);
    if (!reserved.ok) {
      return NextResponse.json(
        { ok: false, reason: reserved.reason },
        { status: reserved.reason === "budget-exhausted" ? 429 : 503 },
      );
    }

    try {
      head = await fetchProfileHead(handle, token);
    } catch (error) {
      // `fetchProfileHead` returns null for a non-ok STATUS but THROWS on a
      // network rejection or a 200 carrying non-JSON. Both billed nothing — the
      // read never completed — so the reservation must come back here too.
      // Without this a flaky network ratchets the day's ceiling shut one
      // half-cent at a time, and nothing ever hands those mils back.
      await releaseHeadRead(now);
      throw error;
    }
    if (!head) {
      // Billed per resource RETURNED, and none came back. Holding the
      // reservation here would turn a money leak into a free way to pin the
      // day's ceiling, because the handle pattern admits any short string.
      await releaseHeadRead(now);
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

  if (!head) {
    // The one-page path sizes nothing in advance, so its single head read lands
    // here — behind the gate, covered by the +1 user object inside
    // `resourcesForPosts`. Still exactly one head read per archive.
    head = await fetchProfileHead(handle, token);
    if (!head) {
      // The gate reserved budget and burned the payment for a read X then
      // failed to serve. The payment's fate is the client's to settle (the app
      // holds it; a truly burned fee answers "replayed" next run and is
      // released loudly there). The RESERVATION is ours, and keeping it would
      // shrink the day's budget by a read that never happened — hand it back,
      // the same settlement the gate's own replayed arm makes (lib/xGate).
      await releaseXApiSpend(resourcesForPosts(billedPosts));
      return NextResponse.json({ ok: false, reason: "no-user" }, { status: 404 });
    }
  }

  const result = await fetchXArchive(head, token, maxPages);
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
