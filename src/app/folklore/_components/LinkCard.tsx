import Link from "next/link";
import { txExplorerUrl } from "@/lib/explorer";
import type { FolkloreLink } from "../linkRecord";
import { shortTxid } from "./PostCard";

/**
 * One link entry on the unified folklore board — the DirectoryRow's sibling.
 * Title anchors to the url itself; the detail line carries the domain, the
 * submitter when a bound handle claimed the post, the kudos total, and the
 * comment count linking through to the thread; the txid links out to the
 * block explorer.
 */
export default function LinkCard({
  txid,
  record,
  kudos,
  comments,
}: {
  txid: string;
  record: FolkloreLink;
  kudos: number;
  comments: number;
}) {
  const domain = new URL(record.url).hostname;
  return (
    <div className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-card-bg">
      <span
        aria-hidden
        className="font-mono text-sm text-card-border-hover transition-colors group-hover:text-accent"
      >
        ↗
      </span>
      <div className="min-w-0 flex-1">
        <a href={record.url} target="_blank" rel="noopener noreferrer">
          <p className="truncate font-semibold text-foreground transition-colors group-hover:text-accent">
            {record.title}
          </p>
        </a>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          {domain}
          {record.by && ` · by @${record.by}`}
          {` · ${kudos.toLocaleString("en-GB")} kudos · `}
          <Link
            href={`/folklore/tx/${txid}`}
            className="transition-colors hover:text-accent hover:underline"
          >
            {comments.toLocaleString("en-GB")} comment{comments === 1 ? "" : "s"}
          </Link>
        </p>
      </div>
      <a
        href={txExplorerUrl(txid)}
        target="_blank"
        rel="noopener noreferrer"
        title="This link's inscription on a block explorer"
        className="shrink-0 font-mono text-[11px] text-muted transition-colors hover:text-accent hover:underline"
      >
        {shortTxid(txid)} ↗
      </a>
    </div>
  );
}
