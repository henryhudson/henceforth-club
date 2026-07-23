import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DigestData } from "@/lib/this-week/types";

const mockLoadDigest = vi.fn();

vi.mock("@/lib/this-week/store", async orig => ({
  ...(await orig() as object),
  loadDigest: (week: string) => mockLoadDigest(week),
}));

import { generateMetadata as weekMetadata } from "./page";
import { generateMetadata as fullMetadata } from "./full/page";

const HEADLINE = "Andy Burnham takes office, and rewires the state";
const INTRO = "Britain changed Prime Minister with its elected House on holiday. The Commons rose on Thursday.";

const digest = (status: DigestData["status"]): DigestData => ({
  week: "2026-07-22",
  windowLabel: "16–22 July 2026",
  mode: "normal",
  generatedAt: "",
  recessReturnISO: null,
  headline: HEADLINE,
  stats: { divisions: 2, questions: 823, distinctAskers: 115 },
  departments: [],
  highlights: { votes: [], questions: [], bills: [] },
  body: ["the full article"],
  intro: INTRO,
  status,
})

const params = Promise.resolve({ week: "2026-07-22" })

beforeEach(() => {
  mockLoadDigest.mockReset();
});

describe("this-week page metadata", () => {
  it("names a published week by its own headline", async () => {
    mockLoadDigest.mockReturnValue(digest("published"));
    expect(JSON.stringify(await weekMetadata({ params }))).toContain(HEADLINE);
    expect(JSON.stringify(await fullMetadata({ params }))).toContain(HEADLINE);
  });

  it("says nothing about a draft week — the 404 response carries its metadata", async () => {
    mockLoadDigest.mockReturnValue(digest("draft"));
    for (const meta of [await weekMetadata({ params }), await fullMetadata({ params })]) {
      const json = JSON.stringify(meta);
      expect(json).not.toContain(HEADLINE);
      expect(json).not.toContain("Britain changed Prime Minister");
      expect(meta.title).toBe("This Week in Parliament");
    }
  });
});
