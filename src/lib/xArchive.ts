import type { MediaRef } from "./xMedia";

export type MediaItemDTO = {
  postId: string;
  contentType: string;
  base64: string;
};

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
      const res = await fetchFn(ref.url);
      if (!res.ok) {
        console.warn(`Skipping media for post ${ref.postId}: download failed (${res.status})`);
        return undefined;
      }
      const contentType = res.headers.get("content-type") ?? ref.contentType;
      const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      return { postId: ref.postId, contentType, base64 };
    })
  );
  return items.filter((item): item is MediaItemDTO => item !== undefined);
}
