import { head, put } from "@vercel/blob";
import { createReadStream } from "node:fs";
import { open, rename, stat, writeFile, readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { parseRange } from "../range";

/**
 * Range-honouring reader over an inscription's bytes.
 *
 * Both public gateways answer every Range request with a bare 200 and the
 * whole body, and Safari refuses to play <video> against a server that does
 * that. Re-fetching the whole file from the gateway per range request was
 * measured at 30 seconds per 64-kilobyte chunk on a 15-megabyte video —
 * correct and unwatchable — so the bytes are cached:
 *
 *   1. Vercel Blob, when the store is connected (BLOB_READ_WRITE_TOKEN
 *      present): first touch copies the inscription into the blob once,
 *      then players are redirected to the blob's own range-capable
 *      delivery. Permanent; the chain stays the source of truth and the
 *      blob is a rebuildable cache.
 *   2. The function instance's /tmp disk otherwise: one slow populate per
 *      instance, then every range is a local file read. Ephemeral but
 *      real relief until the store is connected.
 *
 * Inscriptions are immutable, so every cache header here is immutable.
 */
const ORIGIN_SHAPE = /^[0-9a-f]{64}_\d+$/;
const GATEWAY = "https://ordfs.network/";
const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

export async function GET(request: Request, { params }: { params: Promise<{ origin: string }> }) {
  const { origin } = await params;
  if (!ORIGIN_SHAPE.test(origin)) return new Response("not found", { status: 404 });

  // Two store shapes: the classic static token, or the newer integration
  // that installs BLOB_STORE_ID and lets the SDK authenticate at runtime.
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token !== undefined || process.env.BLOB_STORE_ID !== undefined) {
    try {
      return await viaBlob(origin, token);
    } catch {
      /* misconfigured or transient store — the disk path still serves */
    }
  }
  return viaTmp(request, origin);
}

/** Redirect to the blob copy, populating it from the gateway on first touch. */
async function viaBlob(origin: string, token: string | undefined): Promise<Response> {
  const pathname = `media/${origin}`;
  const auth = token === undefined ? undefined : { token };
  try {
    const existing = await head(pathname, auth);
    return redirect(existing.url);
  } catch {
    /* not stored yet */
  }
  const upstream = await fetch(GATEWAY + origin);
  if (!upstream.ok) return new Response("unavailable", { status: 502 });
  const bytes = await upstream.arrayBuffer();
  const stored = await put(pathname, bytes, {
    access: "public",
    addRandomSuffix: false,
    contentType: upstream.headers.get("content-type") ?? "application/octet-stream",
    ...auth,
  });
  return redirect(stored.url);
}

function redirect(url: string): Response {
  // The redirect itself is immutable, so a player's follow-up range
  // requests go straight to the blob without touching this route again.
  return new Response(null, {
    status: 307,
    headers: { location: url, "cache-control": IMMUTABLE },
  });
}

/** Serve ranges from a per-instance disk copy, populating it on first touch. */
async function viaTmp(request: Request, origin: string): Promise<Response> {
  const file = `/tmp/folklore-media-${origin}`;
  const metaFile = `${file}.meta.json`;

  let meta: { type: string; size: number };
  try {
    meta = JSON.parse(await readFile(metaFile, "utf8")) as { type: string; size: number };
    await stat(file);
  } catch {
    const upstream = await fetch(GATEWAY + origin);
    if (!upstream.ok) return new Response("unavailable", { status: 502 });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    meta = { type: upstream.headers.get("content-type") ?? "application/octet-stream", size: bytes.length };
    // Partial-write safety under concurrent first touches: land whole, then rename.
    const scratch = `${file}.partial-${process.pid}-${Math.floor(performance.now() * 1000)}`;
    await writeFile(scratch, bytes);
    await rename(scratch, file);
    await writeFile(metaFile, JSON.stringify(meta));
  }

  const shared = { "content-type": meta.type, "accept-ranges": "bytes", "cache-control": IMMUTABLE };
  const range = parseRange(request.headers.get("range"), meta.size);
  if (range === "invalid") {
    return new Response(null, {
      status: 416,
      headers: { ...shared, "content-range": `bytes */${meta.size}` },
    });
  }
  if (range === null) {
    const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
    return new Response(body, {
      status: 200,
      headers: { ...shared, "content-length": String(meta.size) },
    });
  }
  const handle = await open(file, "r");
  try {
    const length = range.end - range.start + 1;
    const slice = Buffer.alloc(length);
    await handle.read(slice, 0, length, range.start);
    return new Response(new Uint8Array(slice), {
      status: 206,
      headers: {
        ...shared,
        "content-length": String(length),
        "content-range": `bytes ${range.start}-${range.end}/${meta.size}`,
      },
    });
  } finally {
    await handle.close();
  }
}
