import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// The wiring test for the front page's board, not a test of the pieces it
// wires. `boardMerge` and `readHandleCards` each have their own unit suites,
// and both were green while the page still rendered nothing for a top-ranked
// archiver outside the directory window — because nothing asserted that the
// page CALLS them. So the reads are mocked and everything between them is
// the real thing: the page's own composition is the subject.
const mockListHandles = vi.fn();
const mockReadHandleCards = vi.fn();
const mockBoardTop = vi.fn();

vi.mock("@/lib/xIndex", () => ({
  listHandles: (...args: unknown[]) => mockListHandles(...args),
  readHandleCards: (...args: unknown[]) => mockReadHandleCards(...args),
}));
vi.mock("@/lib/folkloreBoard", async (orig) => ({
  ...((await orig()) as object),
  boardTop: (...args: unknown[]) => mockBoardTop(...args),
}));
// Off the network: the witness archive and the exchange rate are page
// furniture here, and an absent one of either renders its own honest fallback.
vi.mock("@/lib/xArchiveCache", () => ({ getArchivePage: async () => null }));
vi.mock("@/lib/xPrice", () => ({ gbpPerBsv: async () => undefined }));
// A directory row's markup is not what this test is about. Stood in by the one
// fact the assertion needs — WHICH handle the page decided to give a card to.
vi.mock("./_components/DirectoryRow", () => ({
  default: ({ handle }: { handle: string }) => <div>@{handle}</div>,
}));
// The row data is one batched store read; off the network here, same as the
// witness archive above. `directoryRows.test.ts` covers the batching itself.
vi.mock("./_components/directoryRows", () => ({ readDirectoryRows: async () => new Map() }));

import { profileMember } from "@/lib/folkloreBoard";
import FolklorePage from "./page";

/** A full directory window of recent registrations — the read that a
 * long-standing archiver falls off the end of. */
const RECENT_HUNDRED = Array.from({ length: 100 }, (_, i) => ({
  handle: `newcomer${i}`,
  latestMs: 10_000 + i,
}));

const VETERAN = { handle: "zed", latestMs: 1_000 };

const render = () => FolklorePage().then(renderToStaticMarkup);

beforeEach(() => {
  vi.unstubAllEnvs();
  mockListHandles.mockReset();
  mockReadHandleCards.mockReset();
  mockBoardTop.mockReset();
  mockListHandles.mockResolvedValue(RECENT_HUNDRED);
  mockReadHandleCards.mockResolvedValue([]);
  mockBoardTop.mockResolvedValue([]);
});

describe("/folklore — the board resolves beyond the directory's window", () => {
  it("gives a top-ranked archiver a card even though the directory read cut her", async () => {
    // `x:handles` is scored by registration time and `folklore:board` by
    // kudos, so the hundred most recent registrations and the hundred highest
    // scorers are different people. Zed tops the board and registered before
    // any of them: the directory read does not carry her card, and a page that
    // merges against that read alone renders her NOWHERE — not demoted, absent.
    mockBoardTop.mockResolvedValue([{ member: profileMember(VETERAN.handle), score: 40 }]);
    mockReadHandleCards.mockResolvedValue([VETERAN]);

    const html = await render();

    expect(mockReadHandleCards).toHaveBeenCalledWith([VETERAN.handle]);
    expect(html).toContain("@zed");
  });

  it("ranks the rescued card by its kudos, above the directory it was missing from", async () => {
    // Rescued into the RESOLUTION set, not appended to the tail: a card that
    // came back at score zero underneath the whole directory would be a
    // different bug wearing the same fix.
    mockBoardTop.mockResolvedValue([{ member: profileMember(VETERAN.handle), score: 40 }]);
    mockReadHandleCards.mockResolvedValue([VETERAN]);

    const html = await render();

    expect(html.indexOf("@zed")).toBeGreaterThan(-1);
    expect(html.indexOf("@zed")).toBeLessThan(html.indexOf("@newcomer0"));
  });

  it("reads nothing extra while every board handle is inside the directory window", async () => {
    // Today's shape, and the cost claim the fix rests on: the second read
    // only ever asks for names actually missing, so on a small directory it
    // does not happen at all.
    mockBoardTop.mockResolvedValue([{ member: profileMember("newcomer3"), score: 12 }]);

    const html = await render();

    expect(mockReadHandleCards).not.toHaveBeenCalled();
    expect(html).toContain("@newcomer3");
  });

  it("still renders nothing for a board handle the directory does not hold", async () => {
    // The moderation lever survives the rescue: a delisted or unknown handle
    // yields no card from the look-up, so it yields no row.
    mockBoardTop.mockResolvedValue([{ member: profileMember("ghost"), score: 99 }]);
    mockReadHandleCards.mockResolvedValue([]);

    const html = await render();

    expect(mockReadHandleCards).toHaveBeenCalledWith(["ghost"]);
    expect(html).not.toContain("@ghost");
  });
});
