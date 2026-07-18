import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ArchivePage, { generateMetadata } from "./page";

// The page fetches the display exchange rate server-side; tests stay
// hermetic — an absent rate simply omits the pound figure.
vi.mock("@/lib/xPrice", () => ({ gbpPerBsv: async () => undefined }));

describe("ArchivePage — the mechanical gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders only the stub when the flag is unset", async () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", undefined);
    const html = renderToStaticMarkup(await ArchivePage());
    expect(html).toContain("Archive yours");
    expect(html).toContain("arrives shortly");
    expect(html).not.toContain("Choose or drop");
    expect(html).not.toContain("Bitcoin is forever");
  });

  it("renders only the stub for any value other than the exact string true", async () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", "1");
    const html = renderToStaticMarkup(await ArchivePage());
    expect(html).toContain("arrives shortly");
    expect(html).not.toContain("Choose or drop");
  });

  it("renders the real flow once the flag is exactly \"true\"", async () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", "true");
    const html = renderToStaticMarkup(await ArchivePage());
    expect(html).not.toContain("arrives shortly");
    expect(html).toContain("Choose or drop");
    expect(html).toContain("£2 + the inscription fee");
    expect(html).not.toContain("£1");
  });

  it("names the kudos float in the header only when KUDOS_ENABLED is exactly \"true\"", async () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", "true");
    vi.stubEnv("KUDOS_ENABLED", "true");
    const withKudos = renderToStaticMarkup(await ArchivePage());
    expect(withKudos).toContain("kudos float");

    vi.stubEnv("KUDOS_ENABLED", "1");
    const withoutKudos = renderToStaticMarkup(await ArchivePage());
    expect(withoutKudos).not.toContain("kudos");
  });
});

describe("generateMetadata — rides the same gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("describes the stub while the flag is off", () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", undefined);
    const metadata = generateMetadata();
    expect(metadata.title).toBe("Archive yours");
    expect(metadata.description).toContain("arriving shortly");
  });

  it("still describes the stub for any value other than the exact string true", () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", "1");
    expect(generateMetadata().description).toContain("arriving shortly");
  });

  it("describes the live flow once the flag is exactly \"true\"", () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", "true");
    const metadata = generateMetadata();
    expect(metadata.title).toBe("Archive yours");
    expect(metadata.description).not.toContain("arriving shortly");
    expect(metadata.description).toContain("pay once");
  });
});
