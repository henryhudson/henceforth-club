"use client";
import { useState } from "react";

export default function CodeAlong({ commands }: { commands: string[] }) {
  const [copied, setCopied] = useState<number | null>(null);

  async function copy(cmd: string, i: number) {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(i);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <ul className="space-y-2">
      {commands.map((cmd, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => copy(cmd, i)}
            className="group flex w-full items-center justify-between gap-3 rounded-lg border border-card-border bg-card-bg/50 px-4 py-3 text-left transition-colors hover:border-accent-warm"
          >
            <code className="font-mono text-sm text-foreground">{cmd}</code>
            <span className="shrink-0 text-xs text-muted/60 group-hover:text-accent-warm">
              {copied === i ? "copied ✓" : "copy"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
