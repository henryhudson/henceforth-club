import { promises as fs } from "fs";
import path from "path";
import BoardClient, { type Card } from "./BoardClient";

type Board = { generated: string; cards: Card[] };

async function loadBoard(): Promise<Board | null> {
  try {
    const file = path.join(process.cwd(), "content/board/latest.json");
    return JSON.parse(await fs.readFile(file, "utf8")) as Board;
  } catch {
    return null;
  }
}

export default async function BoardPage() {
  const board = await loadBoard();
  if (!board) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        No board data yet — run <code className="text-accent-green">/hh</code> to populate it.
      </main>
    );
  }
  return <BoardClient generated={board.generated} initialCards={board.cards} />;
}
