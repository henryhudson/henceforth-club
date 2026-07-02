import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { blobPathname, downloadFilename, type EditionKind } from "./board-pdf";

const notRendered = () =>
  NextResponse.json({ error: "Not rendered yet — the next /hh run creates it." }, { status: 404 });

/** Streams a stored edition PDF from Vercel Blob, or a friendly 404 when the
 *  blob (or the Blob token itself, in local dev) is absent. Read-only. */
export async function servePdf(kind: EditionKind, date: string): Promise<Response> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notRendered();
  try {
    const pathname = blobPathname(kind, date);
    const { blobs } = await list({ prefix: pathname, limit: 1 });
    const hit = blobs.find((b) => b.pathname === pathname);
    if (!hit) return notRendered();
    const upstream = await fetch(hit.url);
    if (!upstream.ok || !upstream.body) return notRendered();
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${downloadFilename(kind, date)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return notRendered();
  }
}
