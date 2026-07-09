import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProfileView from "./ProfileView";
import type { XArchive } from "../parseArchive";

const archive: XArchive = {
  profile: { handle: "henryhudson6", displayName: "Henry" },
  posts: [{ id: "1", at: "2012-09-02T00:00:00Z", text: "gm" }],
};

describe("ProfileView verified tick", () => {
  it("shows the tick and links the binding tweet when verified", () => {
    const html = renderToStaticMarkup(
      <ProfileView
        archive={archive}
        isPreview={false}
        verified={{ bindingPostId: "1789012345678901234" }}
      />,
    );
    expect(html).toContain("Verified");
    expect(html).toContain("x.com/henryhudson6/status/1789");
  });

  it("shows no tick without an owner record", () => {
    const html = renderToStaticMarkup(<ProfileView archive={archive} isPreview={false} />);
    expect(html).not.toContain("Verified");
  });
});
