import type { XArchive, XPost } from "./parseArchive";
import data from "./real-data.json";

// Henry's real profile + 20 most-recent posts, fetched live from the X API
// (with replied-to parent tweets and any media, via expansions).
export const realArchive: XArchive = {
  profile: {
    handle: data.handle,
    displayName: data.profile.displayName,
    bio: data.profile.bio,
    location: data.profile.location?.trim(),
    website: data.profile.website,
    avatarUrl: data.profile.avatarUrl,
    createdAt: data.profile.createdAt,
  },
  posts: (data.posts as Array<Record<string, unknown>>).map(
    (p): XPost => ({
      id: p.id as string,
      at: p.at as string,
      text: p.text as string,
      media: (p.media as XPost["media"]) ?? [],
      parent: p.parent as { author: string; text: string } | undefined,
    }),
  ),
};
