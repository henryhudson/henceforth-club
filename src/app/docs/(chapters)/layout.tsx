import type { ReactNode } from "react";

export default function ChapterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <article>{children}</article>
    </div>
  );
}
