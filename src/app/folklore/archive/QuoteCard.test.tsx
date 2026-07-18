import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import QuoteCard from "./QuoteCard";

describe("QuoteCard", () => {
  it("states the repriced sum and the live satoshi figure, with no fee itemisation", () => {
    const html = renderToStaticMarkup(<QuoteCard priceSats={19_081_386} />);
    expect(html).toContain("£2 + inscription fee");
    expect(html).toContain("19,081,386 satoshis at the live rate");
    expect(html).not.toContain("Miner fee");
    expect(html).not.toContain("Premium");
  });

  it("names the kudos float plainly when kudos are enabled — the £2 comes back as 2,000 kudos", () => {
    const html = renderToStaticMarkup(<QuoteCard priceSats={19_081_386} kudosEnabled />);
    expect(html).toContain("kudos float");
    expect(html).toContain("2,000 kudos");
  });

  it("shows no kudos copy while kudos are not enabled", () => {
    const html = renderToStaticMarkup(<QuoteCard priceSats={19_081_386} />);
    expect(html).not.toContain("kudos");
  });

  it("renders the claimed-handle notice verbatim when present", () => {
    const notice = "@henry is already claimed by another key. Anyone can still archive this account.";
    const html = renderToStaticMarkup(<QuoteCard priceSats={19_081_386} claimedNotice={notice} />);
    expect(html).toContain(notice);
  });

  it("omits the notice block when there is no claimed handle", () => {
    const html = renderToStaticMarkup(<QuoteCard priceSats={19_081_386} />);
    expect(html).not.toContain("already claimed");
  });

  it("renders the media toggles disabled, pointing at the app", () => {
    const html = renderToStaticMarkup(<QuoteCard priceSats={19_081_386} />);
    expect(html).toContain("Images");
    expect(html).toContain("Videos");
    expect(html).toContain("get the app");
    expect(html.match(/disabled/g)?.length).toBe(2);
  });
});
