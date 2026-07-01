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

// Wrap output scripts in a minimal raw transaction (version 1, one null input,
// locktime 0) — fetchTxArchive reads the RAW hex endpoint, not the JSON one,
// because WhatsOnChain truncates large scripts in JSON responses.
function rawTx(outputScriptsHex: string[]): string {
  const varint = (n: number): string =>
    n < 0xfd
      ? n.toString(16).padStart(2, "0")
      : "fd" +
        (n & 0xff).toString(16).padStart(2, "0") +
        ((n >> 8) & 0xff).toString(16).padStart(2, "0");
  const input = "00".repeat(32) + "ffffffff" + "00" + "ffffffff";
  const outputs = outputScriptsHex
    .map((s) => "0100000000000000" + varint(s.length / 2) + s)
    .join("");
  return "01000000" + "01" + input + varint(outputScriptsHex.length) + outputs + "00000000";
}

afterEach(() => vi.restoreAllMocks());

describe("fetchTxArchive", () => {
  it("extracts the archive from a WhatsOnChain raw transaction", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            rawTx([
              "76a914aaaaaaaaaaaaaaaaaaaa88ac",
              opReturnScript("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", archiveJSON),
            ]),
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
