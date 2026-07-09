import { BSM, PublicKey, Signature, Utils } from "@bsv/sdk";

/**
 * The cryptographic core of the handle-to-key binding. Pure: no I/O, no Redis,
 * no network. The site holds no private key — every input here is public (the
 * committed address, the public key, the signature), and the whole file's job is
 * to answer one question honestly: did the key the account committed to sign this?
 */

/** The exact line an account posts on X to commit to its identity address. */
const BINDING_PREFIX = "Verifying my Henceforth identity:";

/** A Base58 P2PKH address is 26–35 characters of the Bitcoin Base58 alphabet. */
const ADDRESS = /\b([13][1-9A-HJ-NP-Za-km-z]{25,34})\b/;

/**
 * The first address an account committed to, scanning its archived posts for the
 * exact binding line. Returns null if no post carries it — the common case, since
 * most handles never bind.
 */
export function parseBindingAddress(posts: { text: string }[]): string | null {
  for (const { text } of posts) {
    const at = text.indexOf(BINDING_PREFIX);
    if (at === -1) continue;
    const match = ADDRESS.exec(text.slice(at + BINDING_PREFIX.length));
    if (match) return match[1];
  }
  return null;
}

/**
 * The message a claimant signs. Lowercasing the handle matches how the index keys
 * it; including the txid stops a signature being replayed onto another archive.
 */
export function registrationMessage(handle: string, txid: string): string {
  return `henceforth-x-register:${handle.toLowerCase()}:${txid}`;
}

/**
 * True only if `signatureBase64` is a Bitcoin Signed Message over `message` by a
 * key whose address is `committedAddress`. The address check comes first on
 * purpose: a signature valid for some key proves nothing unless that key is the
 * one the account publicly committed to.
 */
export function verifyClaim(input: {
  message: string;
  signatureBase64: string;
  pubkeyHex: string;
  committedAddress: string;
}): boolean {
  try {
    const pub = PublicKey.fromString(input.pubkeyHex);
    if (pub.toAddress() !== input.committedAddress) return false;
    const sig = Signature.fromCompact(Utils.toArray(input.signatureBase64, "base64"));
    return BSM.verify(Utils.toArray(input.message, "utf8"), sig, pub);
  } catch {
    // Malformed public key or signature is a rejection, not a crash.
    return false;
  }
}
