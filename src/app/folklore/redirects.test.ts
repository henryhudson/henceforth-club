import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("the redirects onto /folklore", () => {
  it("sends both former names, and their subpaths, to /folklore permanently", async () => {
    const list = await nextConfig.redirects?.();
    expect(list).toEqual(
      expect.arrayContaining([
        { source: "/x", destination: "/folklore", permanent: true },
        { source: "/x/:path*", destination: "/folklore/:path*", permanent: true },
        { source: "/text", destination: "/folklore", permanent: true },
        { source: "/text/:path*", destination: "/folklore/:path*", permanent: true },
      ]),
    );
  });

  it("never chains one redirect into another", async () => {
    const list = (await nextConfig.redirects?.()) ?? [];
    const sources = new Set(list.map((r) => r.source.replace("/:path*", "")));
    for (const { destination } of list) {
      expect(sources).not.toContain(destination.replace("/:path*", ""));
    }
  });
});
