import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DigestData } from "@/lib/this-week/types";

const mockLoadDigest = vi.fn();

// `next/og` rasterises through satori; capture the element instead so the card's
// own words can be read back.
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(public element: React.ReactElement) {}
  },
}));
vi.mock("@/lib/this-week/store", async orig => ({
  ...(await orig() as object),
  loadDigest: (week: string) => mockLoadDigest(week),
}));

import OG from "./opengraph-image";

const digest = (status: DigestData["status"]): DigestData => ({
  week: "2026-07-22",
  windowLabel: "16–22 July 2026",
  mode: "normal",
  generatedAt: "",
  recessReturnISO: null,
  headline: "Andy Burnham takes office, and rewires the state",
  stats: { divisions: 2, questions: 823, distinctAskers: 115 },
  departments: [],
  highlights: { votes: [], questions: [], bills: [] },
  feature: {
    title: "The mayor who came south",
    asker: "",
    party: null,
    department: "",
    count: 1,
    status: "",
    summary: "",
    questions: [],
  },
  intro: "",
  status,
});

const card = async () => {
  const image = await OG({ params: Promise.resolve({ week: "2026-07-22" }) });
  return renderToStaticMarkup((image as unknown as { element: React.ReactElement }).element);
};

beforeEach(() => {
  mockLoadDigest.mockReset();
});

describe("this-week share card", () => {
  it("renders a published week's own headline, statistics and story", async () => {
    mockLoadDigest.mockReturnValue(digest("published"));
    const html = await card();
    expect(html).toContain("Andy Burnham takes office");
    expect(html).toContain("The mayor who came south");
    expect(html).toContain("16–22 July 2026");
  });

  it("gives a draft week the generic fallback — an unpublished digest must not leak through its own share card", async () => {
    mockLoadDigest.mockReturnValue(digest("draft"));
    const html = await card();
    expect(html).not.toContain("Andy Burnham takes office");
    expect(html).not.toContain("The mayor who came south");
    expect(html).not.toContain("16–22 July 2026");
    expect(html).not.toContain("823");
    expect(html).toContain("This Week in Parliament");
  });
});
