import type { XMedia } from "./xMedia";

const BASE = "https://api.twitter.com/2";

/**
 * X serves at most ~3200 most-recent tweets — 32 pages of 100. A hard cap so a
 * runaway or repeating cursor can never loop forever.
 */
const MAX_PAGES = 32;

type TweetsPage<T> = {
  data?: T[];
  includes?: { media?: XMedia[] };
  meta?: { next_token?: string };
};

/**
 * Page through a user's whole tweets timeline, accumulating tweet data and any
 * media includes across pages up to the X API's ~3200-tweet ceiling. The timeline
 * endpoint returns at most 100 tweets per page plus a `meta.next_token` cursor;
 * this loops the cursor until it is absent, a page fails, or the page cap is hit.
 * The caller supplies the query params (tweet fields, expansions) and may inject a
 * fetch for testing. Pure of app state.
 */
export async function fetchAllUserTweets<T = unknown>(
  userId: string,
  token: string,
  params: string,
  fetchFn: typeof fetch = fetch,
): Promise<{ data: T[]; media: XMedia[] }> {
  const data: T[] = [];
  const media: XMedia[] = [];
  let paginationToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `${BASE}/users/${userId}/tweets?max_results=100&${params}` +
      (paginationToken ? `&pagination_token=${paginationToken}` : "");
    const res = await fetchFn(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) break;

    const body = (await res.json()) as TweetsPage<T>;
    if (Array.isArray(body.data)) data.push(...body.data);
    if (Array.isArray(body.includes?.media)) media.push(...body.includes.media);
    paginationToken = body.meta?.next_token;
    if (!paginationToken) break;
  }

  return { data, media };
}
