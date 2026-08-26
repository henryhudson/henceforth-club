import { recordFromScripts, type FolkloreLink } from "../linkRecord";
import { mapPostFromScripts } from "../mapPost";
import { socialArchiveFromScripts } from "../onchain";
import type { XPost } from "../parseArchive";

export type TxClass =
  | { kind: "comment"; parent: string }
  | { kind: "stamp"; target: string }
  | { kind: "map"; post: XPost; source: string }
  | { kind: "archive" }
  | { kind: "legacy-link"; record: FolkloreLink }
  | { kind: "opaque" };

export function classifyTx(scripts: string[], txid: string): TxClass {
  const rec = recordFromScripts(scripts);
  if (rec?.kind === "comment") return { kind: "comment", parent: rec.parent };
  if (rec?.kind === "link" && rec.txid && rec.txid !== txid) {
    return { kind: "stamp", target: rec.txid };
  }
  const mapped = mapPostFromScripts(scripts, txid);
  if (mapped) return { kind: "map", post: mapped.post, source: mapped.source };
  if (socialArchiveFromScripts(scripts)) return { kind: "archive" };
  if (rec?.kind === "link" && rec.url) return { kind: "legacy-link", record: rec };
  return { kind: "opaque" };
}
