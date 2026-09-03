import { recordFromScripts, type FolkloreLink } from "../linkRecord";
import { mapPostFromScripts } from "../mapPost";
import { socialArchiveFromScripts, type SocialArchive } from "../onchain";
import type { XPost } from "../parseArchive";
import { shortTxid } from "../shortTxid";

export type TxClass =
  | { kind: "comment"; parent: string }
  | { kind: "stamp"; target: string }
  | { kind: "map"; post: XPost; source: string }
  | { kind: "archive"; archive: SocialArchive }
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
  // Carried, not re-derived: the page renders the archive this parse found
  // rather than fetching and parsing the whole blob a second time.
  const social = socialArchiveFromScripts(scripts);
  if (social) return { kind: "archive", archive: social };
  if (rec?.kind === "link" && rec.url) return { kind: "legacy-link", record: rec };
  return { kind: "opaque" };
}

/** The source chip's label — the same words on the reader and on the submit
 *  preview, so one app string never reads two ways. */
export function sourceLabel(source: string): string {
  if (source === "twetch") return "Twetch";
  if (source === "treechat") return "Treechat";
  if (source === "x") return "X";
  if (source === "folklore") return "Folklore";
  return source;
}

/** The page's title, from the same classification the body renders from —
 *  so the tab, the bookmark and the search result never name a different
 *  feature than the page. */
export function titleFor(classified: TxClass, txid: string): string {
  switch (classified.kind) {
    case "legacy-link":
      return classified.record.title;
    case "map":
      return classified.post.text.trim() || shortTxid(txid);
    case "archive":
      return `Archived profile — ${shortTxid(txid)}`;
    case "opaque":
      return shortTxid(txid);
    case "comment":
      return `A comment under ${shortTxid(classified.parent)}`;
    case "stamp":
      return `A stamp of ${shortTxid(classified.target)}`;
  }
}
