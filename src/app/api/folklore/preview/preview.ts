// The submit form's preview of a target (specification §2): the same
// classification the reader renders from (src/app/folklore/tx/classify.ts),
// flattened to the few fields a form needs — what kind of thing the id is,
// where it came from, and a default title. Pure; the route beside it makes
// the one chain read.

import { TITLE_MAX } from "@/app/folklore/linkRecord";
import type { TxClass } from "@/app/folklore/tx/classify";

export type Preview = {
  txid: string;
  kind: TxClass["kind"];
  /** The source chip: a Magic Attribute Protocol app (twetch, treechat), an
   * archive's source (x), or folklore. Absent where there is nothing to
   * chip. */
  source?: string;
  /** The default title — the first non-empty line of the text the parse
   * found, clipped to the title cap. Absent when the parse found no text;
   * the submitter then writes one. */
  title?: string;
  /** A comment's parent or a stamp's target: the id to list instead. An id
   * has one thread, and it is the target's (specification, Decision 2). */
  listInstead?: string;
};

/** Pure. The first non-empty line of `text`, clipped to TITLE_MAX — or
 * undefined when there is no such line. */
export function defaultTitle(text: string): string | undefined {
  const line = text
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.length > 0);
  return line === undefined ? undefined : line.slice(0, TITLE_MAX);
}

const withTitle = (preview: Preview, title: string | undefined): Preview =>
  title === undefined ? preview : { ...preview, title };

export function previewFor(classified: TxClass, txid: string): Preview {
  switch (classified.kind) {
    case "map":
      return withTitle(
        { txid, kind: "map", source: classified.source },
        defaultTitle(classified.post.text),
      );
    case "archive":
      return withTitle(
        { txid, kind: "archive", source: classified.archive.source },
        defaultTitle(classified.archive.posts[0]?.text ?? ""),
      );
    case "legacy-link":
      return { txid, kind: "legacy-link", source: "folklore", title: classified.record.title };
    case "comment":
      return { txid, kind: "comment", listInstead: classified.parent };
    case "stamp":
      return { txid, kind: "stamp", listInstead: classified.target };
    case "opaque":
      return { txid, kind: "opaque" };
  }
}
