// The inscription: one transaction, the visitor's coin in, their archive and
// the premium out. Custody enters here (the per-job key signs the input) and
// leaves here (the archive is on chain, the premium is at the revenue address,
// nothing is retained). Runs on the Mac mini worker only.
//
// buildInscriptionTx is a value-returning builder: it never throws for the
// underfunded case, it refuses. broadcastArchive mirrors the app's own
// ARCService — GorillaPool first, TAAL as failover — and registerHandle posts
// the finished archive to the site's index on the open, unclaimed path.

import { LockingScript, OP, P2PKH, SatoshisPerKilobyte, Transaction, Utils } from "@bsv/sdk";

// Keep in sync with src/lib/textJob/constants.ts BROADCAST_RETRIES — this .mjs
// worker cannot import the TypeScript constants module at runtime (the same
// reason scripts/board/render-pdf.mjs re-declares its shared constants).
const BROADCAST_RETRIES = 3;

// ARC submit endpoints and the failover order, mirroring
// Henceforth .../Bitcoin/ARC/ARCService.swift: GorillaPool needs no key, TAAL
// needs a Bearer token. Both take the raw hex as a text/plain body and answer
// the same wire shape (txid, txStatus, status).
const GORILLAPOOL_ARC = "https://arc.gorillapool.io/v1";
const TAAL_ARC = "https://arc.taal.com/v1";
const ARC_HEADERS = {
  "Content-Type": "text/plain",
  "X-WaitFor": "SEEN_ON_NETWORK",
  "X-MerkleProof": "true",
};

// The two txStatus strings the app treats as a hard no; anything else at a
// 200/201 with a txid is the network having taken the bytes.
const REJECTED_STATUSES = new Set(["REJECTED", "DOUBLE_SPEND_ATTEMPTED"]);

/**
 * Build the archive inscription transaction: one input (the visitor's funding
 * output at the job's custody address), two outputs — the archive as an
 * OP_RETURN carrying exactly the JSON the showroom reader parses, and the flat
 * premium to the revenue address. No reward output, no change output: the
 * overpayment above price becomes miner fee, so nothing routes back to the
 * ephemeral key.
 *
 * The fee is implicit — input minus outputs, since there is no change to
 * absorb it — so a funding output too small to cover archive plus premium plus
 * the size-based fee cannot build a valid transaction. That is a refusal, not a
 * throw: { ok: false, reason: "underfunded" } routes to broadcast-failed and
 * the sweep, never a malformed broadcast.
 *
 * revenueAddress is a required argument, never read from a constant — the
 * worker owns the one true value and gates on it at startup.
 */
export async function buildInscriptionTx({ jobKey, funding, archiveJson, premiumSats, revenueAddress, feeRate }) {
  const json = typeof archiveJson === "string" ? archiveJson : JSON.stringify(archiveJson);

  const tx = new Transaction();

  // The funding output pays the job's custody address, so its locking script is
  // the P2PKH of the job key. Supplying the amount and locking script directly
  // lets the input sign without fetching the parent transaction — the outpoint
  // (txid, vout) is all that ties it to the real coin on chain.
  const custodyLockingScript = new P2PKH().lock(jobKey.toAddress());
  tx.addInput({
    sourceTXID: funding.txid,
    sourceOutputIndex: funding.vout,
    unlockingScriptTemplate: new P2PKH().unlock(jobKey, "all", false, funding.sats, custodyLockingScript),
    sequence: 0xffffffff,
  });

  const opReturn = new LockingScript()
    .writeOpCode(OP.OP_FALSE)
    .writeOpCode(OP.OP_RETURN)
    .writeBin(Utils.toArray(json, "utf8"));
  tx.addOutput({ lockingScript: opReturn, satoshis: 0 });
  tx.addOutput({ lockingScript: new P2PKH().lock(revenueAddress), satoshis: premiumSats });

  const requiredFee = await new SatoshisPerKilobyte(feeRate).computeFee(tx);
  const availableFee = funding.sats - premiumSats; // no change output — everything left is fee
  if (availableFee < requiredFee) {
    return { ok: false, reason: "underfunded" };
  }

  await tx.sign();
  return { ok: true, hex: tx.toHex(), txid: tx.id("hex") };
}

/** One submit against one ARC provider. `null` is a transport miss (fail over
 * to the next provider); an object reports whether the miner took the bytes. */
async function submitToArc(base, hex, { fetchFn, authToken }) {
  let res;
  try {
    res = await fetchFn(`${base}/tx`, {
      method: "POST",
      headers: authToken ? { ...ARC_HEADERS, Authorization: authToken } : ARC_HEADERS,
      body: hex,
    });
  } catch {
    return null; // could not reach this provider — mirror the app failing over
  }

  let body;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  const txStatus = typeof body.txStatus === "string" ? body.txStatus : "";
  const statusCode = typeof body.status === "number" ? body.status : res.status;
  const rejected = REJECTED_STATUSES.has(txStatus) || statusCode >= 460;
  const accepted =
    (res.status === 200 || res.status === 201) && !rejected && typeof body.txid === "string" && body.txid.length > 0;

  if (accepted) return { accepted: true, txid: body.txid };
  return { accepted: false, reason: body.extraInfo || body.title || txStatus || `http ${res.status}` };
}

/**
 * Broadcast the signed inscription through ARC with GorillaPool -> TAAL
 * failover, retried up to BROADCAST_RETRIES times. TAAL is attempted only when
 * a key is configured, exactly as the app skips it without one. Returns the
 * accepted txid, or a reasoned refusal after the budget is spent — the caller
 * routes that refusal to broadcast-failed, never a false success.
 */
export async function broadcastArchive(hex, { fetchFn = fetch, taalApiKey = process.env.XTEXT_TAAL_API_KEY, retries = BROADCAST_RETRIES } = {}) {
  let lastReason = "broadcast not attempted";

  for (let attempt = 0; attempt < retries; attempt++) {
    const gorillaPool = await submitToArc(GORILLAPOOL_ARC, hex, { fetchFn });
    if (gorillaPool?.accepted) return { ok: true, txid: gorillaPool.txid };
    if (gorillaPool) lastReason = `gorillapool: ${gorillaPool.reason}`;

    if (taalApiKey) {
      const authToken = taalApiKey.startsWith("Bearer ") ? taalApiKey : `Bearer ${taalApiKey}`;
      const taal = await submitToArc(TAAL_ARC, hex, { fetchFn, authToken });
      if (taal?.accepted) return { ok: true, txid: taal.txid };
      if (taal) lastReason = `taal: ${taal.reason}`;
    }
  }

  return { ok: false, reason: lastReason };
}

/**
 * Index the finished archive against its handle on the site's open, unclaimed
 * path — { handle, txid }, no signature fields. Success is 200. A claimed-handle
 * 403 is also success: the inscription exists and the job did everything it
 * promised the visitor; the archive simply stays off the owner's canonical
 * index (the quote page warned before payment). Every other outcome — the tx
 * not yet visible to WhatsOnChain, the index briefly unavailable, a network
 * miss — is a not-done that retries next tick, and registration is idempotent
 * server-side, so a retry after a real success is harmless.
 */
export async function registerHandle({ handle, txid, baseUrl, fetchFn = fetch }) {
  let res;
  try {
    res = await fetchFn(`${baseUrl}/api/x/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, txid }),
    });
  } catch {
    return { ok: false, reason: "register-unreachable" };
  }

  if (res.status === 200) return { ok: true };

  if (res.status === 403) {
    let body;
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    if (body.reason === "handle-claimed") return { ok: true };
    return { ok: false, reason: body.reason ?? "register-forbidden" };
  }

  return { ok: false, reason: `register-http-${res.status}` };
}
