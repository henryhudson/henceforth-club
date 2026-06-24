import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchTxArchive } from "@/lib/whatsonchain";

function opReturnScript(...datas: string[]): string {
  let s = "006a";
  for (const d of datas) {
    const bytes = Buffer.from(d, "utf8");
    const n = bytes.length;
    if (n < 0x4c) s += n.toString(16).padStart(2, "0");
    else if (n <= 0xff) s += "4c" + n.toString(16).padStart(2, "0");
    else
      s +=
        "4d" +
        (n & 0xff).toString(16).padStart(2, "0") +
        ((n >> 8) & 0xff).toString(16).padStart(2, "0");
    s += bytes.toString("hex");
  }
  return s;
}

const archiveJSON = JSON.stringify({
  source: "x",
  handle: "henry",
  profile: { displayName: "Henry" },
  posts: [{ id: "1", at: "t", text: "hi" }],
});

afterEach(() => vi.restoreAllMocks());

describe("fetchTxArchive", () => {
  it("extracts the archive from a WhatsOnChain tx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              vout: [
                { scriptPubKey: { hex: "76a914aaaaaaaaaaaaaaaaaaaa88ac" } },
                {
                  scriptPubKey: {
                    hex: opReturnScript(
                      "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut",
                      archiveJSON,
                    ),
                  },
                },
              ],
            }),
            { status: 200 },
          ),
      ),
    );
    const sa = await fetchTxArchive("a".repeat(64));
    expect(sa?.handle).toBe("henry");
    expect(sa?.posts).toHaveLength(1);
  });

  it("rejects an invalid txid without calling the network", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await fetchTxArchive("not-a-txid")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("returns null on a non-OK response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    expect(await fetchTxArchive("b".repeat(64))).toBeNull();
  });
});
