import { PINNED_POST } from "../witness";
import { formatDate } from "./PostCard";

/**
 * Hero pin — the founding tweet rendered as a post, not as marketing copy.
 * Links out to X; the archive feed below is the live chain read.
 */
export default function PinnedPost() {
  const { id, handle, displayName, text, at } = PINNED_POST;
  const href = `https://x.com/${handle}/status/${id}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-auto mt-8 block max-w-md rounded-2xl border border-card-border bg-card-bg/80 p-5 text-left transition-colors hover:border-card-border-hover"
    >
      <p className="ledger-label mb-3">Pinned</p>
      <p className="text-sm leading-tight">
        <span className="font-bold text-foreground">{displayName}</span>{" "}
        <span className="text-muted">@{handle}</span>
      </p>
      <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-foreground">{text}</p>
      <p className="mt-3 font-mono text-[11px] text-muted">{formatDate(at)}</p>
    </a>
  );
}
