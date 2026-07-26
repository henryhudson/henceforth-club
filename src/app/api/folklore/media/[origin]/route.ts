import { parseRange } from "../range";

/**
 * Range-honouring reader over an inscription's bytes.
 *
 * Both public gateways answer every Range request with a bare 200 and the
 * whole body, and Safari refuses to play <video> against a server that does
 * that — so the archive's costliest artifacts rendered as dark, dead players.
 * Inscriptions are immutable, which makes this route trivially cacheable
 * forever and the origin check the only thing worth being strict about.
 */
const ORIGIN_SHAPE = /^[0-9a-f]{64}_\d+$/;
const GATEWAY = "https://ordfs.network/";
const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

export async function GET(request: Request, { params }: { params: Promise<{ origin: string }> }) {
  const { origin } = await params;
  if (!ORIGIN_SHAPE.test(origin)) return new Response("not found", { status: 404 });

  const upstream = await fetch(GATEWAY + origin);
  if (!upstream.ok || upstream.body === null) return new Response("unavailable", { status: 502 });
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  const declaredSize = Number(upstream.headers.get("content-length") ?? NaN);

  const shared = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": IMMUTABLE,
  };

  const rangeHeader = request.headers.get("range");
  if (rangeHeader === null) {
    return new Response(upstream.body, {
      status: 200,
      headers: Number.isFinite(declaredSize)
        ? { ...shared, "content-length": String(declaredSize) }
        : shared,
    });
  }

  // The gateway never sends 206s, so the size for range arithmetic must come
  // from its content-length — absent that, the bytes must be counted.
  if (!Number.isFinite(declaredSize)) {
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    return respondFromBytes(bytes, rangeHeader, shared);
  }

  const range = parseRange(rangeHeader, declaredSize);
  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { ...shared, "content-range": `bytes */${declaredSize}` },
    });
  }
  // A full-file range (Chrome opens with `bytes=0-`) streams straight through
  // rather than buffering a multi-megabyte video in the function.
  if (range === null || (range.start === 0 && range.end === declaredSize - 1)) {
    return new Response(upstream.body, {
      status: range === null ? 200 : 206,
      headers: {
        ...shared,
        "content-length": String(declaredSize),
        ...(range === null
          ? {}
          : { "content-range": `bytes 0-${declaredSize - 1}/${declaredSize}` }),
      },
    });
  }
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  return respondFromBytes(bytes, rangeHeader, shared);
}

function respondFromBytes(
  bytes: Uint8Array,
  rangeHeader: string,
  shared: Record<string, string>,
): Response {
  const range = parseRange(rangeHeader, bytes.length);
  if (range === "invalid" || range === null) {
    return new Response(null, {
      status: 416,
      headers: { ...shared, "content-range": `bytes */${bytes.length}` },
    });
  }
  // .slice, not .subarray: the copy lands in a fresh ArrayBuffer, which is
  // what Response's BodyInit accepts (a shared-buffer view is refused).
  const slice = bytes.slice(range.start, range.end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      ...shared,
      "content-length": String(slice.length),
      "content-range": `bytes ${range.start}-${range.end}/${bytes.length}`,
    },
  });
}
