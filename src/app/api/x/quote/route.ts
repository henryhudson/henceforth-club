import { NextResponse } from "next/server";
import { fetchProfileHead, X_TIMELINE_CEILING, POSTS_PER_PAGE } from "@/lib/xfetch";
import { resourcesForPosts } from "@/lib/xGate";
import { resourcesToUsd } from "@/lib/xSpend";
import { releaseHeadRead, reserveHeadRead } from "@/lib/xHeadSpend";
import { bsvUsd, satsForUsd } from "@/lib/xPrice";
import { resolveReadBound } from "@/lib/xWatermark";
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
 * We eat that half-cent rather than charge for it, because a quote a caller has
 * to pay for is not a quote. What we do NOT do is spend it uncounted: the read
 * is booked against the unpaid head ceiling (lib/xHeadSpend) before it happens,
 * and handed back when X returns nothing.
 *
 * That ceiling is deliberately its OWN bucket, not the paid one. Booking these
 * against the customers' budget would bound the bill and break the product —
 * four hundred anonymous quotes would exhaust the day and every paying archive
 * would then be refused. This comment previously named a per-address rate
 * limiter as the control; no limiter was ever applied to this route, and the
 * archive route justified its identical read by pointing back here.
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

  let head;
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
    // X bills per resource RETURNED and returned none, so this read cost
    // nothing. Keeping the reservation would let nonsense handles pin the day's
    // ceiling for free.
    await releaseHeadRead(now);
    return NextResponse.json({ ok: false, reason: "no-user" }, { status: 404 });
  }

  // The SAME plan /api/x/archive will charge for (lib/xReadPlan over
  // lib/xWatermark's bound): quote and gate deriving from one function is what
  // stops the quoted price and the demanded fee drifting apart. X will not
  // read further back than its own ceiling, so a bigger account is quoted for
  // what is actually reachable — never for posts we cannot fetch.
  const bound = await resolveReadBound(handle);
  const plan = archiveReadPlan(head.postCount, bound.sinceId);
  const readablePosts = Math.min(head.postCount, X_TIMELINE_CEILING);
  const resources = resourcesForPosts(plan.billedPosts);
  const sats = satsForUsd(resourcesToUsd(resources), price.bsvUsd);

  return NextResponse.json({
    ok: true,
    handle: head.username,
    postCount: head.postCount,
    readablePosts,
    pages: plan.maxPages,
    resources,
    /** True when a full read would be since-bounded: the fee still covers the
     * worst case the page budget permits, but X only bills what the delta
     * actually returns. */
    sinceBounded: plan.sinceId !== undefined,
    /** The floor. Pay at least this to the archive reward address. */
    sats,
    usd: resourcesToUsd(resources),
    bsvUsd: price.bsvUsd,
    postsPerPage: POSTS_PER_PAGE,
  });
}
