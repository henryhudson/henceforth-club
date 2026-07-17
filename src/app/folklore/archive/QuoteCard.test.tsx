import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import QuoteCard from "./QuoteCard";

describe("QuoteCard", () => {
  it("states the flat pound and the live satoshi figure, with no fee itemisation", () => {
    const html = renderToStaticMarkup(<QuoteCard priceSats={9_290_443} />);
    expect(html).toContain("£1");
    expect(html).toContain("9,290,443 satoshis at the live rate");
    expect(html).not.toContain("Miner fee");
    expect(html).not.toContain("Premium");
  });

  it("renders the claimed-handle notice verbatim when present", () => {
    const notice = "@henry is already claimed by another key. Anyone can still archive this account.";
    const html = renderToStaticMarkup(<QuoteCard priceSats={9_290_443} claimedNotice={notice} />);
    expect(html).toContain(notice);
  });

  it("omits the notice block when there is no claimed handle", () => {
    const html = renderToStaticMarkup(<QuoteCard priceSats={9_290_443} />);
    expect(html).not.toContain("already claimed");
  });

  it("renders the media toggles disabled, pointing at the app", () => {
    const html = renderToStaticMarkup(<QuoteCard priceSats={9_290_443} />);
    expect(html).toContain("Images");
    expect(html).toContain("Videos");
    expect(html).toContain("get the app");
    expect(html.match(/disabled/g)?.length).toBe(2);
  });
});
