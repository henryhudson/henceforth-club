// Plain-English copy for every reason POST /api/folklore/link and
// POST /api/folklore/index can refuse — pure, total: an unrecognised reason
// still gets an honest, generic message rather than a blank error (the
// archive's jobRefusalMessage doctrine, for the submit rail).
// "not-available" is deliberately absent: the flow treats it as the closed
// state, not an error under a form.

import { COMMENT_MAX, TITLE_MAX } from "../linkRecord";

export function submitRefusalMessage(reason: unknown, retryAfterSeconds?: number): string {
  switch (reason) {
    case "too-large":
      return "That submission is too large to send.";
    case "title-too-long":
      return `Titles cap at ${TITLE_MAX} characters.`;
    case "bad-title":
      return "Give the link a title.";
    case "bad-url":
      return "The link must be an http or https address.";
    case "comment-too-long":
      return `Comments cap at ${COMMENT_MAX.toLocaleString("en-GB")} characters.`;
    case "bad-text":
      return "Write the comment first.";
    case "bad-parent":
      return "The parent must be the link's 64-character transaction id.";
    case "unknown-parent":
      return "That parent link is not on the board — check the transaction id. Nothing was charged.";
    case "unknown-tx":
      return "That transaction can't be read from the chain yet. If you have just broadcast it, give it a moment and index it again — nothing is lost.";
    case "bad-record":
      return "That transaction carries no folklore stamp. Paste the id of the stamp you broadcast, not the target's.";
    case "not-a-target":
      return "That stamp names a web address rather than a transaction id, so it can't be listed here.";
    case "floor-short":
      return "The stamp's payment to the revenue address is under the ten-pence floor at today's rate, so it was not indexed. Broadcast a new stamp with a larger payment and index that one.";
    case "already-listed":
      return "That target is already on the board — there is one row per transaction id.";
    case "bad-by":
    case "unsigned-by":
    case "unbound-by":
    case "bad-signature":
      return "The handle attribution could not be verified, so nothing was submitted.";
    case "store-unavailable":
      return "The board's index is temporarily unreachable — nothing was submitted. Try again shortly.";
    case "too-many-submissions":
      return retryAfterSeconds !== undefined &&
        Number.isFinite(retryAfterSeconds) &&
        retryAfterSeconds > 0
        ? `Too many submissions from here just now — try again in ${Math.ceil(retryAfterSeconds)} seconds.`
        : "Too many submissions from here just now — try again shortly.";
    case "price-unavailable":
      return "The live exchange rate is unavailable, so the price can't be quoted honestly right now. Nothing was charged — try again shortly.";
    case "at-capacity":
      return "The inscription worker is at capacity right now — try again shortly.";
    default:
      return "Something went wrong submitting. Nothing was charged — try again.";
  }
}
