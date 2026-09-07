import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { boardBookModel, type BookBoard } from "@/lib/board-book";
import BoardBook from "./BoardBook";
import b from "./board.module.css";
import s from "./book.module.css";

const DATE = "2026-09-07";

const board: BookBoard = {
  generated: "2026-09-07 09:55 · Monday",
  cards: [
    { id: "t1", col: "todo", apps: ["hansard"], title: "Two Dependabot alerts on the screenshot tool", phase: "PULL this week", movedAt: "2026-09-07T09:20:00+01:00", desc: "2026-09-07 · Tooling, not the app. More." },
    { id: "r1", col: "review", title: "File the confirmation statement", phase: "YOU: did the identity check happen?" },
  ],
  week: {
    weekPlan: [
      { date: "2026-09-07", weekday: "Mon", isReviewDay: false, tasks: [{ label: "Cut episode fifteen, the chain.", done: true }, "Press the 1.10 release."] },
    ],
  },
  month: {
    title: "September 2026",
    note: "Drafted on 7 September. Edit freely.",
    items: [
      { when: "2026-09-02", label: "Ship day: Henceforth 4.54 shipped.", done: true },
      { when: "2026-09-09", label: "Ship day: Hansard 1.11 and Henceforth 4.55." },
      { when: "Later", label: "The Today calendar tab decided." },
    ],
  },
  year: {
    title: "The year from September 2026",
    items: [
      { when: "2026-09", label: "Hansard 1.11 makes the Latest tab the front door." },
      { when: "2026-10", label: "The folklore door opens." },
    ],
  },
};

const html = (b: BookBoard) => renderToStaticMarkup(<BoardBook model={boardBookModel(b, null, DATE)} date={DATE} />);

/** The classes of each box labelled `label`, in page order, as the markup sets them. */
const boxClasses = (page: string, label: string) =>
  [...page.matchAll(new RegExp(`<div class="([^"]+)"><span class="[^"]+">${label}</span>`, "g"))].map((m) => m[1].split(" "));

/** The markup of one page of the book. */
const section = (page: string, id: string, next: string) => page.slice(page.indexOf(`<section id="${id}"`), page.indexOf(`<section id="${next}"`));

describe("The Board as a book", () => {
  const page = html(board);

  it("sets the front, then four pages in order, each anchored and headed by its name, the date, the month or the year's span, and no page for what is in progress", () => {
    expect([...page.matchAll(/<section id="([a-z]+)"/g)].map((m) => m[1])).toEqual(["todo", "day", "month", "year"]);
    const h1 = page.match(/<h1 class="([^"]+)"/)?.[1];
    for (const title of ["To do", "Monday 7 September 2026", "September 2026", "September 2026 to August 2027"]) {
      expect(page).toContain(`<h1 class="${h1}">${title}</h1>`);
    }
    expect(page).not.toContain(">In progress</h1>");
    for (const foot of ["To do", "The day", "The month", "The year"]) expect(page).toContain(`<b>The Board</b> · ${foot}`);
    expect(page).not.toContain("<b>The Board</b> · In progress");
    expect(page.indexOf("The working set of the four")).toBeLessThan(page.indexOf("<section"));
  });

  it("wears the board stylesheet's class on the front, so the packer's column rules and the sheet's own borders read the house line from it", () => {
    const front = page.match(/<div class="([^"]*\ba4-print-root\b[^"]*)"/);
    expect(front?.[1].split(" ")).toContain(b.sheet);
  });

  it("gives the book's pages their top and bottom margins, the sides at nought so no page is narrower than the front, a running foot counting the pages, and the front its own first page", () => {
    expect(page).toContain("margin: 12mm 0 14mm;");
    expect(page).toContain('content: "The Board · Monday 7th of September 2026 · page " counter(page) " of " counter(pages);');
    expect(page).toContain("@page :first {");
    expect(page.indexOf("a4-print-root")).toBeLessThan(page.indexOf("@page :first"));
  });

  it("counts the parked to-do cards on the front's pulls square in one agate line, and prints no line when none are parked", () => {
    expect(page).not.toContain("parked, on the To do pages");
    const parked = html({ ...board, cards: [...board.cards, { id: "p1", col: "todo", title: "A parked card", phase: "PARKED: until October" }] });
    expect(parked).toContain("and 1 parked, on the To do pages");
    expect(parked.indexOf("This week")).toBeLessThan(parked.indexOf("and 1 parked, on the To do pages"));
    expect(parked.indexOf("and 1 parked, on the To do pages")).toBeLessThan(parked.indexOf("The ship ledgers"));
  });

  it("sets the cards to do with the column page's renderer, and with nothing in progress prints neither the in-hand label nor a line saying so", () => {
    const todo = section(page, "todo", "day");
    expect(todo).toContain("Two Dependabot alerts on the screenshot tool");
    expect(todo).toContain("The Hansard · moved 7 September 2026");
    expect(todo).toContain("Tooling, not the app.");
    expect(todo).toContain("As the board stood at 2026-09-07 09:55 · 1 card · newest first");
    expect(todo).not.toContain("In hand");
    expect(todo).not.toContain("Nothing in hand.");
    expect(todo.match(/<article class="/g)).toHaveLength(1);
  });

  it("carries the cards in hand at the top of the To do page under their label, set as the to-do cards are, newest first, and counts both in the standfirst", () => {
    const busy = html({
      ...board,
      cards: [
        ...board.cards,
        { id: "h1", col: "inprogress", apps: ["henceforth"], title: "Episode sixteen, the chain", phase: "CUT: Thursday", movedAt: "2026-09-06T09:00:00+01:00", desc: "2026-09-06 · The script is staged. More." },
        { id: "h2", col: "inprogress", apps: ["deck"], title: "Deck convert", movedAt: "2026-09-07T08:30:00+01:00" },
      ],
    });
    const todo = section(busy, "todo", "day");
    expect(todo).toContain(`<div class="${s.bandLabel}">In hand</div>`);
    const label = todo.indexOf("In hand");
    const newer = todo.indexOf("Deck convert");
    const older = todo.indexOf("Episode sixteen, the chain");
    const toDo = todo.indexOf("Two Dependabot alerts on the screenshot tool");
    expect(label).toBeGreaterThan(0);
    expect(newer).toBeGreaterThan(label);
    expect(older).toBeGreaterThan(newer);
    expect(toDo).toBeGreaterThan(older);
    expect(todo).toContain("Henceforth · moved 6 September 2026");
    expect(todo).toContain("The script is staged.");
    expect(todo).toContain("As the board stood at 2026-09-07 09:55 · 3 cards · newest first");
    expect(todo.match(/<article class="/g)).toHaveLength(3);
    expect(todo).not.toContain("Nothing in hand.");
    expect(todo).not.toContain("Nothing to do.");
    expect([...busy.matchAll(/<section id="([a-z]+)"/g)].map((m) => m[1])).toEqual(["todo", "day", "month", "year"]);
  });

  it("prints the day as the week's plan for the date, ticked, above twenty-four empty hour boxes", () => {
    expect(page).toContain("From the week&#x27;s plan");
    expect(page).toContain("☑</span><span>Cut episode fifteen, the chain.");
    expect(page).toContain("☐</span><span>Press the 1.10 release.");
    expect(page).toContain("2 items · 1 done");
    const day = section(page, "day", "month");
    expect([...day.matchAll(/<span class="[^"]+">(\d\d)<\/span><\/div>/g)].map((m) => m[1])).toEqual(
      Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")),
    );
    expect(day).not.toContain("☐</span><span>Cut");
  });

  it("prints the month as seven columns of days with the days either side greyed, each item in its day's box, the done one ticked", () => {
    const month = section(page, "month", "year");
    expect(month).toContain("Drafted on 7 September. Edit freely.");
    expect(month).toContain("<span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>");
    expect(boxClasses(month, "31").map((c) => c.length)).toEqual([2]);
    expect(boxClasses(month, "4").map((c) => c.length)).toEqual([1, 2]);
    expect(boxClasses(month, "1").map((c) => c.length)).toEqual([1, 2]);
    expect(boxClasses(month, "30").map((c) => c.length)).toEqual([1]);
    expect(boxClasses(month, "\\d+")).toHaveLength(35);
    const nine = month.indexOf('">9</span>');
    const ten = month.indexOf('">10</span>');
    const ship = month.indexOf("Ship day: Hansard 1.11 and Henceforth 4.55.");
    expect(nine).toBeGreaterThan(0);
    expect(ship).toBeGreaterThan(nine);
    expect(ship).toBeLessThan(ten);
    expect(month).toContain("☑</span><span>Ship day: Henceforth 4.54 shipped.");
    expect(month).toContain("Also on the plan");
    expect(month).toContain("Later · </b>The Today calendar tab decided.");
    expect(month).toContain("3 items · 1 done");
  });

  it("prints the year as twelve month boxes from the plan's first month, each item in its month's box", () => {
    const year = page.slice(page.indexOf('<section id="year"'));
    const labels = ["September 2026", "October 2026", "November 2026", "December 2026", "January 2027", "February 2027", "March 2027", "April 2027", "May 2027", "June 2027", "July 2027", "August 2027"];
    expect(boxClasses(year, "[A-Z][a-z]+ 20\\d\\d")).toHaveLength(12);
    for (const label of labels) expect(boxClasses(year, label)).toEqual([[expect.any(String)]]);
    const october = year.indexOf('">October 2026</span>');
    const november = year.indexOf('">November 2026</span>');
    const door = year.indexOf("The folklore door opens.");
    expect(door).toBeGreaterThan(october);
    expect(door).toBeLessThan(november);
    expect(year).toContain("2 items · 0 done");
  });

  it("says a plan is not laid out yet when the board carries none, and still prints the empty boxes", () => {
    const bare = html({ ...board, week: undefined, month: undefined, year: undefined });
    expect(bare.match(/Not laid out yet\./g)).toHaveLength(2);
    expect(bare).toContain("Nothing on the week&#x27;s plan for the day.");
    expect(bare).toContain('<section id="year"');
    expect(boxClasses(section(bare, "month", "year"), "\\d+")).toHaveLength(35);
    expect(boxClasses(bare, "31").map((c) => c.length)).toEqual([2]);
    expect(boxClasses(bare, "August 2027")).toHaveLength(1);
    expect(bare).not.toContain("Also on the plan");
    expect(bare).not.toContain("Ship day");
    expect(bare.match(/0 items · 0 done/g)).toHaveLength(3);
  });
});

/** The stylesheets The Board draws with: the front sheet's, the book's, and
 *  the column pages', whose cards the To do page sets. */
const here = dirname(fileURLToPath(import.meta.url));
const sheets = [
  ["board.module.css", join(here, "board.module.css")],
  ["book.module.css", join(here, "book.module.css")],
  ["columns.module.css", join(here, "../../../columns/[date]/[column]/_components/columns.module.css")],
];

describe("The Board's lines", () => {
  it.each(sheets)("%s declares the house line once, 1.5pt solid black, and draws every rule with it", (_, file) => {
    const declarations = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declarations.match(/\d*\.?\d+(?:pt|px) solid[^;]*/g)).toEqual(["1.5pt solid #111"]);
    expect(declarations).toContain("--rule: 1.5pt solid #111;");
    expect(declarations).not.toMatch(/border-width/);
    const rules = declarations.match(/(?:border(?:-top|-right|-bottom|-left)?|column-rule)\s*:\s*[^;]+;/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).toMatch(/:\s*(?:var\(--rule\)|none);$/);
  });

  it("gives the packer's painted column rules on the front the same line", () => {
    const front = readFileSync(join(here, "board.module.css"), "utf8");
    expect(front).toContain("--pack-rule-w: 1.5pt;");
    expect(front).toContain("--pack-rule-c: #111;");
  });
});
