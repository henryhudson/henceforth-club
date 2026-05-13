import type { ReactNode } from "react";

type WordProps = {
  name: string;
  stack?: string;
  children: ReactNode;
};

// FORTH vocabulary entry. Renders as a per-word card with the word name
// in mono accent-warm, the stack diagram in smaller muted mono, and the
// definition prose below. Mirrors the WordView layout in the iOS app
// (Henceforth/Terminal MVVM/View/WordView.swift) but reveals everything
// inline because the web has the space.
export function Word({ name, stack, children }: WordProps) {
  return (
    <div className="my-4 border-l-2 border-accent-warm/40 pl-4 py-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <code className="font-mono text-base font-bold text-accent-warm">
          {name}
        </code>
        {stack && (
          <code className="font-mono text-xs text-muted/80">{stack}</code>
        )}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground/80 [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
