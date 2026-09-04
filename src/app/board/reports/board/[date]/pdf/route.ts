import { servePdf } from "@/lib/board-pdf-serve";

export const dynamic = "force-dynamic";

// The board sheet is inscribed only when asked (render-pdf.mjs board <date>
// --inscribe); until then this answers the same not-rendered 404 as its
// siblings do for an edition that has not gone on the chain.
export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return servePdf("board", date);
}
