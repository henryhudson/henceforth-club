import type { SocialArchive } from "@/app/folklore/onchain";
import { fetchAllUserTweets } from "./xPaginate";
import { extractMediaRefs, type MediaRef } from "./xMedia";
import { fullResXAvatar } from "@/app/folklore/xAvatar";

const BASE = "https://api.twitter.com/2";

/** X's own hard ceiling: the timeline endpoint will not read further back. */
export const X_TIMELINE_CEILING = 3200;

/** Posts per page from the timeline endpoint. */
export const POSTS_PER_PAGE = 100;

/**
 * Pure. Pages needed to read `postCount` posts, bounded by X's own ceiling —
 * asking for more pages than the ceiling allows buys nothing.
 */
export function pagesForPostCount(postCount: number): number {
  const reachable = Math.min(Math.max(0, postCount), X_TIMELINE_CEILING);
  return Math.max(1, Math.ceil(reachable / POSTS_PER_PAGE));
}

export type XProfileHead = {
  id: string;
  username: string;
  /** Posts X says the account has, before the timeline ceiling is applied. */
  postCount: number;
  profile: SocialArchive["profile"];
};

/**
 * The profile head, and with it the size of the read it implies. ONE resource
 * — the cheapest thing X sells — so a quote costs half a cent and a caller can
 * be told the honest price of a whole-profile archive before paying for one.
 *
 * `public_metrics` rides along free: X bills per RESOURCE returned, not per
 * field, so asking for the post count costs exactly what not asking costs.
 */
export async function fetchProfileHead(
  handle: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<XProfileHead | null> {
  const h = handle.replace(/^@/, "");
  const res = await fetchFn(
    `${BASE}/users/by/username/${encodeURIComponent(h)}` +
      `?user.fields=description,location,url,profile_image_url,created_at,public_metrics`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const u = (await res.json())?.data;
  if (!u?.id) return null;

  return {
    id: u.id,
    username: u.username,
    postCount: Number(u.public_metrics?.tweet_count ?? 0),
    profile: {
      displayName: u.name,
      bio: u.description,
      location: u.location,
      website: u.url,
      avatarUrl: fullResXAvatar(u.profile_image_url),
      accountId: u.id,
      createdAt: u.created_at,
    },
  };
}

/**
 * A profile's posts AND their media references — in ONE read.
 *
 * Three things this deliberately no longer does, all of which were expensive:
 *
 * 1. It does not read the timeline TWICE (2026-07-12). The media expansions ride
 *    the same request as the text, because X bills per RESOURCE returned, not
 *    per field — `expansions=attachments.media_keys` and `media.fields` are
 *    FREE. A separate media pass doubled the bill to fetch what this read could
 *    always have returned for nothing, and being capped at one page it could
 *    only ever see the newest hundred posts.
 *
 * 2. It does not download the media BYTES (2026-07-12). It returns REFERENCES —
 *    X's own public CDN URLs — and the client fetches the bytes itself, free and
 *    without a credential. Base64-ing every photo and video through this route
 *    is what made a whole-profile media archive impossible to serve at all.
 *
 * 3. It does not read the profile HEAD (2026-08-06). Every caller has already
 *    read it — the full-archive route to size the fee, the one-page routes right
 *    behind their gate — so it arrives as an argument. When this function read
 *    the head again internally, a full archive billed TWO user objects for one
 *    profile; taking the head as a parameter makes the double read
 *    unrepresentable.
 *
 * `maxPages` is the unit of cost and so is explicit: one page is 100 posts, and
 * the caller has paid a fee priced for exactly this many.
 */
export async function fetchXArchive(
  head: XProfileHead,
  token: string,
  maxPages: number = 1,
  fetchFn: typeof fetch = fetch,
): Promise<{ archive: SocialArchive; mediaRefs: MediaRef[] }> {
  const { data: tweets, media } = await fetchAllUserTweets<{
    id: string;
    created_at?: string;
    text: string;
    in_reply_to_user_id?: string;
    attachments?: { media_keys?: string[] };
  }>(
    head.id,
    token,
    "tweet.fields=created_at,in_reply_to_user_id,attachments" +
      "&expansions=attachments.media_keys" +
      "&media.fields=type,url,variants",
    fetchFn,
    maxPages,
  );

  return {
    archive: {
      v: 1,
      source: "x",
      handle: head.username,
      profile: head.profile,
      posts: tweets.map((t) => ({
        id: t.id,
        at: t.created_at ?? "",
        text: t.text,
        replyToId: t.in_reply_to_user_id,
      })),
    },
    mediaRefs: extractMediaRefs({ data: tweets, includes: { media } }),
  };
}
