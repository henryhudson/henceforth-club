import { servePdf } from "@/lib/board-pdf-serve";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return servePdf("week", date);
}
