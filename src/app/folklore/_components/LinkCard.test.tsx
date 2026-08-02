import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { validateLink } from "../linkRecord";
import LinkCard from "./LinkCard";

const TXID = "f".repeat(64);

const LINK = validateLink("https://example.com/deep/post", "A board headline", "henry");
if (!LINK) throw new Error("fixture link must validate");

describe("LinkCard", () => {
  it("titles the card with the url, then domain, submitter, kudos, comments, explorer", () => {
    const html = renderToStaticMarkup(
      <LinkCard txid={TXID} record={LINK} kudos={12} comments={3} />,
    );

    expect(html).toContain("A board headline");
    expect(html).toContain('href="https://example.com/deep/post"');
    expect(html).toContain("example.com");
    expect(html).toContain("by @henry");
    expect(html).toContain("3 comments");
    expect(html).toContain(`/folklore/tx/${TXID}`);
    // The explorer link-out — BananaBlocks, path verified live 2026-07-19.
    expect(html).toContain(`https://bananablocks.com/tx/${TXID}`);
  });

  // The other half of "rank by kudos": a link with a bound submitter is
  // tippable, so its count IS the control — the same FeedKudos the tip route
  // serves, aimed at the link's txid with the verified `by` as the earner.
  // Before this, the backend arm (recordTip → isBoardLink → linkMember bump)
  // was complete and NOTHING in the interface could fire it: a visitor paid
  // for a ranked placement whose rank could never move.
  it("renders the kudos control for a link with a bound submitter", () => {
    const html = renderToStaticMarkup(
      <LinkCard txid={TXID} record={LINK} kudos={12} comments={3} />,
    );

    expect(html).toContain('aria-label="give kudos to this text by @henry"');
    // The control carries the count, so the static text must not double it.
    expect(html).toContain("· 12");
    expect(html).not.toContain("12 kudos");
  });

  it("stays quiet about an absent submitter and pluralizes a single comment", () => {
    const anonymous = validateLink("https://example.com/a", "Anonymous find");
    if (!anonymous) throw new Error("fixture link must validate");

    const html = renderToStaticMarkup(
      <LinkCard txid={TXID} record={anonymous} kudos={0} comments={1} />,
    );

    expect(html).not.toContain("by @");
    expect(html).toContain("1 comment");
    expect(html).not.toContain("1 comments");
  });

  // An anonymous link names no earner, and the tip route refuses it by design
  // (debiting a giver with nothing to accrue against would break the float's
  // conservation invariant). Offering the control would be a promise the
  // route must break — the count stays static text.
  it("offers no kudos control on an anonymous link", () => {
    const anonymous = validateLink("https://example.com/a", "Anonymous find");
    if (!anonymous) throw new Error("fixture link must validate");

    const html = renderToStaticMarkup(
      <LinkCard txid={TXID} record={anonymous} kudos={7} comments={0} />,
    );

    expect(html).not.toContain("give kudos");
    expect(html).toContain("7 kudos");
  });
});
