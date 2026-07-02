export type EditionKind = "daily" | "week";

export function blobPathname(kind: EditionKind, date: string): string {
  return `board-pdfs/${kind}-${date}.pdf`;
}

export function downloadFilename(kind: EditionKind, date: string): string {
  return `henceforth-${kind}-${date}.pdf`;
}
