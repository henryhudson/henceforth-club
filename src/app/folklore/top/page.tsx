import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readKudosReceived, type ReceivedKudos } from "@/lib/kudos/received";
import { getArchivePost } from "@/lib/xArchiveCache";
import { dateKey } from "@/lib/redis";
import type { XPost } from "../parseArchive";
import { buildChart, chartDay, nextDay, previousDay, type ChartUnit } from "./chart";

// /folklore/top — the daily chart, flag-gated exactly like the arena: the
// flag is read per request (the page is forced dynamic) and while it is off
// the page is a quiet not-found. Rank is kudos received that day — duel
// kudos and tips alike, no Elo headline, no wildcards injected; discovery
// is the dealt stream's job. Past days stay navigable: the append-only
// received streams reconstruct any date, and the daily reset itself fights
// entrenchment — yesterday's winner starts today at zero.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Top — the daily chart",
  description: "The folklore's daily chart, ranked by kudos received that day.",
  robots: { index: false },
};

/** How far up a reply chain the page will walk. Threads are short; this
 * only bounds a pathological archive. */
const MAX_THREAD_HOPS = 50;

type Threads = {
  posts: ReadonlyMap<string, XPost>;
  parentOf: ReadonlyMap<string, string>;
};

/**
 * The charted posts and their thread ancestry, read from the archive cache:
 * every kudos'd post, then the chain above it so the roll-up can find each
 * root. A parent link is recorded only when the parent actually sits in the
 * same archive — a reply to someone else's never-archived post roots at
 * itself, exactly as buildThreadContext treats it.
 */
async function loadThreads(entries: readonly ReceivedKudos[]): Promise<Threads> {
  const posts = new Map<string, XPost>();
  const walked = new Set<string>();
  for (const { author, postId } of entries) {
    let current: string | undefined = postId;
    for (
      let hops = 0;
      current !== undefined && !walked.has(current) && hops < MAX_THREAD_HOPS;
      hops++
    ) {
      walked.add(current);
      const post = await getArchivePost(author, current);
      if (post === null) break;
      posts.set(current, post);
      current = post.replyToId;
    }
  }
  const parentOf = new Map<string, string>();
  for (const [id, post] of posts) {
    if (post.replyToId !== undefined && posts.has(post.replyToId)) {
      parentOf.set(id, post.replyToId);
    }
  }
  return { posts, parentOf };
}

function ChartPostRow({
  author,
  postId,
  amount,
  posts,
  label,
}: {
  author: string;
  postId: string;
  amount: number;
  posts: ReadonlyMap<string, XPost>;
  label?: string;
}) {
  const text = posts.get(postId)?.text;
  const meta = [label, amount > 0 ? `✦ ${amount.toLocaleString("en-GB")}` : undefined]
    .filter((part) => part !== undefined)
    .join(" · ");
  return (
    <div>
      <Link
        href={`/folklore/${author}/${postId}`}
        className="block whitespace-pre-wrap text-sm text-foreground transition-colors hover:text-accent"
      >
        {text ?? postId}
      </Link>
      {meta.length > 0 && <p className="mt-1 font-mono text-[11px] text-muted">{meta}</p>}
    </div>
  );
}

/** One charted unit — a thread as one entry, the author's continuation
 * posts above the root, per the plan's late revision. */
function ChartUnitRow({
  unit,
  rank,
  posts,
}: {
  unit: ChartUnit;
  rank: number;
  posts: ReadonlyMap<string, XPost>;
}) {
  const isThread = unit.continuations.length > 0;
  return (
    <li className="border-b border-card-border pb-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-xs text-muted">
          #{rank} ·{" "}
          <Link className="text-accent hover:underline" href={`/folklore/${unit.author}`}>
            @{unit.author}
          </Link>
          {isThread && " · a thread"}
        </span>
        <span className="font-mono text-xs text-accent">
          ✦ {unit.total.toLocaleString("en-GB")}
        </span>
      </div>
      <div className="mt-3 space-y-4">
        {unit.continuations.map((post) => (
          <ChartPostRow
            key={post.postId}
            author={unit.author}
            postId={post.postId}
            amount={post.amount}
            posts={posts}
          />
        ))}
        <ChartPostRow
          author={unit.author}
          postId={unit.rootPostId}
          amount={unit.rootAmount}
          posts={posts}
          label={isThread ? "the thread's root" : undefined}
        />
      </div>
    </li>
  );
}

export default async function TopPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[] }>;
}) {
  if (process.env.KUDOS_ENABLED !== "true") notFound();

  const { day: dayParam } = await searchParams;
  const today = dateKey();
  const day = chartDay(typeof dayParam === "string" ? dayParam : undefined, today);
  const isToday = day === today;

  const entries = await readKudosReceived(day);
  const threads = await loadThreads(entries);
  const chart = buildChart(entries, threads.parentOf);

  return (
    // A <div>, not a <main>: the root layout already provides the single
    // <main> landmark for every page (see app/layout.tsx).
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 pb-24 pt-16">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Top</h1>
          <p className="ledger-label mt-2">kudos received · {isToday ? "today" : day}</p>
          <nav
            aria-label="chart day"
            className="mt-4 flex items-center justify-center gap-4 font-mono text-xs"
          >
            <Link
              className="text-muted transition-colors hover:text-accent"
              href={`/folklore/top?day=${previousDay(day)}`}
            >
              &larr; {previousDay(day)}
            </Link>
            {!isToday && (
              <>
                <Link
                  className="text-muted transition-colors hover:text-accent"
                  href={`/folklore/top?day=${nextDay(day)}`}
                >
                  {nextDay(day)} &rarr;
                </Link>
                <Link className="text-accent hover:underline" href="/folklore/top">
                  today
                </Link>
              </>
            )}
          </nav>
        </header>

        {chart.length === 0 ? (
          <p className="mt-14 text-center text-muted">
            No kudos landed {isToday ? "today — yet" : "this day"}.
          </p>
        ) : (
          <ol className="mt-10 space-y-8">
            {chart.map((unit, index) => (
              <ChartUnitRow
                key={unit.rootPostId}
                unit={unit}
                rank={index + 1}
                posts={threads.posts}
              />
            ))}
          </ol>
        )}

        <p className="mt-14 text-center font-mono text-sm">
          <Link className="text-accent hover:underline" href="/folklore">
            &larr; the folklore
          </Link>
        </p>
      </div>
    </div>
  );
}
