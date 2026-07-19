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
    expect(html).toContain("12 kudos");
    expect(html).toContain("3 comments");
    expect(html).toContain(`/folklore/tx/${TXID}`);
    // The explorer link-out — BananaBlocks, path verified live 2026-07-19.
    expect(html).toContain(`https://bananablocks.com/tx/${TXID}`);
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
});
