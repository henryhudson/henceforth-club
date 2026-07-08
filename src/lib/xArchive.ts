import type { MediaRef, Tweet, TweetsWithMedia } from "./xMedia";
import { fetchAllUserTweets } from "./xPaginate";

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
  // One page of posts, media included, unless a caller asks for more. This used
  // to page to the ~3200-post ceiling — a second full timeline read on top of the
  // one fetchXArchive already made, so a single /api/x/archive call could cost $32.
  const { data, media } = await fetchAllUserTweets<Tweet>(
    userId,
    token,
    "tweet.fields=created_at,in_reply_to_user_id,attachments" +
      "&expansions=attachments.media_keys" +
      "&media.fields=type,url,variants",
    fetchFn
  );
  return { data, includes: { media } };
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
