import { NextResponse } from "next/server";
import { fetchProfileHead, X_TIMELINE_CEILING, POSTS_PER_PAGE } from "@/lib/xfetch";
import { resourcesForPosts } from "@/lib/xGate";
import { resourcesToUsd } from "@/lib/xSpend";
import { bsvUsd, satsForUsd } from "@/lib/xPrice";
import { archivedTweetIds } from "@/lib/xArchived";
import { archiveReadPlan } from "@/lib/xReadPlan";

/**
 * GET /api/x/quote?handle=<h>
 *
 * What a WHOLE-PROFILE archive read would cost, before anyone pays for one.
 *
 * A caller cannot know the price of a full read without knowing how many posts
 * there are, and it cannot know that without asking X. So this asks: one user
 * object — the cheapest thing X sells, half a cent — carrying `public_metrics`,
 * which rides along for free because X bills per resource RETURNED, not per
 * field.
 *
 * We eat that half-cent rather than gate it, because a quote a caller has to pay
 * for is not a quote. The per-address rate limiter is what stops it being abused.
 *
 * The price is derived, never pinned: dollars X will charge us for THIS read,
 * converted at the live rate, plus margin (lib/xPrice). Fails closed on an
 * unreadable rate — a guess about the price is a guess about whether we make
 * money.
 */
export async function GET(req: Request) {
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, reason: "server-token-unset" }, { status: 503 });
  }

  const handle = new URL(req.url).searchParams.get("handle")?.trim().replace(/^@/, "") ?? "";
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    return NextResponse.json({ ok: false, reason: "bad-handle" }, { status: 400 });
  }

  const price = await bsvUsd();
  if (!price.ok) {
    return NextResponse.json({ ok: false, reason: price.reason }, { status: 503 });
  }

  const head = await fetchProfileHead(handle, token);
  if (!head) {
    return NextResponse.json({ ok: false, reason: "no-user" }, { status: 404 });
  }

  // The SAME plan /api/x/archive will charge for (lib/xReadPlan): reachable
  // posts minus what is already on chain, since-bounded at the newest archived
  // id. Quote and gate deriving from one function is what stops the quoted
  // price and the demanded fee drifting apart. X will not read further back
  // than its own ceiling, so a bigger account is quoted for what is actually
  // reachable — never for posts we cannot fetch, and (2026-07-16) never again
  // for posts already bought and inscribed.
  const archived = await archivedTweetIds(handle);
  const plan = archiveReadPlan(head.postCount, archived?.tweetIds ?? new Set());
  const readablePosts = Math.min(head.postCount, X_TIMELINE_CEILING);
  const resources = resourcesForPosts(plan.billedPosts);
  const sats = satsForUsd(resourcesToUsd(resources), price.bsvUsd);

  return NextResponse.json({
    ok: true,
    handle: head.username,
    postCount: head.postCount,
    readablePosts,
    /** Posts already on chain for this handle — the part a full read no longer pays for. */
    archivedPosts: archived?.tweetIds.size ?? 0,
    /** Posts the priced read is expected to return: reachable minus archived. */
    newPostsEstimate: plan.billedPosts,
    pages: plan.maxPages,
    resources,
    /** The floor. Pay at least this to the archive reward address. */
    sats,
    usd: resourcesToUsd(resources),
    bsvUsd: price.bsvUsd,
    postsPerPage: POSTS_PER_PAGE,
  });
}
