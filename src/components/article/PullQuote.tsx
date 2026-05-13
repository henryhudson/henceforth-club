import type { ReactNode } from "react";

type PullQuoteProps = {
  attribution?: string;
  children: ReactNode;
};

export function PullQuote({ attribution, children }: PullQuoteProps) {
  return (
    <figure className="my-12 border-l-4 border-accent-warm pl-8 pr-4">
      <blockquote className="text-xl italic leading-[1.6] text-foreground sm:text-2xl">
        {children}
      </blockquote>
      {attribution && (
        <figcaption className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">
          — {attribution}
        </figcaption>
      )}
    </figure>
  );
}
