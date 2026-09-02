import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { socialArchiveToXArchive } from "../../onchain";
import { recordFromScripts, type FolkloreLink } from "../../linkRecord";
import { assembleThread } from "../thread";
import { classifyTx, titleFor } from "../classify";
import { fetchTxScripts, fetchTxTime } from "@/lib/whatsonchain";
import { txExplorerUrl } from "@/lib/explorer";
import { commentTxids } from "@/lib/folkloreBoard";
import { countPhotos } from "@/lib/xArchiveCache";
import { getOwner } from "@/lib/xOwner";
import { readLedgerRollup } from "@/lib/xVotes";
import { DEFAULT_WINDOW } from "@/lib/xScore";
import { dedupePosts } from "../../parseArchive";
import ProfilePage from "../../_components/ProfilePage";
import { shortTxid } from "../../_components/PostCard";

// Canonical, trustless view: render whatever lives at this exact TXID, read
// straight from the chain. No index lookup for the record itself — the txid IS
// the address. A folklore link renders as the link plus its comment thread; a
// comment reached directly renders nowhere but under its own parent (spec §8);
// anything else keeps the archived-profile rendering.

export async function generateMetadata(
  { params }: { params: Promise<{ txid: string }> },
): Promise<Metadata> {
  const { txid } = await params;
  const scripts = await fetchTxScripts(txid);
  // The same classification the body renders from, so the tab never names a
  // different feature than the page.
  return { title: scripts ? titleFor(classifyTx(scripts, txid), txid) : shortTxid(txid) };
}

function sourceLabel(source: string): string {
  if (source === "twetch") return "Twetch";
  if (source === "treechat") return "Treechat";
  if (source === "x") return "X";
  return source;
}

export default async function TxPage(
  { params }: { params: Promise<{ txid: string }> },
) {
  const { txid } = await params;
  const scripts = await fetchTxScripts(txid);
  if (!scripts) notFound();
  const classified = classifyTx(scripts, txid);
  if (classified.kind === "comment") redirect(`/folklore/tx/${classified.parent}`);
  if (classified.kind === "stamp") redirect(`/folklore/tx/${classified.target}`);
  if (classified.kind === "legacy-link") return <LinkThread txid={txid} link={classified.record} />;
  if (classified.kind === "map") {
    return (
      <TargetThread
        txid={txid}
        title={titleFor(classified, txid)}
        body={classified.post.text}
        source={sourceLabel(classified.source)}
      />
    );
  }
  if (classified.kind === "opaque") {
    return <TargetThread txid={txid} title={titleFor(classified, txid)} body="" source="Bitcoin" />;
  }

  // The classifier already parsed the archive from these scripts; only the
  // confirmation time is still to fetch.
  const time = await fetchTxTime(txid);
  const archive = socialArchiveToXArchive(classified.archive, txid);
  // ProfileView dedupes posts before rendering, so the photo count needs to
  // match what's actually shown — otherwise a transaction with duplicate
  // posts (and photos riding along with them) would report a higher photo
  // count than the reader ever sees, same as the cache path already does.
  const photoCount = countPhotos(dedupePosts(archive.posts));
  const [owner, { scoresByWindow, foundingByPost }] = await Promise.all([
    getOwner(archive.profile.handle),
    readLedgerRollup(archive.profile.handle),
  ]);
  const scores = scoresByWindow[DEFAULT_WINDOW];
  return (
    <ProfilePage
      archive={archive}
      txid={txid}
      txCount={1}
      photoCount={photoCount}
      firstInscribedAt={time}
      txTimes={time !== undefined ? { [txid]: time } : {}}
      scores={scores}
      foundingByPost={foundingByPost}
      verified={owner && owner.bindingTxid === txid ? { bindingPostId: owner.bindingPostId } : undefined}
    />
  );
}

/** A board link's page: the record as its header, then the thread — every
 * comment txid the index holds for this parent, fetched from the chain,
 * assembled by the pure `assembleThread` (hostile records skipped, list
 * order preserved). */
async function LinkThread({ txid, link }: { txid: string; link: FolkloreLink }) {
  const ids = await commentTxids(txid);
  const fetched = await Promise.all(
    ids.map(async (id) => {
      const commentScripts = await fetchTxScripts(id);
      return { txid: id, record: commentScripts ? recordFromScripts(commentScripts) : null };
    }),
  );
  const thread = assembleThread(txid, fetched);
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header>
        <p className="ledger-label">A link on the folklore board</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">
          <a
            href={link.url ?? `/folklore/tx/${link.txid ?? txid}`}
            {...(link.url ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="transition-colors hover:text-accent hover:underline"
          >
            {link.title}
          </a>
        </h1>
        <p className="mt-2 font-mono text-[11px] text-muted">
          {link.url ? new URL(link.url).hostname : shortTxid(link.txid ?? txid)}
          {link.by && ` · by @${link.by}`}
          {" · "}
          <a
            href={txExplorerUrl(txid)}
            target="_blank"
            rel="noopener noreferrer"
            title="This link's inscription on a block explorer"
            className="transition-colors hover:text-accent hover:underline"
          >
            {shortTxid(txid)} ↗
          </a>
        </p>
      </header>
      <section className="mt-10">
        <h2 className="ledger-label">
          {thread.length.toLocaleString("en-GB")} comment{thread.length === 1 ? "" : "s"} · read
          from the chain
        </h2>
        {thread.length > 0 ? (
          <div className="mt-3 divide-y divide-card-border border-y border-card-border">
            {thread.map((comment) => (
              <div key={comment.txid} className="px-4 py-4">
                <p className="whitespace-pre-wrap text-foreground">{comment.text}</p>
                <p className="mt-1.5 font-mono text-[11px] text-muted">
                  {comment.by && `by @${comment.by} · `}
                  <a
                    href={txExplorerUrl(comment.txid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="This comment's inscription on a block explorer"
                    className="transition-colors hover:text-accent hover:underline"
                  >
                    {shortTxid(comment.txid)} ↗
                  </a>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No comments yet.</p>
        )}
      </section>
    </div>
  );
}

async function TargetThread({
  txid,
  title,
  body,
  source,
}: {
  txid: string;
  title: string;
  body: string;
  source: string;
}) {
  const ids = await commentTxids(txid);
  const fetched = await Promise.all(
    ids.map(async (id) => {
      const commentScripts = await fetchTxScripts(id);
      return { txid: id, record: commentScripts ? recordFromScripts(commentScripts) : null };
    }),
  );
  const thread = assembleThread(txid, fetched);
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <header>
        <p className="ledger-label">{source}</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">{title}</h1>
        {body.trim() && body.trim() !== title ? (
          <p className="mt-4 whitespace-pre-wrap text-foreground">{body}</p>
        ) : null}
        <p className="mt-2 font-mono text-[11px] text-muted">
          <a
            href={txExplorerUrl(txid)}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-accent hover:underline"
          >
            {shortTxid(txid)} ↗
          </a>
        </p>
      </header>
      <section className="mt-10">
        <h2 className="ledger-label">
          {thread.length.toLocaleString("en-GB")} comment{thread.length === 1 ? "" : "s"} · read
          from the chain
        </h2>
        {thread.length > 0 ? (
          <div className="mt-3 divide-y divide-card-border border-y border-card-border">
            {thread.map((comment) => (
              <div key={comment.txid} className="px-4 py-4">
                <p className="whitespace-pre-wrap text-foreground">{comment.text}</p>
                <p className="mt-1.5 font-mono text-[11px] text-muted">
                  {comment.by && `by @${comment.by} · `}
                  <a
                    href={txExplorerUrl(comment.txid)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="This comment's inscription on a block explorer"
                    className="transition-colors hover:text-accent hover:underline"
                  >
                    {shortTxid(comment.txid)} ↗
                  </a>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No comments yet.</p>
        )}
      </section>
    </div>
  );
}
