// The pre-payment gate on the submit form (spec §8: oversized titles and
// comments are refused on the form, before payment). Pure — a draft goes in
// and either the exact JSON body POST /api/folklore/link expects comes out,
// or a plain-English refusal does. The caps and the final shape check come
// from the shared module the route itself validates with (linkRecord.ts), so
// the form and the route can never disagree about what fits — the specific
// messages here only name which validator check refused, exactly the route's
// own reason-naming doctrine.

import { COMMENT_MAX, TITLE_MAX, TXID_RE, validateComment, validateLink } from "../linkRecord";

export type SubmitDraft =
  | { kind: "link"; url: string; title: string }
  | { kind: "comment"; parent: string; text: string };

export type DraftResult = { ok: true; body: SubmitDraft } | { ok: false; message: string };

const refuse = (message: string): DraftResult => ({ ok: false, message });

export function draftRequest(draft: SubmitDraft): DraftResult {
  if (draft.kind === "link") {
    const url = draft.url.trim();
    const title = draft.title.trim();
    if (title.length === 0) return refuse("Give the link a title.");
    if (title.length > TITLE_MAX) {
      return refuse(
        `Titles cap at ${TITLE_MAX} characters — this one is ${title.length - TITLE_MAX} over.`,
      );
    }
    // The title passed both checks above, so the only refusal the shared
    // validator has left is the url.
    if (!validateLink(url, title)) return refuse("The link must be an http or https address.");
    return { ok: true, body: { kind: "link", url, title } };
  }

  const parent = draft.parent.trim();
  const text = draft.text.trim();
  if (!TXID_RE.test(parent)) {
    return refuse("The parent must be the link's 64-character transaction id.");
  }
  if (text.length === 0) return refuse("Write the comment first.");
  if (text.length > COMMENT_MAX) {
    const over = (text.length - COMMENT_MAX).toLocaleString("en-GB");
    return refuse(
      `Comments cap at ${COMMENT_MAX.toLocaleString("en-GB")} characters — this one is ${over} over.`,
    );
  }
  // Unreachable after the three checks above, but the validator stays the
  // gate: reason-naming never replaces it.
  if (!validateComment(parent, text)) return refuse("That comment cannot be submitted.");
  return { ok: true, body: { kind: "comment", parent, text } };
}
