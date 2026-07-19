import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileView from "./ProfileView";
import fixture from "../fixtures/witness.json";
import type { XArchive } from "../parseArchive";

const archive = fixture as XArchive;

describe("ProfileView", () => {
  it("renders a chain-read archive without the words 'live preview'", () => {
    const html = renderToStaticMarkup(<ProfileView archive={archive} isPreview={false} />);
    expect(html).not.toContain("live preview");
    expect(html).toMatchSnapshot();
  });

  it("renders a dropped export WITH 'live preview', because it is not inscribed", () => {
    const html = renderToStaticMarkup(<ProfileView archive={archive} isPreview />);
    expect(html).toContain("live preview");
  });

  it("shows the author's profile picture on every post row", () => {
    const withAvatar: XArchive = {
      ...archive,
      profile: { ...archive.profile, avatarUrl: "https://pbs.twimg.com/profile_images/x_normal.jpg" },
    };
    const html = renderToStaticMarkup(<ProfileView archive={withAvatar} isPreview={false} />);
    // One avatar <img> per article, upgraded to full resolution, plus the
    // header's. Count img tags, not raw URL occurrences — React 19 also
    // hoists a <link rel="preload"> carrying the same URL.
    const rows = html.match(/<article/g)?.length ?? 0;
    const avatars = html.match(/<img src="[^"]*profile_images\/x\.jpg"/g)?.length ?? 0;
    expect(rows).toBeGreaterThan(0);
    expect(avatars).toBe(rows + 1);
  });

  it("keeps rows avatar-free when the archive has no profile picture", () => {
    const html = renderToStaticMarkup(<ProfileView archive={archive} isPreview={false} />);
    expect(html).not.toContain("profile_images");
  });

  it("signs every post row with the author's name, linking to their archive", () => {
    const html = renderToStaticMarkup(<ProfileView archive={archive} isPreview={false} />);
    const rows = html.match(/<article/g)?.length ?? 0;
    const nameLinks = html.match(/href="\/folklore\/someone"/g)?.length ?? 0;
    expect(rows).toBeGreaterThan(0);
    // One accessible name link per row — the avatar link is aria-hidden and
    // only exists when an avatar renders, which this fixture has none of.
    expect(nameLinks).toBe(rows);
    expect(html.match(/@someone/g)?.length).toBe(rows + 1); // rows + header card
  });

  it("shows kudos only — never upload cost — on the ranking chip", () => {
    const html = renderToStaticMarkup(
      <ProfileView
        archive={archive}
        isPreview={false}
        scores={{ "1": 150_000 }}
        foundingByPost={{ "1": 3412 }}
      />,
    );
    expect(html).toContain("◈ 150,000 kudos");
    expect(html).not.toContain("◈ cost");
    expect(html).not.toContain("3,412");
  });

  it('hides the identity card in "ledger" mode — the landing, where rows are signed instead', () => {
    const html = renderToStaticMarkup(
      <ProfileView archive={archive} isPreview={false} header="ledger" />,
    );
    expect(html).not.toContain("Joined"); // the card's join date is gone
    expect(html.match(/@someone/g)?.length).toBe(
      html.match(/<article/g)?.length ?? 0, // rows only, no header card
    );
  });
});
