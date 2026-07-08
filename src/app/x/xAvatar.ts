// X serves profile images as a 48-pixel "_normal" thumbnail by default, which
// renders pixelated when shown larger. The un-suffixed path (and, for the newer
// query-sized URLs, ?name=orig) serves the full-resolution original. Upgrade the
// URL wherever an avatar is stored or rendered. Pure and client-safe — idempotent,
// so applying it twice (at fetch and at render) is harmless.
export function fullResXAvatar(url?: string): string | undefined {
  if (!url) return url;
  return url
    // Path-suffix variant: .../avatar_normal.jpg -> .../avatar.jpg
    .replace(/_(?:normal|bigger|mini|\d+x\d+)(\.\w+)(\?|$)/, "$1$2")
    // Query-sized variant: ...?name=small -> ...?name=orig
    .replace(/([?&]name=)(?:normal|small|medium|large|\d+x\d+)\b/, "$1orig");
}
