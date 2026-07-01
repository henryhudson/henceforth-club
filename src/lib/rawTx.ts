// Minimal raw-transaction output parser. WhatsOnChain's JSON endpoint truncates
// `scriptPubKey.hex` at ~100,000 hex characters, so a large archive script (a
// whole-profile OP_RETURN is ~500,000) arrives cut off and unparseable. The raw
// hex endpoint serves the full transaction; this walks the wire format and
// returns every output's locking script. Pure — no network.

/** Read a Bitcoin varint at `offset`; returns its value and the bytes consumed. */
function readVarint(bytes: Uint8Array, offset: number): { value: number; size: number } | null {
  if (offset >= bytes.length) return null;
  const first = bytes[offset];
  if (first < 0xfd) return { value: first, size: 1 };
  const width = first === 0xfd ? 2 : first === 0xfe ? 4 : 8;
  if (offset + 1 + width > bytes.length) return null;
  let value = 0;
  for (let i = width - 1; i >= 0; i--) {
    value = value * 256 + bytes[offset + 1 + i];
  }
  return { value, size: 1 + width };
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Every output locking script (hex) of a raw transaction, in vout order.
 * Returns [] for malformed or truncated input rather than throwing.
 */
export function voutScriptsFromRawTx(rawHex: string): string[] {
  const bytes = hexToBytes(rawHex.trim());
  if (!bytes || bytes.length < 10) return [];

  let offset = 4; // version

  const inputCount = readVarint(bytes, offset);
  if (!inputCount) return [];
  offset += inputCount.size;
  for (let i = 0; i < inputCount.value; i++) {
    offset += 36; // prevout txid + index
    const scriptLen = readVarint(bytes, offset);
    if (!scriptLen) return [];
    offset += scriptLen.size + scriptLen.value + 4; // script + sequence
    if (offset > bytes.length) return [];
  }

  const outputCount = readVarint(bytes, offset);
  if (!outputCount) return [];
  offset += outputCount.size;

  const scripts: string[] = [];
  for (let i = 0; i < outputCount.value; i++) {
    offset += 8; // value
    const scriptLen = readVarint(bytes, offset);
    if (!scriptLen) return [];
    offset += scriptLen.size;
    if (offset + scriptLen.value > bytes.length) return [];
    scripts.push(bytesToHex(bytes.subarray(offset, offset + scriptLen.value)));
    offset += scriptLen.value;
  }
  return scripts;
}
