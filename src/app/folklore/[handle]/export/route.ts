import { getArchivePage } from "@/lib/xArchiveCache";

/**
 * GET /folklore/<handle>/export — the whole archive as one JSON download.
 *
 * Folklore's own promise, kept mechanically: the reader's data is theirs to
 * walk away with. Everything here is already public on the chain; this
 * endpoint just packages it — profile, every post with its inscription
 * transaction id, and the transaction times — with an `about` block telling
 * the reader how to verify every byte without us.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const page = await getArchivePage(handle, 0, 1_000_000);
  if (!page) {
    return Response.json({ error: `@${handle} is not archived` }, { status: 404 });
  }

  const body = {
    about: {
      what: `The on-chain archive of @${page.profile.handle}, exported from henceforth.club/folklore`,
      verify:
        "Every post lives in the Bitcoin transaction named by its txid. Read any of them on a block explorer (for example bananablocks.com/tx/<txid>) — this file, and this site, are conveniences, not custodians.",
      exportedAt: new Date().toISOString(),
    },
    profile: page.profile,
    postCount: page.postCount,
    txCount: page.txCount,
    txTimes: page.txTimes,
    posts: page.posts,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="folklore-${page.profile.handle}.json"`,
    },
  });
}
