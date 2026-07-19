"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { PROVISIONAL_DUELS } from "@/lib/kudos/constants";
import type { Rating } from "@/lib/kudos/elo";
import type { XPost } from "../parseArchive";
import type { ThreadContext } from "./threadContext";
import { Avatar, formatDate, formatUnixSeconds, shortTxid } from "./PostCard";

/**
 * One archived post as a ledger entry. At rest it is a plain row on a hairline
 * rule — the post's own text, the largest thing on the page. Clicking the text
 * opens the entry: it lifts into a bordered panel with an orange edge marker
 * and reveals what a resting feed hides — the thread this post belongs to
 * within the archive, and the on-chain record that makes it permanent (the
 * transaction, when it was inscribed, and a way to read it yourself).
 *
 * The text is the toggle, exactly as a reader expects ("click the post to open
 * it"); the media and the block-explorer links stay outside that button so no
 * link is ever nested inside it.
 */
export default function PostEntry({
  post,
  showParent,
  txTime,
  thread,
  handle,
  sats,
  avatarUrl,
  displayName,
  foundingSats,
  kudosEnabled = false,
  tipCount: _tipCount,
  elo,
  defaultOpen = false,
}: {
  post: XPost;
  showParent: boolean;
  txTime?: number;
  thread?: ThreadContext;
  handle?: string;
  /** Kudos earned through paid votes — ranking score for this post. Upload
   * cost is never included. Absent until someone has given kudos. */
  sats?: number;
  /** The archive author's profile picture, shown beside every entry. All posts
   * in an archive share one author, so this is the profile's avatar threaded
   * down rather than anything per-post. Absent → the row renders as before. */
  avatarUrl?: string;
  /** The author's display name, shown with the handle above the text. */
  displayName?: string;
  /** Upload cost — not shown on the ranking chip (kept for call-site compat). */
  foundingSats?: number;
  /** Elo markup only. Giving kudos is app-only (Henceforth); the site never
   * renders a tip control. */
  kudosEnabled?: boolean;
  /** The post's public tip count, threaded from the server's bulk read. */
  tipCount?: number;
  /** The text's duel rating, threaded only while the kudos flag is on —
   * under PROVISIONAL_DUELS duels it renders as the unranked badge instead
   * of a number. Absent (the flag off), the row carries no rating markup. */
  elo?: Rating;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  // An in-archive self-thread (parent/replies inscribed here) versus a reply to
  // a tweet that isn't in this archive. The archive holds only this account's
  // own posts, so a reply to someone else can't carry that tweet's text — but
  // its id is ours to link, so we point out to it on X rather than inscribe it.
  const externalParent = post.replyToId && !thread?.parent ? post.replyToId : undefined;
  const externalParentUrl = externalParent
    ? post.replyToScreenName
      ? `https://x.com/${post.replyToScreenName}/status/${externalParent}`
      : `https://x.com/i/status/${externalParent}`
    : undefined;
  const hasThread = Boolean(thread && (thread.parent || thread.replies.length > 0)) || Boolean(externalParent);

  return (
    <article
      id={`post-${post.id}`}
      data-post-id={post.id}
      className={
        open
          ? "entry-open animate-ledger rounded-lg border border-card-border bg-card-bg px-4 py-4"
          : "px-1 py-4"
      }
    >
      {/* The tweet being replied to (preview archives only carry the text) */}
      {showParent && post.parent ? (
        <div className="mb-3 rounded-lg border-l-2 border-card-border-hover bg-card-bg/60 px-3 py-2">
          <p className="text-xs font-semibold text-accent">@{post.parent.author}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{post.parent.text}</p>
        </div>
      ) : post.replyToScreenName ? (
        <p className="mb-2 ledger-label">
          ↳ replying to <span className="text-accent">@{post.replyToScreenName}</span>
        </p>
      ) : null}

      {/* The author signs the entry — picture and name, both OUTSIDE the
          toggle so the button stays text-only, and both pointing at the
          author's archive (/folklore/<handle>): the picture is where a reader
          expects "take me to all their posts" to live. The avatar link is
          hidden from the accessibility tree — it duplicates the name link,
          and one accessible link per destination beats two identical stops. */}
      <div className="flex items-start gap-3">
        {avatarUrl &&
          (handle ? (
            <Link href={`/folklore/${handle}`} tabIndex={-1} aria-hidden className="mt-1 shrink-0">
              <Avatar size={24} avatarUrl={avatarUrl} initial="" />
            </Link>
          ) : (
            <span className="mt-1 shrink-0">
              <Avatar size={24} avatarUrl={avatarUrl} initial="" />
            </span>
          ))}
        <div className="min-w-0 flex-1">
          {(displayName || handle) && (
            <p className="mb-1 text-sm leading-tight">
              {handle ? (
                <Link href={`/folklore/${handle}`} className="group/name">
                  {displayName && (
                    <span className="font-bold text-foreground transition-colors group-hover/name:text-accent">
                      {displayName}
                    </span>
                  )}{" "}
                  <span className="text-muted">@{handle}</span>
                </Link>
              ) : (
                <span className="font-bold text-foreground">{displayName}</span>
              )}
            </p>
          )}
          {/* The post text — the toggle. Text only, so no nested interactive. */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="group flex w-full min-w-0 items-start gap-3 text-left"
          >
            <p className="min-w-0 flex-1 whitespace-pre-wrap text-base leading-loose text-foreground transition-colors group-hover:text-accent">
              {post.text}
            </p>
            <span
              aria-hidden
              className="mt-1 shrink-0 select-none font-mono text-sm text-muted transition-colors group-hover:text-accent"
            >
              {open ? "–" : "+"}
            </span>
          </button>
        </div>
      </div>

      {/* Media, each in a fixed-ratio frame so nothing shifts while it loads */}
      {post.media && post.media.length > 0 && (
        <div className={`mt-4 grid gap-2 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.media.map((m, i) =>
            m.type === "photo" ? (
              <a
                key={i}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-[4/3] overflow-hidden rounded-lg border border-card-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </a>
            ) : (
              <video
                key={i}
                src={m.url}
                poster={m.preview}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-lg border border-card-border"
              />
            ),
          )}
        </div>
      )}

      {/* Resting line: when it was posted, what it has earned, and — collapsed
          only — a short link on chain. No likes or retweets: on this ledger a
          post's worth is the sats it has earned, not applause it can't keep. */}
      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
        <span>{formatDate(post.at)}</span>
        {/* The duel rating — the ranking under the kudos flag. Under
            PROVISIONAL_DUELS duels a text is still finding its level, so it
            wears the unranked badge rather than a number that would move by
            forty points a duel. The economics chips below stay exactly as
            they are: money and quality are two separate visible axes. */}
        {elo &&
          (elo.duels < PROVISIONAL_DUELS ? (
            <>
              <span aria-hidden>·</span>
              <span
                className="font-mono"
                title={`Unranked — a post is rated after ${PROVISIONAL_DUELS} arena duels; this one has fought ${elo.duels}`}
              >
                unranked
              </span>
            </>
          ) : (
            <>
              <span aria-hidden>·</span>
              <span
                className="font-mono"
                title={`Elo rating over ${elo.duels} arena duels — earned against other posts, never bought`}
              >
                ⚔ <span className="text-accent">{Math.round(elo.rating).toLocaleString("en-GB")}</span>
              </span>
            </>
          ))}
        {/* Ranking chip — kudos only. Upload cost never appears here. */}
        {(sats ?? 0) !== 0 && (
          <>
            <span aria-hidden>·</span>
            <span
              className="font-mono text-accent"
              title="Kudos earned through paid votes — ranking score only"
            >
              ◈ {formatSats(sats ?? 0)} kudos
            </span>
          </>
        )}
        {/* Giving kudos is Henceforth-only — no tip control on the website. */}
        {!open && post.txid && (
          <>
            <span aria-hidden>·</span>
            <a
              href={`https://whatsonchain.com/tx/${post.txid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono transition-colors hover:text-accent hover:underline"
            >
              ⛓ {shortTxid(post.txid)}
            </a>
          </>
        )}
      </p>

      {/* The reveal */}
      {open && (
        <div id={panelId} className="animate-ledger mt-4 space-y-4 border-t border-card-border pt-4">
          {hasThread && (
            <section>
              <p className="ledger-label mb-2">Thread</p>
              <div className="space-y-1.5">
                {thread?.parent && <ThreadLine label="in reply to" post={thread.parent} handle={handle} />}
                {externalParentUrl && (
                  <a
                    href={externalParentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border-l-2 border-card-border-hover px-3 py-1.5 text-sm transition-colors hover:border-accent hover:bg-card-bg"
                  >
                    <span className="ledger-label mr-2 align-middle">↑</span>
                    <span className="align-middle text-muted">
                      the tweet this replies to
                      {post.replyToScreenName && (
                        <span className="text-accent"> · @{post.replyToScreenName}</span>
                      )}{" "}
                      on X ↗
                    </span>
                  </a>
                )}
                {thread?.replies.map((r) => (
                  <ThreadLine key={r.id} label="reply" post={r} handle={handle} />
                ))}
              </div>
            </section>
          )}

          {post.txid ? (
            <OnChain txid={post.txid} txTime={txTime} />
          ) : (
            <p className="text-xs text-muted">Live preview — not yet inscribed on Bitcoin.</p>
          )}
        </div>
      )}
    </article>
  );
}

/** One line of the thread: a truncated quote of a neighbouring post, linked to
 * its own permalink when the handle is known. */
function ThreadLine({ label, post, handle }: { label: string; post: XPost; handle?: string }) {
  const body = (
    <>
      <span className="ledger-label mr-2 align-middle">{label === "reply" ? "↓" : "↑"}</span>
      <span className="align-middle text-muted">{truncate(post.text, 120)}</span>
    </>
  );
  return handle ? (
    <Link
      href={`/folklore/${handle}/${post.id}`}
      className="block rounded-md border-l-2 border-card-border-hover px-3 py-1.5 text-sm transition-colors hover:border-accent hover:bg-card-bg"
    >
      {body}
    </Link>
  ) : (
    <p className="block border-l-2 border-card-border-hover px-3 py-1.5 text-sm">{body}</p>
  );
}

/** The on-chain record: the full transaction id (copyable), when it confirmed,
 * and a block explorer to check it independently. */
function OnChain({ txid, txTime }: { txid: string; txTime?: number }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(txid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (no permission / insecure context) — the id is still
      // visible and selectable, so there is nothing to recover from.
    }
  }
  return (
    <section>
      <p className="ledger-label mb-2">On chain</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{txid}</code>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md border border-card-border px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-accent hover:text-accent"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {txTime !== undefined ? `Inscribed ${formatUnixSeconds(txTime)}` : "Inscribed on Bitcoin"}
        {" · "}
        <a
          href={`https://whatsonchain.com/tx/${txid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent transition-colors hover:underline"
        >
          open on a block explorer ↗
        </a>
      </p>
    </section>
  );
}

function truncate(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** Whole-sat count with thousands separators; a negative fold reads with its
 * sign so a down-voted post is honest about it. */
function formatSats(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}
