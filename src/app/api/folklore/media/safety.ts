/**
 * What the media route may store and serve, and how much of it. Kept beside
 * `range.ts` for the same reason: the safety rules are testable without a
 * server.
 *
 * The route copies gateway bytes into the site's own stores (Vercel Blob, or
 * a function instance's /tmp) and serves them from the site's own origin, so
 * the gateway's answer cannot be trusted on either axis:
 *
 *  - content-type: an inscription can carry ANY type. text/html — or
 *    image/svg+xml, which scripts — served from this origin would be stored
 *    cross-site scripting. Only enumerated image and video types pass;
 *    anything else is served as an opaque octet-stream download.
 *  - size: the route reads a body whole before storing it, and the blob
 *    store is paid and permanent, so an oversized inscription is refused
 *    before its bytes land anywhere.
 */

/** The types the archives actually produce (the app inscribes photo
 * originals as jpeg/png/webp/gif and videos as mp4), plus the modern
 * equivalents a future archive could plausibly carry. image/svg+xml is
 * excluded on purpose — it scripts. */
const SAFE_MEDIA_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export const FALLBACK_MEDIA_TYPE = "application/octet-stream";

/** Pure. The type the route will store and serve for what the gateway
 * claimed: the claim itself when it is an enumerated safe media type, an
 * opaque download otherwise. Parameters are dropped — `video/mp4;
 * codecs=avc1` clamps on the bare type. */
export function safeMediaType(claimed: string | null | undefined): string {
  const bare = (claimed ?? "").split(";")[0].trim().toLowerCase();
  return SAFE_MEDIA_TYPES.has(bare) ? bare : FALLBACK_MEDIA_TYPE;
}

/** Hard ceiling on what one inscription may put into the caches. The largest
 * media inscription measured so far is a 15-megabyte video; 64 mebibytes
 * leaves generous room above that while keeping anyone from filling the paid
 * blob store — or the function's memory — with arbitrary giants. */
export const MAX_MEDIA_BYTES = 64 * 1024 * 1024;

/** Read a response body whole, refusing the moment it exceeds `cap` — the
 * download is abandoned right there, so an oversized body never fully
 * occupies memory, let alone a store. A Content-Length already past the cap
 * refuses without reading the body at all. */
export async function readCapped(
  upstream: Response,
  cap: number,
): Promise<Buffer | "too-large"> {
  const declared = Number(upstream.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > cap) {
    await upstream.body?.cancel();
    return "too-large";
  }
  if (!upstream.body) {
    const bytes = Buffer.from(await upstream.arrayBuffer());
    return bytes.length > cap ? "too-large" : bytes;
  }
  const reader = upstream.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      return "too-large";
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
