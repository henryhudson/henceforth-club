export type EditionKind = "daily" | "week" | "board";

/** The legacy edition envelope's marker: marker · kind · date · encrypted payload. */
export const INSCRIPTION_MARKER = "HHRPT1";
/** The chain envelope's marker (since 2026-08-30): marker · surface · date ·
 *  key identifier · previous transaction · sealed payload. Keep in sync with
 *  scripts/board/chain-put-core.mjs, which the site cannot import. */
export const CHAIN_MARKER = "henceforth.club/board";

export function downloadFilename(kind: EditionKind, date: string): string {
  return `henceforth-${kind}-${date}.pdf`;
}
