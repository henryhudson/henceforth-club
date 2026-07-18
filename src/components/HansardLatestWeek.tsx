import Link from "next/link";
import { listPublishedSummaries } from "@/lib/this-week/store";

/** Latest "This Week in Parliament" card for the Hansard product page. */
export default function HansardLatestWeek() {
  const latest = listPublishedSummaries()[0];
  if (!latest) return null;

  return (
    <Link
      href={`/hansard/this-week/${latest.week}`}
      className="card-glow card-glow-green group block rounded-2xl border border-card-border bg-card-bg/50 p-6 transition-colors hover:border-accent-green sm:p-8"
    >
      <p className="text-xs uppercase tracking-widest text-accent-green/70">
        This Week in Parliament · latest
      </p>
      <h2 className="mt-3 text-xl font-bold text-foreground sm:text-2xl">
        {latest.headline}
      </h2>
      <p className="mt-2 text-sm text-muted/70">{latest.windowLabel}</p>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted/60 transition-colors group-hover:text-accent-green">
        Read the digest
        <span
          aria-hidden="true"
          className="inline-block transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </span>
    </Link>
  );
}
