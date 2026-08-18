import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/board-auth";
import { getRedis } from "@/lib/redis";

export const runtime = "nodejs";

// The middleware already gates /board/:path*, but tax filings also verify the
// session in-handler (same as the planner tick): a future matcher change must
// never be able to expose them. Responses are private and uncacheable so no
// shared cache can hold a copy past the sign-in.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ year: string; slug: string }> },
) {
  const secret = process.env.BOARD_COOKIE_SECRET ?? "";
  const token = (await cookies()).get("board_session")?.value;
  if (!secret || !(await verifySession(token, secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const redis = getRedis();
  if (!redis) return NextResponse.json({ error: "no store" }, { status: 503 });

  const { year, slug } = await params;

  // The index decides what is published; the document key only holds bytes.
  // The publisher never deletes, so a filing removed from the source folder
  // drops out of the index while its key lives on — served from the key alone,
  // a withdrawn document stayed retrievable at its URL forever. An absent
  // index fails closed for the same reason: "is this published?" going
  // unanswered must not serve a private filing.
  const index = await redis.get<{
    periods?: { year: string; files?: { slug: string }[] }[];
  }>("board:taxes:index");
  const published = (index?.periods ?? []).some(
    (p) => p.year === year && (p.files ?? []).some((f) => f.slug === slug),
  );
  if (!published) return NextResponse.json({ error: "not found" }, { status: 404 });

  const file = await redis.get<{ name: string; b64: string; type?: string }>(
    `board:taxes:file:${year}:${slug}`,
  );
  if (!file?.b64) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Both periods hold a file named …CT6002024.pdf and they are different
  // documents — saving both links wrote one over the other. The period
  // qualifies the download; the stored name is left untouched.
  const filename = `${year}-${file.name.replace(/"/g, "")}`;

  // The store carries PDFs and, since the filings tree took over as the
  // source, HTML working papers (the filing pack). Absent type means a
  // document published before the field existed — always a PDF.
  const contentType = file.type === "html" ? "text/html; charset=utf-8" : "application/pdf";

  return new NextResponse(new Uint8Array(Buffer.from(file.b64, "base64")), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
