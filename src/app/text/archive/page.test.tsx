import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ArchivePage from "./page";

describe("ArchivePage — the mechanical gate", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders only the stub when the flag is unset", () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", undefined);
    const html = renderToStaticMarkup(<ArchivePage />);
    expect(html).toContain("Archive yours");
    expect(html).toContain("arrives shortly");
    expect(html).not.toContain("Drop your");
    expect(html).not.toContain("Bitcoin is forever");
  });

  it("renders only the stub for any value other than the exact string true", () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", "1");
    const html = renderToStaticMarkup(<ArchivePage />);
    expect(html).toContain("arrives shortly");
    expect(html).not.toContain("Drop your");
  });

  it("renders the real flow once the flag is exactly \"true\"", () => {
    vi.stubEnv("XTEXT_WEB_ARCHIVE_ENABLED", "true");
    const html = renderToStaticMarkup(<ArchivePage />);
    expect(html).not.toContain("arrives shortly");
    expect(html).toContain("Drop your");
    expect(html).toContain("Pay to inscribe your export");
  });
});
