/**
 * Byte-range arithmetic for the media route, kept pure so the 206 semantics
 * are testable without a server. Safari will not play a <video> from a server
 * that ignores Range requests — and both inscription gateways ignore them —
 * so this route is what stands between an on-chain video and a dark player.
 *
 * Returns null when no range was asked (serve 200), "invalid" when the header
 * is malformed or unsatisfiable (serve 416), else the inclusive byte window.
 */
export type ByteRange = { start: number; end: number };

export function parseRange(header: string | null, size: number): ByteRange | null | "invalid" {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";
  const [, startText, endText] = match;
  if (startText === "" && endText === "") return "invalid";

  // Suffix form `bytes=-n`: the final n bytes.
  if (startText === "") {
    const suffix = Number(endText);
    if (suffix === 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = Number(startText);
  if (start >= size) return "invalid";
  const end = endText === "" ? size - 1 : Math.min(Number(endText), size - 1);
  if (end < start) return "invalid";
  return { start, end };
}
