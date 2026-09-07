import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { boardBookModel, type BookBoard } from "@/lib/board-book";
import BoardBook from "./BoardBook";

const DATE = "2026-09-07";

const board: BookBoard = {
  generated: "2026-09-07 09:55 · Monday",
  cards: [
    { id: "t1", col: "todo", apps: ["hansard"], title: "Two Dependabot alerts on the screenshot tool", phase: "PULL this week", movedAt: "2026-09-07T09:20:00+01:00", desc: "2026-09-07 · Tooling, not the app. More." },
    { id: "r1", col: "review", title: "File the confirmation statement", phase: "YOU: did the identity check happen?" },
  ],
  month: {
    title: "September 2026",
    note: "Drafted on 7 September. Edit freely.",
    items: [
      { when: "2026-09-02", label: "Ship day: Henceforth 4.54 shipped.", done: true },
      { when: "2026-09-09", label: "Ship day: Hansard 1.11 and Henceforth 4.55." },
    ],
  },
  year: { title: "The year from September 2026", items: [{ when: "2026-10", label: "The folklore door opens." }] },
};

const html = (b: BookBoard) => renderToStaticMarkup(<BoardBook model={boardBookModel(b, null, DATE)} date={DATE} />);

describe("The Board as a book", () => {
  const page = html(board);

  it("sets the front, then four pages in order, each titled and anchored", () => {
    expect([...page.matchAll(/<section id="([a-z]+)"/g)].map((m) => m[1])).toEqual([
      "todo",
      "inprogress",
      "month",
      "year",
    ]);
    for (const title of ["To do", "In progress", "The month", "The year"]) expect(page).toContain(`<h1 class="${page.match(/<h1 class="([^"]+)"/)?.[1]}">${title}</h1>`);
    expect(page.indexOf("The working set of the four")).toBeLessThan(page.indexOf("<section"));
  });

  it("gives the book's pages their margins and a running foot counting the pages, and the front its own first page", () => {
    expect(page).toContain("margin: 12mm 12mm 14mm;");
    expect(page).toContain('content: "The Board · Monday 7th of September 2026 · page " counter(page) " of " counter(pages);');
    expect(page).toContain("@page :first {");
    expect(page.indexOf("a4-print-root")).toBeLessThan(page.indexOf("@page :first"));
  });

  it("sets the cards to do with the column page's renderer, and says nothing is in hand", () => {
    expect(page).toContain("Two Dependabot alerts on the screenshot tool");
    expect(page).toContain("The Hansard · moved 7 September 2026");
    expect(page).toContain("Tooling, not the app.");
    expect(page).toContain("1 card · newest first");
    expect(page).toContain("Nothing in hand.");
    expect(page).toContain("0 cards · newest first");
  });

  it("prints the month by week with a box a line, the done line ticked, and the year by month", () => {
    expect(page).toContain("September 2026");
    expect(page).toContain("Drafted on 7 September. Edit freely.");
    expect(page).toContain("30 August to 5 September");
    expect(page).toContain("6 to 12 September");
    expect(page).toContain("☑");
    expect(page).toContain("☐");
    expect(page).toContain("Wed 2 September");
    expect(page).toContain("October 2026");
    expect(page).toContain("The folklore door opens.");
  });

  it("says a plan is not laid out yet when the board carries none, and keeps the section", () => {
    const bare = html({ ...board, month: undefined, year: undefined });
    expect(bare.match(/Not laid out yet\./g)).toHaveLength(2);
    expect(bare).toContain('<section id="year"');
    expect(bare).not.toContain("6 to 12 September");
  });
});
