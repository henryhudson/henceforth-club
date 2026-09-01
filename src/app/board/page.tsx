import { listWeeks, loadBoardResult, loadWeek } from "@/lib/board-data";
import { boardGeneratedAt, describeFreshness } from "@/lib/board-freshness";
import BoardClient, { type WeekSlice } from "./BoardClient";

export const dynamic = "force-dynamic";

function sliceFromBoard(board: { week?: { weekOf: string; generatedAt?: string; stateOfUnion?: string; weekPlan: WeekSlice["weekPlan"] } }): WeekSlice | null {
  const week = board.week;
  if (!week?.weekPlan?.length) return null;
  return {
    weekEnd: week.weekOf,
    generatedAt: week.generatedAt,
    stateOfUnion: week.stateOfUnion,
    weekPlan: week.weekPlan,
  };
}

async function loadWeekSliceFallback(): Promise<WeekSlice | null> {
  const weeks = await listWeeks();
  const active = weeks[0];
  if (!active) return null;
  const w = await loadWeek(active);
  if (!w?.retro?.weekPlan?.length) return null;
  return {
    weekEnd: w.weekEnd,
    generatedAt: (w as { generatedAt?: string }).generatedAt,
    stateOfUnion: w.retro.stateOfUnion,
    weekPlan: w.retro.weekPlan,
  };
}

export default async function BoardPage() {
  const result = await loadBoardResult();
  if (result.status !== "ok") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        {result.status === "unavailable" ? (
          <>
            The board is published from a key-value store, and that store is not answering. The
            board itself is fine — this page will fill in again as soon as the store does.
          </>
        ) : (
          <>
            No board data yet — run <code className="text-accent-green">/hh</code> to populate it.
          </>
        )}
      </main>
    );
  }
  const board = result.board;
  const week = sliceFromBoard(board) ?? (await loadWeekSliceFallback());
  // Derived on the server: a client component computing this from its own
  // clock would hydrate mismatched, and the age must be the server's view.
  const freshness = describeFreshness(boardGeneratedAt(board), new Date());
  return (
    <BoardClient
      generated={board.generated}
      freshness={freshness}
      initialCards={board.cards}
      week={week}
    />
  );
}
