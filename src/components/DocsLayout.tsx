import type { ReactNode } from "react";
import TocSidebar, { type TocItem } from "./TocSidebar";
import type { SectionAccent } from "./SectionNav";

type Props = {
  toc: TocItem[];
  accent?: SectionAccent;
  children: ReactNode;
};

// Two-column docs layout: sticky TOC sidebar on the left (with search),
// prose content on the right. On small screens the sidebar hides; the
// prose takes the full width. Anchor links in the TOC scroll the page
// via the global scroll-behavior:smooth + scroll-padding-top in
// globals.css.
export default function DocsLayout({ toc, accent = "warm", children }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <TocSidebar items={toc} accent={accent} />
        <article className="min-w-0 max-w-3xl">{children}</article>
      </div>
    </div>
  );
}
