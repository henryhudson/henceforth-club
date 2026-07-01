export type XMediaVariant = {
  bit_rate?: number;
  content_type: string;
  url: string;
};

export type XMedia = {
  media_key: string;
  type: string;
  url?: string;
  variants?: XMediaVariant[];
};

export type Tweet = {
  id: string;
  attachments?: { media_keys?: string[] };
};

export type TweetsWithMedia = {
  data?: Tweet[];
  includes?: { media?: XMedia[] };
};

export type MediaRef = {
  postId: string;
  contentType: string;
  url: string;
};

export function bestVideoVariant(variants: XMediaVariant[]): string | undefined {
  const mp4Variants = variants.filter((v) => v.content_type === "video/mp4");
  if (mp4Variants.length === 0) return undefined;
  return mp4Variants.reduce((best, v) =>
    (v.bit_rate ?? 0) > (best.bit_rate ?? 0) ? v : best
  ).url;
}

export function imageContentType(url: string): string {
  const extension = url.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "image/jpeg";
  }
}

export function extractMediaRefs(tweets: TweetsWithMedia): MediaRef[] {
  const mediaByKey = new Map<string, XMedia>();
  for (const media of tweets.includes?.media ?? []) {
    mediaByKey.set(media.media_key, media);
  }

  const refs: MediaRef[] = [];
  for (const tweet of tweets.data ?? []) {
    for (const key of tweet.attachments?.media_keys ?? []) {
      const media = mediaByKey.get(key);
      if (!media) continue;

      if (media.type === "photo" && media.url) {
        refs.push({ postId: tweet.id, contentType: imageContentType(media.url), url: media.url });
        continue;
      }

      if (media.type === "video" || media.type === "animated_gif") {
        const url = bestVideoVariant(media.variants ?? []);
        if (url) refs.push({ postId: tweet.id, contentType: "video/mp4", url });
      }
    }
  }
  return refs;
}
