import type { XArchive } from "./parseArchive";

/**
 * Where an archive came from, and therefore what may be done with it.
 *
 * X's Developer Policy forbids storing post content off X, and permits
 * redistributing only post identifiers. An OP_RETURN cannot be deleted and post
 * text is not an identifier, so content read from X's application programming
 * interface must never reach an inscription. That rule lives here, as a type,
 * rather than in a comment somebody will forget: `Inscribable` is `Portable` and
 * nothing else, so the compiler refuses what the policy forbids.
 */

/** The visitor exported this from X themselves. The only thing we may inscribe. */
export type Portable = { readonly kind: "portable"; readonly archive: XArchive };

/** Already on Bitcoin. Renderable forever, never re-inscribable. */
export type OnChain = {
  readonly kind: "onchain";
  readonly archive: XArchive;
  readonly txid: string;
};

export type Rendered = Portable | OnChain;
export type Inscribable = Portable;

export const portable = (archive: XArchive): Portable => ({ kind: "portable", archive });

export const onChain = (archive: XArchive, txid: string): OnChain => ({
  kind: "onchain",
  archive,
  txid,
});

export const isInscribable = (source: Rendered): source is Inscribable =>
  source.kind === "portable";
