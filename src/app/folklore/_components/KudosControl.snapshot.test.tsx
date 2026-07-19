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

describe("giving kudos is app-only — the website never mounts a tip control", () => {
  it("ProfileView rows carry no give-kudos control", () => {
    const html = renderToStaticMarkup(
      <ProfileView archive={archive} isPreview={false} kudosEnabled tipsByPost={{ "1": 3 }} />,
    );
    expect(html).not.toContain("give kudos");
    expect(html).not.toContain("✦ kudos");
  });

  it("PostEntry never mounts a tip control, even with a handle and count", () => {
    const html = renderToStaticMarkup(
      <PostEntry
        post={archive.posts[0]}
        showParent={false}
        handle="someone"
        kudosEnabled
        tipCount={7}
      />,
    );
    expect(html).not.toContain("give kudos");
    expect(html).not.toContain("✦ kudos");
  });
});
