import { parseBindingAddress } from "./xBinding";

/**
 * Checks a binding claim against the live post on X, at the one moment it
 * matters: when an unclaimed handle is first claimed.
 *
 * The on-chain archive is written by whoever paid for the transaction, so it
 * proves nothing about who owns the handle — a claimant can inscribe any JSON
 * they like, including a fabricated binding line naming an account they do not
 * control. The only party who can put a post under a handle is that handle.
 * So the address is read back off X itself, by post id.
 *
 * The oracle is `author_url`, never `author_name`: handles are unique and
 * owned, display names are free-form and changeable, so an attacker can set
 * their display name to the victim's handle but cannot hold the handle itself.
 *
 * Free and unauthenticated — this endpoint is not the metered timeline API, so
 * the check costs nothing per registration. Every arm fails closed.
 */

const OEMBED = "https://publish.x.com/oembed";

/** X post ids are numeric snowflakes; an archive with no binding post id yields "". */
const POST_ID = /^\d+$/;

/** oEmbed's canonical author link, whose last segment is the owned handle. */
const AUTHOR_URL = /^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})$/;

/** The post text sits in the embed's first paragraph; the attribution tail,
 * which carries the attacker-controlled display name, sits outside it. */
const FIRST_PARAGRAPH = /<p[^>]*>([\s\S]*?)<\/p>/;

/** The attribution tail's permalink. `author_url` says who is SHOWING the
 * embed; this says who WROTE the text in the first paragraph, and which post
 * that text is. For an ordinary post the two agree. For a RETWEET they do not:
 * X serves the retweeter in `author_url` and the original author's words in the
 * paragraph, so `author_url` alone lets a victim's single retweet certify an
 * attacker's binding line — one tap, and the attacker holds the handle.
 * Matched only against the markup AFTER the post text, so an x.com status link
 * written INSIDE a post cannot pose as the tail. */
const TAIL_PERMALINK = /<a\s+href="https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d+)[^"]*"/;

const TIMEOUT_MS = 5000;

export type LiveBinding =
  | { kind: "verified" }
  | { kind: "not-found" }
  | { kind: "wrong-author"; author: string }
  | { kind: "no-binding" }
  | { kind: "unreachable" };

export async function verifyBindingPost(
  input: { handle: string; postId: string; address: string },
  fetchFn: typeof fetch = fetch,
): Promise<LiveBinding> {
  if (!POST_ID.test(input.postId)) return { kind: "not-found" };

  const permalink = `https://x.com/${input.handle}/status/${input.postId}`;
  let res: Response;
  try {
    res = await fetchFn(`${OEMBED}?url=${encodeURIComponent(permalink)}&omit_script=1`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return { kind: "unreachable" };
  }

  // X serves a text/html error page for a post it will not embed — deleted,
  // suspended, protected, or never existed. All of those are "no evidence".
  if (res.status === 404) return { kind: "not-found" };
  if (!res.ok) return { kind: "unreachable" };
  if (!(res.headers.get("content-type") ?? "").includes("json")) return { kind: "unreachable" };

  let body: { author_url?: unknown; html?: unknown };
  try {
    body = await res.json();
  } catch {
    return { kind: "unreachable" };
  }

  const author = typeof body.author_url === "string" ? AUTHOR_URL.exec(body.author_url) : null;
  if (!author) return { kind: "unreachable" };
  if (author[1].toLowerCase() !== input.handle.toLowerCase()) {
    return { kind: "wrong-author", author: author[1] };
  }

  const html = typeof body.html === "string" ? body.html : "";
  const paragraph = FIRST_PARAGRAPH.exec(html);
  if (!paragraph) return { kind: "no-binding" };

  // Corroborate the author against the tail before trusting the text. Without
  // this, `author_url` is certifying words it does not own. Fails closed when
  // there is no tail: an embed that names nobody for its own text is not
  // evidence, and no shape X actually serves omits it.
  const tail = TAIL_PERMALINK.exec(html.slice(paragraph.index + paragraph[0].length));
  if (!tail) return { kind: "unreachable" };
  // Both halves matter. A different handle is the retweet vector. The same
  // handle with a different post id is text from some OTHER post of theirs,
  // which cannot stand in for the post the claim actually named.
  if (tail[1].toLowerCase() !== input.handle.toLowerCase() || tail[2] !== input.postId) {
    return { kind: "wrong-author", author: tail[1] };
  }

  // One parser, two sources: the address the live post commits to is read by
  // the same function that reads the on-chain one, so the two cannot drift.
  return parseBindingAddress([{ text: postText(paragraph[1]) }]) === input.address
    ? { kind: "verified" }
    : { kind: "no-binding" };
}

/** Embed markup back to plain text. Tags become a SPACE, never nothing: the
 * address pattern is word-boundary anchored, so gluing an adjacent token onto
 * the address would hide a binding line that is really there. */
function postText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—");
}
