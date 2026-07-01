import { describe, it, expect } from "vitest";
import { selectRefs, downloadItems } from "./xArchive";

const refs = [
  { postId: "p1", contentType: "image/jpeg", url: "https://pbs/x.jpg" },
  { postId: "p2", contentType: "video/mp4",  url: "https://vid/x.mp4" },
];

describe("selectRefs", () => {
  it("filters by layer toggle", () => {
    expect(selectRefs(refs, true,  false).map((r) => r.postId)).toEqual(["p1"]);
    expect(selectRefs(refs, false, true ).map((r) => r.postId)).toEqual(["p2"]);
    expect(selectRefs(refs, true,  true ).length).toBe(2);
    expect(selectRefs(refs, false, false).length).toBe(0);
  });
});

describe("downloadItems", () => {
  it("downloads bytes and returns base64 items keyed by post", async () => {
    const fakeFetch = async () =>
      ({ ok: true, headers: new Headers({ "content-type": "image/jpeg" }),
         arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }) as unknown as Response;
    const items = await downloadItems([refs[0]], fakeFetch as unknown as typeof fetch);
    expect(items).toEqual([{ postId: "p1", contentType: "image/jpeg", base64: Buffer.from([1, 2, 3]).toString("base64") }]);
  });
  it("skips a ref whose download fails, without throwing", async () => {
    const failing = async () => ({ ok: false, status: 404 }) as unknown as Response;
    expect(await downloadItems([refs[0]], failing as unknown as typeof fetch)).toEqual([]);
  });
  it("keeps surviving refs when one fetch throws, without rejecting the batch", async () => {
    const flaky = async (url: string | URL | Request) => {
      if (url === refs[0].url) throw new Error("network reset");
      return {
        ok: true,
        headers: new Headers({ "content-type": "video/mp4" }),
        arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
      } as unknown as Response;
    };
    const items = await downloadItems(refs, flaky as unknown as typeof fetch);
    expect(items).toEqual([
      { postId: "p2", contentType: "video/mp4", base64: Buffer.from([4, 5, 6]).toString("base64") },
    ]);
  });
});
