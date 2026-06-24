export interface BacklogItem {
  title: string;
  scope?: string;
}

/**
 * Current "what's next" list, served at /api/backlog and printed by the
 * Henceforth `todo` word. Hand-curated and server-driven: edit here and the
 * app reflects it on next fetch, no rebuild. (The full dev backlog with specs
 * lives in FORTHapp/docs/superpowers/backlog.html.)
 */
export const backlog: BacklogItem[] = [
  { title: "Run `xtext` live → first real on-chain TXID", scope: "phone" },
  { title: "Archive media: download the bytes, not CDN URLs (X can delete them)", scope: "the gap" },
  { title: "BCAT path for video/media >100KB + BCAT-aware web reader", scope: "sprint" },
  { title: "Likes archive via the free X export like.js (full history)", scope: "free ZIP" },
  { title: "PayView toggles: All Likes / Video / Media, cost per toggle", scope: "after BCAT" },
  { title: "Rotate the leaked X bearer token", scope: "before it guards the float" },
  { title: "Commit the iOS xtext files (clean pbxproj first)", scope: "~30 min" },
  { title: "Mac mini runner: harden before release secrets land", scope: "SECURITY · gates release" },
  { title: "PUSHDATA2/4 explicit-width recording tests", scope: "~20 min" },
  { title: "Marketing numberpad slide — pick placement", scope: "decision" },
];
