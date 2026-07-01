import type { MediaRef, TweetsWithMedia } from "./xMedia";

const BASE = "https://api.twitter.com/2";

export type MediaItemDTO = {
  postId: string;
  contentType: string;
  base64: string;
};

/**
 * Fetches a user's recent tweets together with the media (photos and videos)
 * attached to them, using the X API's media expansions. Mirrors the tweets
 * request in `xfetch.ts`, but also asks for attachments so the archive route
 * can pull original-quality media without a second call per post.
 */
export async function fetchTweetsWithMedia(
  userId: string,
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<TweetsWithMedia> {
  const res = await fetchFn(
    `${BASE}/users/${userId}/tweets?max_results=20` +
      `&tweet.fields=created_at,in_reply_to_user_id,attachments` +
      `&expansions=attachments.media_keys` +
      `&media.fields=type,url,variants`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!res.ok) return {};
  return (await res.json()) as TweetsWithMedia;
}

export function selectRefs(
  refs: MediaRef[],
  includeImages: boolean,
  includeVideos: boolean
): MediaRef[] {
  return refs.filter((ref) =>
    ref.contentType.startsWith("image/")
      ? includeImages
      : ref.contentType.startsWith("video/")
        ? includeVideos
        : false
  );
}

export async function downloadItems(
  refs: MediaRef[],
  fetchFn: typeof fetch = fetch
): Promise<MediaItemDTO[]> {
  const items = await Promise.all(
    refs.map(async (ref): Promise<MediaItemDTO | undefined> => {
      try {
        const res = await fetchFn(ref.url);
        if (!res.ok) {
          console.warn(`Skipping media for post ${ref.postId}: download failed (${res.status})`);
          return undefined;
        }
        const contentType = res.headers.get("content-type") ?? ref.contentType;
        const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
        return { postId: ref.postId, contentType, base64 };
      } catch (err) {
        console.warn(`Skipping media for post ${ref.postId}: download threw`, err);
        return undefined;
      }
    })
  );
  return items.filter((item): item is MediaItemDTO => item !== undefined);
}
