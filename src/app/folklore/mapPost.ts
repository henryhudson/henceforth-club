import { extractPushdata } from "./onchain";
import type { XPost } from "./parseArchive";

/** BitCom Magic Attribute Protocol prefix (address-as-protocol-id). */
export const MAP_PREFIX = "1PuQa7K62MiKCtssSLKy1kh56WWU7MtUR5";
/** BitCom B protocol prefix. */
export const B_PREFIX = "19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut";

const utf8 = new TextDecoder("utf-8", { fatal: false });

function asText(chunk: Uint8Array): string {
  return utf8.decode(chunk);
}

/**
 * A Bitcoin Schema `type=post` in script pushdata, or null.
 * `post.id` / `post.txid` are the given transaction id. Source is MAP `app`.
 */
export function mapPostFromScripts(
  scriptHexes: string[],
  txid: string,
): { post: XPost; source: string } | null {
  const chunks = scriptHexes.flatMap(extractPushdata);
  const texts = chunks.map(asText);
  const mapAt = texts.indexOf(MAP_PREFIX);
  if (mapAt === -1) return null;
  const after = texts.slice(mapAt + 1);
  if (after[0] !== "SET") return null;
  const fields: Record<string, string> = {};
  for (let i = 1; i + 1 < after.length; i += 2) {
    if (after[i] === "|" || after[i] === MAP_PREFIX || after[i] === B_PREFIX) break;
    fields[after[i]] = after[i + 1] ?? "";
  }
  if (fields.type !== "post") return null;
  const bAt = texts.indexOf(B_PREFIX);
  const bText = bAt !== -1 && chunks[bAt + 1] ? asText(chunks[bAt + 1]) : "";
  const text = bText || fields.content || fields.text || "";
  const source = fields.app?.trim() || "folklore";
  return {
    source,
    post: {
      id: txid,
      at: "",
      text,
      txid,
    },
  };
}
