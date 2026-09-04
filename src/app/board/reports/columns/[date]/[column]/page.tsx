import Link from "next/link";
import { notFound } from "next/navigation";
import { loadBoard } from "@/lib/board-data";
import { COLUMNS, COLUMN_LABELS, columnPageModel, isColumnId } from "@/lib/board-columns";
import { isIsoDate } from "@/lib/board-sheet";
import ColumnSheet from "./_components/ColumnSheet";

export const dynamic = "force-dynamic";

/** One column of the kanban, every card in it, newest first: the full list
 *  behind each square of the day's Board sheet. The done pile shows its last
 *  thirty days unless `?all=1` asks for the whole of it. */
export default async function ColumnPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string; column: string }>;
  searchParams: Promise<{ all?: string | string[] }>;
}) {
  const [{ date, column }, { all }] = await Promise.all([params, searchParams]);
  // The name is checked before the board is read: a bad one costs no store read.
  if (!isIsoDate(date) || !isColumnId(column)) notFound();
  const board = await loadBoard();
  if (!board) notFound();
  const model = columnPageModel(board, column, date, { all: all === "1" });
  if (!model) notFound();

  return (
    <main>
      <div className="newspaper mx-auto max-w-4xl px-6 pt-6 print:hidden">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-foreground/60 pb-2 font-serif text-[12px]">
          <Link href="/board/reports" className="underline">Reports</Link>
          <Link href="/board" className="underline">Board</Link>
          <Link href={`/board/reports/board/${date}`} className="underline">The Board sheet</Link>
          <Link href={`/board/reports/${date}`} className="underline">The day&apos;s edition</Link>
          <span className="ml-auto flex flex-wrap gap-x-3">
            {COLUMNS.map((c) =>
              c === model.column ? (
                <b key={c}>{COLUMN_LABELS[c]}</b>
              ) : (
                <Link key={c} href={`/board/reports/columns/${date}/${c}`} className="underline">
                  {COLUMN_LABELS[c]}
                </Link>
              ),
            )}
          </span>
        </div>
      </div>

      {/* The list itself, on the newspaper measure, over as many pages as the
          column takes. Print renders exactly this; the strip above is web-only. */}
      <div className="bg-[#dedbd4] py-6 print:bg-white print:py-0">
        <ColumnSheet model={model} />
      </div>
    </main>
  );
}
