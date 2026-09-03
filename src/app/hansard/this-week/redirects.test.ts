import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config";

describe("the redirect onto /hansard/this-week", () => {
  it("sends the retired /this-week index to the living archive permanently", async () => {
    const list = await nextConfig.redirects?.();
    expect(list).toContainEqual({
      source: "/this-week",
      destination: "/hansard/this-week",
      permanent: true,
    });
  });

  it("leaves the weekly sheets at /this-week/<week>.pdf alone — they are the Hansard app's addresses", async () => {
    const list = (await nextConfig.redirects?.()) ?? [];
    expect(list.filter((r) => r.source.startsWith("/this-week/"))).toEqual([]);
  });
});
