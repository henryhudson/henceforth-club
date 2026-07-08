export type EditionKind = "daily" | "week";

export const INSCRIPTION_MARKER = "HHRPT1";

export function downloadFilename(kind: EditionKind, date: string): string {
  return `henceforth-${kind}-${date}.pdf`;
}
