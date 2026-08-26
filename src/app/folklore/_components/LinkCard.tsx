import Link from "next/link";
import { txExplorerUrl } from "@/lib/explorer";
import type { FolkloreLink } from "../linkRecord";
import FeedKudos from "./FeedKudos";
import { shortTxid } from "./PostCard";

/**
 * One link entry on the unified folklore board — the DirectoryRow's sibling.
 * Title anchors to the url itself; the detail line carries the domain, the
 * submitter when a bound handle claimed the post, the kudos total, and the
 * comment count linking through to the thread; the txid links out to the
 * block explorer.
 *
 * The kudos total is the CONTROL when the link has a bound submitter: the tip
 * route pays a link's kudos to its verified `by` and bumps the link's own
 * board card (recordTip → isBoardLink → linkMember), so the count and the
 * gesture are one element. An anonymous link names no earner — the route
 * refuses it by design, because debiting a giver with nothing to accrue
 * against would break the float's conservation invariant — so it keeps the
 * static total rather than offering a control that must always refuse.
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
  const target = record.txid ?? txid;
  const href = record.url ?? `/folklore/tx/${target}`;
  const detail = record.url ? new URL(record.url).hostname : shortTxid(target);
  const external = Boolean(record.url);
  return (
    <div className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-card-bg">
      <span
        aria-hidden
        className="font-mono text-sm text-card-border-hover transition-colors group-hover:text-accent"
      >
        ↗
      </span>
      <div className="min-w-0 flex-1">
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <p className="truncate font-semibold text-foreground transition-colors group-hover:text-accent">
            {record.title}
          </p>
        </a>
        <p className="mt-0.5 font-mono text-[11px] text-muted">
          {detail}
          {record.by && ` · by @${record.by}`}
          {" · "}
          {record.by ? (
            <FeedKudos handle={record.by} postId={txid} count={kudos} />
          ) : (
            `${kudos.toLocaleString("en-GB")} kudos`
          )}
          {" · "}
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
