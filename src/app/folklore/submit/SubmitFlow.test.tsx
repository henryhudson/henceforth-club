import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SubmitFlow from "./SubmitFlow";

const TXID = "c".repeat(64);

describe("SubmitFlow — the first render", () => {
  it("opens on the paste field and the stamp's door: no quote, no job, no web-address arm", () => {
    const html = renderToStaticMarkup(<SubmitFlow floorPence={10} />);
    expect(html).toContain("Paste a transaction id");
    expect(html).toContain("Prepare the stamp");
    expect(html).toContain("Title · up to 300 characters");
    expect(html).not.toContain("Get the quote");
    expect(html).not.toContain("http or https");
  });

  it("still opens in comment mode for a parent, on the unchanged comment rail", () => {
    const html = renderToStaticMarkup(<SubmitFlow floorPence={10} defaultParent={TXID} />);
    expect(html).toContain(TXID);
    expect(html).toContain("Your comment");
    expect(html).toContain("Get the quote");
  });
});
