import type { ReactNode } from "react";

type ForthboxProps = {
  title?: string;
  children: ReactNode;
};

export function Forthbox({ title, children }: ForthboxProps) {
  return (
    <div className="my-8">
      {title && (
        <div className="ml-3 -mb-2 inline-block bg-accent-orange px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-background">
          {title}
        </div>
      )}
      <div className="rounded border border-card-border bg-terminal-bg p-5 shadow-lg shadow-black/40">
        <div className="overflow-x-auto font-mono text-[13px] leading-[1.7] text-terminal-green sm:text-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
