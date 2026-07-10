import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PaymentPanel from "./PaymentPanel";

const ADDRESS = "1BoatSLRHtKNngkdXEeobR76b53LETtpyT";

describe("PaymentPanel", () => {
  it("shows the address and amount as selectable text", () => {
    const html = renderToStaticMarkup(<PaymentPanel address={ADDRESS} priceSats={9_290_500} />);
    expect(html).toContain(ADDRESS);
    expect(html).toContain("0.092905 bitcoin SV");
    expect(html).toContain("9,290,500 satoshis");
  });

  it("links the QR to the exact bitcoin: uniform resource identifier, amount included", () => {
    const html = renderToStaticMarkup(<PaymentPanel address={ADDRESS} priceSats={9_290_500} />);
    expect(html).toContain(`href="bitcoin:${ADDRESS}?amount=0.092905"`);
  });

  it("renders a non-empty QR path", () => {
    const html = renderToStaticMarkup(<PaymentPanel address={ADDRESS} priceSats={9_290_500} />);
    expect(html).toMatch(/<path d="M[^"]+"/);
  });
});
