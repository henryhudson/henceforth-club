import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBoard, loadReport } from "@/lib/board-data";
import { boardSheetModel } from "@/lib/board-sheet";
import BoardSheet from "./_components/BoardSheet";

export const dynamic = "force-dynamic";

/** A real calendar date, not merely the shape of one: the done window counts
 *  days from it. */
function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

export default async function BoardSheetPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isIsoDate(date)) notFound();
  const board = await loadBoard();
  if (!board) notFound();
  // The day's report is optional: without it the ship ledgers fall back to
  // the four standing cards and no proposal is joined.
  const report = await loadReport(date);
  const model = boardSheetModel(board, report, date);

  return (
    <main>
      <div className="newspaper mx-auto max-w-4xl px-6 pt-6 print:hidden">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-foreground/60 pb-2 font-serif text-[12px]">
          <Link href="/board/reports" className="underline">Reports</Link>
          <Link href="/board" className="underline">Board</Link>
          <Link href="/board/week" className="underline">Week</Link>
          <Link href={`/board/reports/${date}`} className="underline">The day&apos;s edition</Link>
          <a href={`/board/reports/board/${date}/pdf`} className="underline">Inscribed PDF</a>
        </div>
      </div>

      {/* The sheet itself, one A4 page on the newspaper measure. Print renders
          exactly this sheet; the link strip above is web-only. */}
      <div className="bg-[#dedbd4] py-6 print:bg-white print:py-0">
        <BoardSheet model={model} />
      </div>
    </main>
  );
}
