import type { SocialArchive } from "@/app/x/onchain";

const BASE = "https://api.twitter.com/2";

/**
 * Server-side X fetch: pulls a profile + recent posts by handle using the
 * server's bearer token, and maps to the canonical SocialArchive. The token
 * stays on the server (never shipped in the app), so every user can archive a
 * profile without configuring anything. Returns null if the handle has no user.
 */
export async function fetchXArchive(handle: string, token: string): Promise<SocialArchive | null> {
  const h = handle.replace(/^@/, "");

  const usersRes = await fetch(
    `${BASE}/users/by/username/${encodeURIComponent(h)}?user.fields=description,location,url,profile_image_url,created_at`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!usersRes.ok) return null;
  const u = (await usersRes.json())?.data;
  if (!u?.id) return null;

  const tweetsRes = await fetch(
    `${BASE}/users/${u.id}/tweets?max_results=20&tweet.fields=created_at,in_reply_to_user_id`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  const tweets = tweetsRes.ok ? await tweetsRes.json() : { data: [] };

  return {
    v: 1,
    source: "x",
    handle: u.username,
    profile: {
      displayName: u.name,
      bio: u.description,
      location: u.location,
      website: u.url,
      avatarUrl: u.profile_image_url,
      accountId: u.id,
      createdAt: u.created_at,
    },
    posts: (tweets.data ?? []).map(
      (t: { id: string; created_at?: string; text: string; in_reply_to_user_id?: string }) => ({
        id: t.id,
        at: t.created_at ?? "",
        text: t.text,
        replyToId: t.in_reply_to_user_id,
      }),
    ),
  };
}
