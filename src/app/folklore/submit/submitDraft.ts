// The pre-payment gate on the submit form (specification §8: oversized titles
// and comments are refused on the form, before anything is signed or paid).
// Pure — a draft goes in and either the validated draft comes out (for a
// target, the id and title the stamp will carry; for a comment, the exact
// JSON body POST /api/folklore/link expects), or a plain-English refusal
// does. The caps and the final shape check come from the shared module the
// routes validate with (linkRecord.ts), so the form and the routes can never
// disagree about what fits — the messages here only name which check
// refused, exactly the routes' own reason-naming doctrine.

import { extractTargetTxid } from "../extractTarget";
import { COMMENT_MAX, TITLE_MAX, TXID_RE, validateComment, validateLink } from "../linkRecord";

export type SubmitDraft =
  /** `target` is a lowercase 64-hex transaction id once validated; the form
   * accepts any paste that contains one — an explorer, Twetch or Treechat
   * link as readily as the bare id. */
  | { kind: "link"; target: string; title: string }
  | { kind: "comment"; parent: string; text: string };

export type DraftResult = { ok: true; body: SubmitDraft } | { ok: false; message: string };

const refuse = (message: string): DraftResult => ({ ok: false, message });

export function draftRequest(draft: SubmitDraft): DraftResult {
  if (draft.kind === "link") {
    const title = draft.title.trim();
    if (title.length === 0) return refuse("Give the link a title.");
    if (title.length > TITLE_MAX) {
      return refuse(
        `Titles cap at ${TITLE_MAX} characters — this one is ${title.length - TITLE_MAX} over.`,
      );
    }
    // The board lists transaction ids, not web addresses (specification,
    // Decision 1): a paste with no id in it is refused here, before anyone
    // signs a stamp the index would refuse as not-a-target.
    const target = extractTargetTxid(draft.target);
    if (!target) {
      return refuse("Paste a transaction id — 64 hex characters, or a link that contains one.");
    }
    // Unreachable after the checks above, but the validator stays the gate:
    // reason-naming never replaces it.
    if (!validateLink(target, title)) return refuse("That listing cannot be submitted.");
    return { ok: true, body: { kind: "link", target, title } };
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
