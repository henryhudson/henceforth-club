import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchTxArchive, fetchTxArchiveWithTime, txFeeSatsFromJson } from "@/lib/whatsonchain";

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

  it("accepts an injected fetch instead of relying on the global one", async () => {
    const injected = vi.fn(
      async () =>
        new Response(
          rawTx([opReturnScript("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", archiveJSON)]),
          { status: 200 },
        ),
    );
    const globalFetch = vi.fn();
    vi.stubGlobal("fetch", globalFetch);
    const sa = await fetchTxArchive("c".repeat(64), injected);
    expect(sa?.handle).toBe("henry");
    expect(injected).toHaveBeenCalledTimes(1);
    expect(globalFetch).not.toHaveBeenCalled();
  });
});

// A stand-in for the two WhatsOnChain endpoints fetchTxArchiveWithTime hits:
// the raw-hex endpoint (for the archive) and the JSON tx endpoint (for the
// confirmation time, which a raw transaction never carries itself).
function fetchStub({
  rawHex,
  txJson,
}: {
  rawHex?: string;
  txJson?: Record<string, unknown> | null;
}) {
  // Typed as the real fetch so mock.calls carries its full signature — the
  // abort-signal assertion reads the request options off the second element.
  const impl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/hex")) {
      return rawHex === undefined
        ? new Response("nope", { status: 404 })
        : new Response(rawHex, { status: 200 });
    }
    return txJson === null || txJson === undefined
      ? new Response("nope", { status: 404 })
      : new Response(JSON.stringify(txJson), { status: 200 });
  };
  return vi.fn(impl);
}

describe("fetchTxArchiveWithTime", () => {
  it("returns the archive together with its confirmed time", async () => {
    const fetchFn = fetchStub({
      rawHex: rawTx([opReturnScript("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", archiveJSON)]),
      txJson: { time: 1751328000, blocktime: 1751328000 },
    });
    const result = await fetchTxArchiveWithTime("d".repeat(64), fetchFn);
    expect(result?.archive.handle).toBe("henry");
    expect(result?.time).toBe(1751328000);
  });

  it("treats an unconfirmed transaction (no time or blocktime) as an unknown time", async () => {
    const fetchFn = fetchStub({
      rawHex: rawTx([opReturnScript("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", archiveJSON)]),
      txJson: { confirmations: 0 },
    });
    const result = await fetchTxArchiveWithTime("e".repeat(64), fetchFn);
    expect(result?.archive.handle).toBe("henry");
    expect(result?.time).toBeUndefined();
  });

  it("still returns the archive when the time lookup itself fails", async () => {
    const fetchFn = fetchStub({
      rawHex: rawTx([opReturnScript("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", archiveJSON)]),
      txJson: null,
    });
    const result = await fetchTxArchiveWithTime("f".repeat(64), fetchFn);
    expect(result?.archive.handle).toBe("henry");
    expect(result?.time).toBeUndefined();
  });

  it("returns null, without a time lookup, when the archive itself can't be found", async () => {
    const fetchFn = fetchStub({ txJson: { time: 1751328000 } });
    expect(await fetchTxArchiveWithTime("a".repeat(64), fetchFn)).toBeNull();
    expect(fetchFn).toHaveBeenCalledTimes(1); // only the hex attempt, never the time lookup
  });

  it("skips the time lookup entirely when includeTime is false, doing only the archive fetch", async () => {
    const fetchFn = fetchStub({
      rawHex: rawTx([opReturnScript("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", archiveJSON)]),
      txJson: { time: 1751328000 },
    });
    const result = await fetchTxArchiveWithTime("1".repeat(64), fetchFn, false);
    expect(result?.archive.handle).toBe("henry");
    expect(result?.time).toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(1); // only the hex fetch — no round trip for a time nobody will cache
  });

  it("bounds the time lookup with an abort signal, so a hung endpoint can't stall the caller", async () => {
    const fetchFn = fetchStub({
      rawHex: rawTx([opReturnScript("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", archiveJSON)]),
      txJson: { time: 1751328000 },
    });
    await fetchTxArchiveWithTime("2".repeat(64), fetchFn);
    const timeCall = fetchFn.mock.calls.find(([input]) => String(input).includes("/tx/hash/"));
    expect(timeCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("still returns the archive when the time lookup is aborted (as a real timeout would)", async () => {
    const hex = rawTx([opReturnScript("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", archiveJSON)]);
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/hex")) return new Response(hex, { status: 200 });
      throw new DOMException("The operation was aborted.", "AbortError");
    });
    const result = await fetchTxArchiveWithTime("3".repeat(64), fetchFn);
    expect(result?.archive.handle).toBe("henry");
    expect(result?.time).toBeUndefined();
  });
});

describe("txFeeSatsFromJson", () => {
  it("computes the miner fee as inputs minus outputs (in sats)", () => {
    const tx = { vin: [{ value: 0.001 }, { value: 0.0005 }], vout: [{ value: 0.00149 }] };
    expect(txFeeSatsFromJson(tx)).toBe(1000); // 0.0015 - 0.00149 BSV = 1000 sats
  });

  it("returns null when an input lacks a value (fail-open)", () => {
    expect(txFeeSatsFromJson({ vin: [{}], vout: [{ value: 0.001 }] })).toBeNull();
  });
});
