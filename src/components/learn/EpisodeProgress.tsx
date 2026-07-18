import Link from "next/link";
import { publishedEpisodes } from "@/lib/episodes";

/** Compact progress strip — "3 / 10" with links to each published episode. */
export default function EpisodeProgress({
  current,
}: {
  current: number;
}) {
  const published = publishedEpisodes();
  const total = published.length;

  return (
    <nav
      aria-label={`Episode ${current} of ${total}`}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted/60"
    >
      <span className="font-medium text-accent-warm/80">
        {current} / {total}
      </span>
      <ol className="flex flex-wrap gap-1.5">
        {published.map((ep) => {
          const active = ep.number === current;
          return (
            <li key={ep.slug}>
              <Link
                href={`/learn/${ep.slug}`}
                aria-current={active ? "page" : undefined}
                title={`Episode ${ep.number}: ${ep.title}`}
                className={
                  active
                    ? "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-warm/20 px-1.5 font-medium text-accent-warm"
                    : "inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-card-border/50 px-1.5 text-muted/50 transition-colors hover:border-accent-warm/40 hover:text-accent-warm"
                }
              >
                {ep.number}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
