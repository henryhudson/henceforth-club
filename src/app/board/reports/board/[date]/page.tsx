import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBoard, loadReport } from "@/lib/board-data";
import { boardBookModel } from "@/lib/board-book";
import { isIsoDate } from "@/lib/board-sheet";
import BoardBook from "./_components/BoardBook";

export const dynamic = "force-dynamic";

export default async function BoardBookPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isIsoDate(date)) notFound();
  const board = await loadBoard();
  if (!board) notFound();
  // The day's report is optional: without it the ship ledgers fall back to
  // the four standing cards and no proposal is joined.
  const report = await loadReport(date);
  const model = boardBookModel(board, report, date);

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

      {/* The book itself on the newspaper measure: the front sheet, one A4
          page, then its four pages each on a page of their own. Print renders
          exactly this; the link strip above is web-only. */}
      <div className="bg-[#dedbd4] py-6 print:bg-white print:py-0">
        <BoardBook model={model} date={date} />
      </div>
    </main>
  );
}
