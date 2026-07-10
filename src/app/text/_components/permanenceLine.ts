// Builds the profile header's one-line summary of how much of this profile
// exists, and how permanently. A live preview (never inscribed) gets its own
// honest line instead of claiming a permanence it doesn't have yet. Any
// other segment whose datum isn't known is left out rather than guessed at —
// a post count with no known transaction count just doesn't mention
// transactions. The "first inscribed" date arrives already formatted, so
// this stays a plain string-assembly function with no locale or timezone
// concerns of its own.

export function buildPermanenceLine({
  postCount,
  photoCount,
  txCount,
  firstInscribedLabel,
  isPreview,
}: {
  postCount: number;
  photoCount?: number;
  txCount?: number;
  firstInscribedLabel?: string;
  isPreview: boolean;
}): string {
  const posts = `${postCount.toLocaleString("en-GB")} ${pluralize(postCount, "post")}`;
  if (isPreview) return `${posts} · live preview — not yet inscribed`;

  const segments = [posts];
  if (photoCount !== undefined) {
    segments.push(`${photoCount.toLocaleString("en-GB")} ${pluralize(photoCount, "photo")}`);
  }
  if (txCount !== undefined) {
    segments.push(
      `archived across ${txCount.toLocaleString("en-GB")} ${pluralize(txCount, "transaction")}`,
    );
  }
  if (firstInscribedLabel !== undefined) {
    segments.push(`first inscribed ${firstInscribedLabel}`);
  }
  return segments.join(" · ");
}

function pluralize(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
