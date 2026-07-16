/**
 * The Folklore wordmark.
 *
 * Every letter in FOLKLORE happens to have an Elder Futhark cognate — Fehu,
 * Othala, Laguz, Kaunan, Raidho, Ehwaz — so each letterform here is built from
 * its rune counterpart rather than merely angularised: a vertical stem with
 * diagonal branches. Horizontals are avoided throughout, which is the actual
 * grammar of carved letters — a carver cuts across the grain, and a horizontal
 * runs along it and splits the wood. That constraint, not decoration, is what
 * makes it read as cut rather than drawn.
 *
 * Latin legibility wins wherever the two disagree. Laguz branches from the top
 * of its stem, but an L with a top branch reads as a 7, so L keeps a foot — it
 * is merely lifted off the horizontal. The mark has to say the name first.
 *
 * Drawn as paths, not set in a display face: a wordmark is artwork, so the room
 * keeps its single typeface (globals.css: Space Mono everywhere) and the page
 * pays no font download on a funnel whose whole plan is speed. Strokes inherit
 * currentColor so the mark themes with the room instead of pinning a hex.
 */
export default function FolkloreWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-12 -14 594 128"
      role="img"
      aria-label="Folklore"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={14}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {/* F — Fehu: stem, two branches raked upward */}
      <path d="M0 0 V100 M0 12 L46 0 M0 54 L38 43" />
      {/* O — Othala: the carver's lozenge */}
      <path d="M100 0 L128 30 V66 L100 100 L72 66 V30 Z" />
      {/* L — Laguz, conceded to legibility: the foot lifts rather than lies flat */}
      <path d="M154 0 V100 L200 88" />
      {/* K — Kaunan: two cuts meeting off a stem; the most runic letter already */}
      <path d="M224 0 V100 M224 54 L270 4 M224 54 L272 100" />
      {/* L */}
      <path d="M296 0 V100 L342 88" />
      {/* O */}
      <path d="M396 0 L424 30 V66 L396 100 L368 66 V30 Z" />
      {/* R — Raidho: stem, a bowl cut as a triangle, kicked leg */}
      <path d="M450 0 V100 M450 0 L496 14 L450 46 M470 40 L500 100" />
      {/* E — Ehwaz's rake, kept legible: three branches on Fehu's angle */}
      <path d="M524 0 V100 M524 12 L570 0 M524 54 L562 43 M524 100 L570 88" />
    </svg>
  );
}
