import type { ReactNode } from "react";

type ForthboxProps = {
  title?: string;
  children: ReactNode;
};

// Titled terminal-style example block. Mirrors the LaTeX `forthbox`
// environment: orange title chip pinned to the top-left of a dark
// terminal panel with green mono content. The actual content panel
// styling lives on the `pre` element styled by mdx-components — this
// component just adds the title chip and lets the inner code fence
// render its own `<pre>`.
export function Forthbox({ title, children }: ForthboxProps) {
  return (
    <div className="my-8">
      {title && (
        <div className="ml-3 -mb-2 inline-block rounded-sm bg-accent-orange px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-background shadow-sm shadow-black/40 relative z-10">
          {title}
        </div>
      )}
      <div className="[&>pre]:mt-0">{children}</div>
    </div>
  );
}
