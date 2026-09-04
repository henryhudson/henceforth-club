import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SubmitFlow, { PreviewCard, listedRefusal } from "./SubmitFlow";

const TXID = "c".repeat(64);
const OTHER = "d".repeat(64);

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

// The refusal before the money. A stamp pays the ten-pence floor on chain,
// and the index refuses a listed target 409 whatever it paid — so the form
// must refuse first, from the preview's board read, and never prepare a
// stamp the index is certain to turn away.
describe("SubmitFlow — a listed target gets no stamp prepared", () => {
  const ready = (txid: string, listed: boolean) =>
    ({ kind: "ready", preview: { txid, kind: "opaque", listed } }) as const;

  it("refuses a target the preview found on the board, naming the one-row rule", () => {
    const message = listedRefusal(ready(TXID, true), TXID);
    expect(message).toContain("already on the board");
    expect(message).toContain("one row per transaction id");
  });

  it("refuses nothing it has not seen listed: an unlisted, still-loading, or stale preview", () => {
    expect(listedRefusal(ready(TXID, false), TXID)).toBeNull();
    // The index keeps its 409 for these: a preview still in flight, or one
    // of a different id than the paste the visitor is now submitting.
    expect(listedRefusal({ kind: "loading", txid: TXID }, TXID)).toBeNull();
    expect(listedRefusal({ kind: "idle" }, TXID)).toBeNull();
    expect(listedRefusal(ready(OTHER, true), TXID)).toBeNull();
  });

  it("offers the existing thread on the card instead of a stamp", () => {
    const html = renderToStaticMarkup(
      <PreviewCard
        state={{
          kind: "ready",
          preview: { txid: TXID, kind: "map", source: "twetch", title: "A cello note", listed: true },
        }}
        onListInstead={() => {}}
      />,
    );
    expect(html).toContain("already on the board");
    expect(html).toContain("A cello note");
    expect(html).toContain(`/folklore/tx/${TXID}`);
    expect(html).toContain("Open the existing thread");
  });

  it("still previews an unlisted target as before, with the thread link to open", () => {
    const html = renderToStaticMarkup(
      <PreviewCard
        state={{ kind: "ready", preview: { txid: TXID, kind: "map", source: "twetch", listed: false } }}
        onListInstead={() => {}}
      />,
    );
    expect(html).not.toContain("already on the board");
    expect(html).toContain("open the thread");
  });
});
