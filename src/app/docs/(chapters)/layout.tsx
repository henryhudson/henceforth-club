import type { ReactNode } from "react";
import SectionNav from "@/components/SectionNav";
import { CONTENT_SECTIONS, DOCS_CHAPTERS } from "@/lib/content-nav";

export default function ChapterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <SectionNav sections={CONTENT_SECTIONS} subItems={DOCS_CHAPTERS} />
      <article className="mt-12">{children}</article>
    </div>
  );
}
