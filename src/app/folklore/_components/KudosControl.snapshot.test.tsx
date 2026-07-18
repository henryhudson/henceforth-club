import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import KudosControl, { KUDOS_NUDGE, type KudosCommitResult } from "./KudosControl";
import PostEntry from "./PostEntry";
import ProfileView from "./ProfileView";
import fixture from "../fixtures/witness.json";
import type { XArchive } from "../parseArchive";

const archive = fixture as XArchive;
const noCommit = async (): Promise<KudosCommitResult> => ({ kind: "recorded" });

describe("KudosControl", () => {
  it("renders ready with the public count — one tappable control, no vote button", () => {
    const html = renderToStaticMarkup(
      <KudosControl gesture={{ kind: "ready" }} count={12} onCommit={noCommit} />,
    );
    expect(html).toContain("kudos");
    expect(html).toContain("12");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toMatch(/vote/i);
    expect(html).toMatchSnapshot();
  });

  it("renders a visitor's control disabled with the one-line £2 nudge", () => {
    const html = renderToStaticMarkup(
      <KudosControl gesture={{ kind: "visitor" }} onCommit={noCommit} />,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain("£2");
    expect(KUDOS_NUDGE).toContain("£2");
    expect(html).toMatchSnapshot();
  });

  it("stays quiet — disabled, no pitch — while the session is still unknown", () => {
    const html = renderToStaticMarkup(
      <KudosControl gesture={{ kind: "quiet" }} onCommit={noCommit} />,
    );
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("£2");
  });

  it("hides a zero count rather than advertising nothing", () => {
    const html = renderToStaticMarkup(
      <KudosControl gesture={{ kind: "ready" }} count={0} onCommit={noCommit} />,
    );
    expect(html).toContain("kudos");
    expect(html).not.toContain("· 0");
  });
});

describe("the control on text rows and single-post pages", () => {
  it("sits on every text row when the server threads the flag through", () => {
    const html = renderToStaticMarkup(
      <ProfileView archive={archive} isPreview={false} kudosEnabled tipsByPost={{ "1": 3 }} />,
    );
    const rows = html.match(/<article/g)?.length ?? 0;
    const controls = html.match(/give kudos/g)?.length ?? 0;
    expect(rows).toBeGreaterThan(0);
    expect(controls).toBe(rows);
  });

  it("is invisible without the flag — no give-kudos control on the rows", () => {
    const html = renderToStaticMarkup(<ProfileView archive={archive} isPreview={false} />);
    expect(html).not.toContain("give kudos");
    expect(html).not.toContain("✦ kudos");
  });

  it("shows the public count on a single post row", () => {
    const html = renderToStaticMarkup(
      <PostEntry
        post={archive.posts[0]}
        showParent={false}
        handle="someone"
        kudosEnabled
        tipCount={7}
      />,
    );
    expect(html).toContain("kudos");
    expect(html).toContain("7");
    expect(html).toMatchSnapshot();
  });

  it("never renders on a row without the flag, even with a count present", () => {
    const html = renderToStaticMarkup(
      <PostEntry post={archive.posts[0]} showParent={false} handle="someone" tipCount={7} />,
    );
    expect(html).not.toContain("kudos");
  });
});
