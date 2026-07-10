import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("the /x to /text redirects", () => {
  it("sends /x and /x/:path* to /text, permanently", async () => {
    const list = await nextConfig.redirects?.();
    expect(list).toEqual(
      expect.arrayContaining([
        { source: "/x", destination: "/text", permanent: true },
        { source: "/x/:path*", destination: "/text/:path*", permanent: true },
      ]),
    );
  });
});
