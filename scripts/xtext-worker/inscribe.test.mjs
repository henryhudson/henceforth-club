import { describe, expect, it, vi } from "vitest";
import { P2PKH, PrivateKey, Transaction } from "@bsv/sdk";
import { socialArchiveFromScripts } from "@/app/folklore/onchain";
import { voutScriptsFromRawTx } from "@/lib/rawTx";
import { broadcastArchive, buildInscriptionTx, registerHandle } from "./inscribe.mjs";

// One realistic text archive — the very shape parseExport produces and the
// showroom reader parses. The load-bearing test round-trips it through a built
// transaction and back out of the site's own on-chain reader.
const archive = {
  v: 1,
  source: "x",
  handle: "henry",
  profile: { displayName: "Henry H", bio: "builder" },
  posts: [
    { id: "1", at: "2020-01-01", text: "hello world" },
    { id: "2", at: "2020-01-02", text: "second post", replyToId: "1" },
  ],
};

const jobKey = PrivateKey.fromRandom();
const revenueAddress = PrivateKey.fromRandom().toAddress();
const funding = { txid: "44".repeat(32), vout: 0, sats: 1_000_000 };
const premiumSats = 5_000;
const feeRate = 100;

describe("buildInscriptionTx", () => {
  it("the built transaction parses back as the archive through the site's own reader", async () => {
    const built = await buildInscriptionTx({ jobKey, funding, archiveJson: archive, premiumSats, revenueAddress, feeRate });
    expect(built.ok).toBe(true);

    // Feed the hex through exactly the composition fetchTxArchive uses after
    // fetching: raw-tx output scripts -> socialArchiveFromScripts.
    const parsed = socialArchiveFromScripts(voutScriptsFromRawTx(built.hex));
    expect(parsed).not.toBeNull();
    expect(parsed.handle).toBe("henry");
    expect(parsed.posts).toHaveLength(2);
    expect(parsed.posts.map((p) => p.id)).toEqual(["1", "2"]);
    expect(parsed.posts.map((p) => p.text)).toEqual(["hello world", "second post"]);
    expect(parsed.posts[1].replyToId).toBe("1");
  });

  it("the premium output pays the revenue address exactly premiumSats — no reward, no change", async () => {
    const built = await buildInscriptionTx({ jobKey, funding, archiveJson: archive, premiumSats, revenueAddress, feeRate });
    expect(built.ok).toBe(true);

    const tx = Transaction.fromHex(built.hex);
    expect(tx.outputs).toHaveLength(2); // archive OP_RETURN + the premium; nothing else

    const archiveOut = tx.outputs[0];
    expect(archiveOut.satoshis).toBe(0);
    expect(archiveOut.lockingScript.toHex().startsWith("006a")).toBe(true); // OP_FALSE OP_RETURN

    const premiumOut = tx.outputs[1];
    expect(premiumOut.satoshis).toBe(premiumSats);
    expect(premiumOut.lockingScript.toHex()).toBe(new P2PKH().lock(revenueAddress).toHex());

    // No output pays back to the custody key — there is no change output.
    const custodyScript = new P2PKH().lock(jobKey.toAddress()).toHex();
    expect(tx.outputs.some((o) => o.lockingScript.toHex() === custodyScript)).toBe(false);
  });

  it("fees are covered: input minus outputs is at least size times feeRate", async () => {
    const built = await buildInscriptionTx({ jobKey, funding, archiveJson: archive, premiumSats, revenueAddress, feeRate });
    expect(built.ok).toBe(true);

    const sizeBytes = built.hex.length / 2;
    const spentOnOutputs = premiumSats; // archive output is 0 satoshis
    const impliedFee = funding.sats - spentOnOutputs; // input minus outputs, no change
    expect(impliedFee).toBeGreaterThanOrEqual(Math.ceil((sizeBytes * feeRate) / 1000));
  });

  it("a funding output below fee plus premium refuses to build (errors as values)", async () => {
    const built = await buildInscriptionTx({
      jobKey,
      funding: { txid: "44".repeat(32), vout: 0, sats: 300 }, // less than the premium alone
      archiveJson: archive,
      premiumSats: 5_000,
      revenueAddress,
      feeRate,
    });
    expect(built.ok).toBe(false);
    expect(built.reason).toBe("underfunded");
  });
});

describe("buildInscriptionTx — the £2 kudos float leg", () => {
  const floatPoolAddress = PrivateKey.fromRandom().toAddress();
  const floatSats = 18_000;

  it("pays the float pool exactly floatSats alongside the premium when both legs exist", async () => {
    const built = await buildInscriptionTx({
      jobKey,
      funding,
      archiveJson: archive,
      premiumSats,
      revenueAddress,
      floatSats,
      floatPoolAddress,
      feeRate,
    });
    expect(built.ok).toBe(true);

    const tx = Transaction.fromHex(built.hex);
    expect(tx.outputs).toHaveLength(3); // archive OP_RETURN + premium-to-cold + the float leg

    expect(tx.outputs[1].satoshis).toBe(premiumSats);
    expect(tx.outputs[1].lockingScript.toHex()).toBe(new P2PKH().lock(revenueAddress).toHex());
    expect(tx.outputs[2].satoshis).toBe(floatSats);
    expect(tx.outputs[2].lockingScript.toHex()).toBe(new P2PKH().lock(floatPoolAddress).toHex());
  });

  it("a zero premium adds no premium output — the £2-era shape is archive plus float leg only", async () => {
    const built = await buildInscriptionTx({
      jobKey,
      funding,
      archiveJson: archive,
      premiumSats: 0,
      revenueAddress,
      floatSats,
      floatPoolAddress,
      feeRate,
    });
    expect(built.ok).toBe(true);

    const tx = Transaction.fromHex(built.hex);
    expect(tx.outputs).toHaveLength(2);
    expect(tx.outputs[1].satoshis).toBe(floatSats);
    expect(tx.outputs[1].lockingScript.toHex()).toBe(new P2PKH().lock(floatPoolAddress).toHex());
  });

  it("fees stay covered with the float leg counted among the outputs", async () => {
    const built = await buildInscriptionTx({
      jobKey,
      funding,
      archiveJson: archive,
      premiumSats: 0,
      revenueAddress,
      floatSats,
      floatPoolAddress,
      feeRate,
    });
    expect(built.ok).toBe(true);

    const sizeBytes = built.hex.length / 2;
    const impliedFee = funding.sats - floatSats; // archive output is 0 satoshis, no premium, no change
    expect(impliedFee).toBeGreaterThanOrEqual(Math.ceil((sizeBytes * feeRate) / 1000));
  });

  it("a funding output below fee plus float leg refuses to build", async () => {
    const built = await buildInscriptionTx({
      jobKey,
      funding: { txid: "44".repeat(32), vout: 0, sats: floatSats + 10 }, // float leg but not the fee
      archiveJson: archive,
      premiumSats: 0,
      revenueAddress,
      floatSats,
      floatPoolAddress,
      feeRate,
    });
    expect(built.ok).toBe(false);
    expect(built.reason).toBe("underfunded");
  });

  it("a float leg with no float pool address refuses — money never broadcasts to nowhere", async () => {
    const built = await buildInscriptionTx({
      jobKey,
      funding,
      archiveJson: archive,
      premiumSats: 0,
      revenueAddress,
      floatSats,
      feeRate,
    });
    expect(built.ok).toBe(false);
    expect(built.reason).toBe("float-pool-unconfigured");
  });
});

// A minimal ARC accept response, mirroring the wire shape ARCService reads.
const arcAccept = (txid) => ({
  ok: true,
  status: 200,
  json: async () => ({ txid, txStatus: "SEEN_ON_NETWORK", status: 200 }),
});
const arcReject = (reason) => ({
  ok: true,
  status: 200,
  json: async () => ({ txid: "", txStatus: "REJECTED", extraInfo: reason, status: 462 }),
});

describe("broadcastArchive", () => {
  it("returns the txid when GorillaPool accepts on the first try", async () => {
    const fetchFn = vi.fn(async () => arcAccept("ab".repeat(32)));
    const result = await broadcastArchive("deadbeef", { fetchFn, retries: 3 });
    expect(result).toEqual({ ok: true, txid: "ab".repeat(32) });
    expect(fetchFn).toHaveBeenCalledWith("https://arc.gorillapool.io/v1/tx", expect.objectContaining({ method: "POST" }));
  });

  it("fails over from GorillaPool to TAAL when a key is configured", async () => {
    const fetchFn = vi.fn(async (url) =>
      url.includes("taal") ? arcAccept("cd".repeat(32)) : arcReject("gorilla down"),
    );
    const result = await broadcastArchive("deadbeef", { fetchFn, taalApiKey: "test-key", retries: 1 });
    expect(result).toEqual({ ok: true, txid: "cd".repeat(32) });
  });

  it("gives up after the retry budget when every attempt is rejected", async () => {
    const fetchFn = vi.fn(async () => arcReject("nope"));
    const result = await broadcastArchive("deadbeef", { fetchFn, retries: 3 });
    expect(result.ok).toBe(false);
    // three attempts against GorillaPool (no TAAL key), no more
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});

describe("registerHandle", () => {
  const base = "https://www.henceforth.club";

  it("a 200 registers the handle", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    expect(await registerHandle({ handle: "henry", txid: "ab".repeat(32), baseUrl: base, fetchFn })).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://www.henceforth.club/api/x/register",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ handle: "henry", txid: "ab".repeat(32) }) }),
    );
  });

  it("a claimed-handle 403 still counts as done — the archive inscribed, it just stays off the owner's index", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ ok: false, reason: "handle-claimed" }) }));
    expect(await registerHandle({ handle: "henry", txid: "ab".repeat(32), baseUrl: base, fetchFn })).toEqual({ ok: true });
  });

  it("a transient failure is not done — it retries next tick", async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 422, json: async () => ({ ok: false, reason: "no-archive-in-tx" }) }));
    const result = await registerHandle({ handle: "henry", txid: "ab".repeat(32), baseUrl: base, fetchFn });
    expect(result.ok).toBe(false);
  });
});
