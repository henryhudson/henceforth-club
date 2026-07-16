import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import QuoteCard from "./QuoteCard";

describe("QuoteCard", () => {
  it("renders the fee/premium/total split in satoshis", () => {
    const html = renderToStaticMarkup(
      <QuoteCard feeSats={500} premiumSats={9_290_000} priceSats={9_290_500} />,
    );
    expect(html).toContain("500 satoshis");
    expect(html).toContain("9,290,000 satoshis");
    expect(html).toContain("9,290,500 satoshis");
  });

  it("renders the claimed-handle notice verbatim when present", () => {
    const notice = "@henry is already claimed by another key. Anyone can still archive this account.";
    const html = renderToStaticMarkup(
      <QuoteCard feeSats={500} premiumSats={9_290_000} priceSats={9_290_500} claimedNotice={notice} />,
    );
    expect(html).toContain(notice);
  });

  it("omits the notice block when there is no claimed handle", () => {
    const html = renderToStaticMarkup(
      <QuoteCard feeSats={500} premiumSats={9_290_000} priceSats={9_290_500} />,
    );
    expect(html).not.toContain("already claimed");
  });

  it("renders the media toggles disabled, pointing at the app", () => {
    const html = renderToStaticMarkup(
      <QuoteCard feeSats={500} premiumSats={9_290_000} priceSats={9_290_500} />,
    );
    expect(html).toContain("Images");
    expect(html).toContain("Videos");
    expect(html).toContain("get the app");
    expect(html.match(/disabled/g)?.length).toBe(2);
  });
});
