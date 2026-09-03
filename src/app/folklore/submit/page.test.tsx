import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import SubmitPage, { generateMetadata } from "./page";

const TXID = "c".repeat(64);

const render = async (params: { parent?: string | string[] } = {}) =>
  renderToStaticMarkup(await SubmitPage({ searchParams: Promise.resolve(params) }));

describe("SubmitPage — the mechanical gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders only the stub when the flag is unset", async () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", undefined);
    const html = await render();
    expect(html).toContain("Submit to the board");
    expect(html).toContain("not open yet");
    expect(html).not.toContain("What are you submitting");
    expect(html).not.toContain("Get the quote");
  });

  it("renders only the stub for any value other than the exact string true", async () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "1");
    const html = await render();
    expect(html).toContain("not open yet");
    expect(html).not.toContain("What are you submitting");
  });

  it("renders the real form once the flag is exactly \"true\"", async () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "true");
    const html = await render();
    expect(html).not.toContain("not open yet");
    expect(html).toContain("What are you submitting");
    expect(html).toContain("10p + the inscription fee");
    expect(html).toContain("Paste a transaction id");
    expect(html).toContain("Title · up to 300 characters");
  });

  it("opens in comment mode when ?parent= carries a plausible txid", async () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "true");
    const html = await render({ parent: TXID });
    expect(html).toContain(TXID);
    expect(html).toContain("Your comment");
  });

  it("ignores a parent that is not a txid", async () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "true");
    const html = await render({ parent: "not-a-txid" });
    expect(html).not.toContain("not-a-txid");
    expect(html).toContain("Title · up to 300 characters");
  });
});

describe("generateMetadata — rides the same gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("says submissions are closed while the flag is off", () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", undefined);
    const metadata = generateMetadata();
    expect(metadata.title).toBe("Submit to the board");
    expect(metadata.description).toContain("not open yet");
  });

  it("still says closed for any value other than the exact string true", () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "1");
    expect(generateMetadata().description).toContain("not open yet");
  });

  it("describes the live form once the flag is exactly \"true\"", () => {
    vi.stubEnv("FOLKLORE_SUBMIT_ENABLED", "true");
    const metadata = generateMetadata();
    expect(metadata.description).not.toContain("not open yet");
    expect(metadata.description).toContain("10p stamp");
  });
});
