import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileView from "./ProfileView";
import fixture from "../fixtures/witness.json";
import type { XArchive } from "../parseArchive";

const archive = fixture as XArchive;

describe("ProfileView", () => {
  it("renders a chain-read archive without the words 'live preview'", () => {
    const html = renderToStaticMarkup(<ProfileView archive={archive} isPreview={false} />);
    expect(html).not.toContain("live preview");
    expect(html).toMatchSnapshot();
  });

  it("renders a dropped export WITH 'live preview', because it is not inscribed", () => {
    const html = renderToStaticMarkup(<ProfileView archive={archive} isPreview />);
    expect(html).toContain("live preview");
  });
});
