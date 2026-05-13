import type { ReactNode } from "react";
import Link from "next/link";

export default function ChapterLayout({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <nav className="mb-10 text-xs uppercase tracking-[0.2em] text-muted">
        <Link
          href="/docs"
          className="transition-colors hover:text-accent-warm"
        >
          ← Documentation
        </Link>
      </nav>
      {children}
    </article>
  );
}
