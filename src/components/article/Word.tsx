import type { ReactNode } from "react";

type WordProps = {
  name: string;
  stack?: string;
  /**
   * Equivalent Henceforth FORTH word, when one exists. Rendered as a
   * small "≈ word" hint trailing the stack diagram — useful in the
   * Bitcoin Script OPCodes reference where many opcodes map cleanly
   * to a single FORTH word (e.g. op_dup ≈ dup, op_add ≈ +).
   */
  forth?: string;
  /**
   * When true, marks a non-standard extension (not Forth-2012 CORE).
   * Prefer this over burying "Henceforth extension" only in prose.
   */
  ext?: boolean;
  children: ReactNode;
};

// FORTH vocabulary entry. Renders as a per-word card with the word name
// in mono accent-warm, the stack diagram in smaller muted mono, an
// optional Henceforth FORTH equivalent in green, and the definition
// prose below. Mirrors the WordView layout in the iOS app but reveals
// everything inline because the web has the space.
export function Word({ name, stack, forth, ext, children }: WordProps) {
  return (
    <div className="my-4 border-l-2 border-accent-warm/40 pl-4 py-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <code className="font-mono text-base font-bold text-accent-warm">
          {name}
        </code>
        {stack && (
          <code className="font-mono text-xs text-muted/80">{stack}</code>
        )}
        {forth && (
          <code className="font-mono text-xs italic text-terminal-green/90">
            <span className="not-italic text-muted/60">≈</span> {forth}
          </code>
        )}
        {ext && (
          <span className="rounded-full border border-accent-warm/30 bg-accent-warm/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-warm/90">
            Extension
          </span>
        )}
      </div>
      <div className="mt-1.5 text-sm leading-relaxed text-foreground/80 [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
