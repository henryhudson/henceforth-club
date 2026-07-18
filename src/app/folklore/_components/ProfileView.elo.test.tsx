import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RatingTable } from "@/lib/kudos/elo";
import type { ScoreWindow } from "@/lib/xScore";
import ProfileView from "./ProfileView";
import fixture from "../fixtures/witness.json";
import type { XArchive } from "../parseArchive";

const archive = fixture as XArchive;

/** Article order as rendered — the ranking the reader actually sees. */
const postOrder = (html: string): string[] =>
  [...html.matchAll(/data-post-id="([^"]+)"/g)].map((m) => m[1]);

/** Every window carries the same table — enough to prove the buttons and the
 * decayed-fold ordering are present or retired. Decayed order: 3, 1, 2. */
const decayedScores = { "3": 900, "1": 100 };
const scoresByWindow = Object.fromEntries(
  (["day", "week", "month", "year", "all"] as const).map((w) => [w, decayedScores]),
) as Record<ScoreWindow, Record<string, number>>;

/** Post 2 established at 1600, post 3 provisional at 1400, post 1 never
 * dueled (1500 by default). Elo order: 2, 1, 3 — the reverse of decayed. */
const eloByPost: RatingTable = {
  "2": { rating: 1600, duels: 25 },
  "3": { rating: 1400, duels: 3 },
};

describe("the flag on — Elo sorts the folklore", () => {
  // Best is selected so SSR sees ranked order; production still opens on Latest.
  const html = renderToStaticMarkup(
    <ProfileView
      archive={archive}
      isPreview={false}
      scores={decayedScores}
      scoresByWindow={scoresByWindow}
      foundingByPost={{ "3": 500 }}
      kudosEnabled
      eloByPost={eloByPost}
      defaultMode="best"
    />,
  );

  it("sorts the Best tab by Elo rating, not the decayed fold", () => {
    expect(postOrder(html)).toEqual(["2", "1", "3"]);
  });

  it("opens on Latest by default so the full archive can scroll", () => {
    const latest = renderToStaticMarkup(
      <ProfileView
        archive={archive}
        isPreview={false}
        kudosEnabled
        eloByPost={eloByPost}
      />,
    );
    expect(postOrder(latest)).toEqual(["1", "2", "3"]);
  });

  it("retires the decayed-fold window buttons from the sort", () => {
    expect(html).not.toContain("This week");
    expect(html).not.toContain("Ranking window");
  });

  it("shows the rating on an established text and the unranked badge under twenty duels", () => {
    expect(html).toContain("1,600");
    expect(html).toContain("unranked");
  });

  it("says the ledger ranks by duels, not by kudos", () => {
    expect(html).toContain("ranked by duels won");
    expect(html).not.toContain("ranked by kudos");
  });

  it("shows kudos beside the rating, never cost or upload chips", () => {
    // scores map is still the kudos fold (post 3 = 900); founding is ignored.
    expect(html).toContain("◈ 900 kudos");
    expect(html).not.toContain("◈ cost");
  });

  it("rates a text at exactly twenty duels — the badge is strictly under twenty", () => {
    const boundary = renderToStaticMarkup(
      <ProfileView
        archive={archive}
        isPreview={false}
        kudosEnabled
        eloByPost={{
          "1": { rating: 1520, duels: 20 },
          "2": { rating: 1490, duels: 19 },
          "3": { rating: 1500, duels: 21 },
        }}
        defaultMode="best"
      />,
    );
    expect(boundary).toContain("1,520");
    expect(boundary.match(/unranked/g)?.length).toBe(1); // post 2 alone
  });
});

describe("the flag off — the decayed-fold sort stands, production unchanged", () => {
  const html = renderToStaticMarkup(
    <ProfileView
      archive={archive}
      isPreview={false}
      scores={decayedScores}
      scoresByWindow={scoresByWindow}
      defaultMode="best"
    />,
  );

  it("sorts the Best tab by the decayed fold", () => {
    expect(postOrder(html)).toEqual(["3", "1", "2"]);
  });

  it("keeps the window buttons", () => {
    expect(html).toContain("This week");
  });

  it("carries no rating markup at all — no badge, no duel copy", () => {
    expect(html).not.toContain("unranked");
    expect(html).toContain("ranked by kudos");
    expect(html).not.toContain("duels");
  });
});
