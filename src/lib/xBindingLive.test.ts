import { describe, expect, it, vi } from "vitest";
import { PrivateKey } from "@bsv/sdk";
import { verifyBindingPost } from "./xBindingLive";

const ADDRESS = PrivateKey.fromRandom().toPublicKey().toAddress();
const HANDLE = "henryhudson6";
const POST_ID = "896523232098078720";

/** The embed shape X actually returns: the post text lives in the first <p>,
 * and the display-name attribution sits outside it, in the trailing &mdash;. */
function oembed(input: { author: string; text: string }) {
  return {
    url: `https://x.com/${input.author}/status/${POST_ID}`,
    author_name: "a free-form display name",
    author_url: `https://x.com/${input.author}`,
    html:
      `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">${input.text}</p>` +
      `&mdash; someone (@${input.author}) <a href="https://x.com/${input.author}/status/${POST_ID}">August 13, 2017</a></blockquote>`,
  };
}

/** A RETWEET, which is the shape that broke the author check. X serves the
 * RETWEETER in `author_url` but the ORIGINAL author's text in the first <p>,
 * and the attribution tail links to the original author AND the original
 * status id — both different from the ones the claim named. */
function retweetOembed(input: { retweeter: string; originalAuthor: string; originalPostId: string; text: string }) {
  return {
    url: `https://x.com/${input.retweeter}/status/${POST_ID}`,
    author_name: "a free-form display name",
    author_url: `https://x.com/${input.retweeter}`,
    html:
      `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">${input.text}</p>` +
      `&mdash; ${input.originalAuthor} (@${input.originalAuthor}) ` +
      `<a href="https://x.com/${input.originalAuthor}/status/${input.originalPostId}">June 27, 2018</a></blockquote>`,
  };
}

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });

const bindingLine = `Verifying my Henceforth identity: ${ADDRESS}`;

describe("verifyBindingPost", () => {
  it("refuses a post authored by someone else, whatever their display name says", async () => {
    // The attacker posts a real binding line from their own account and sets
    // their display name to the victim's handle. Only author_url is owned.
    const body = oembed({ author: "attacker", text: bindingLine });
    body.author_name = HANDLE;
    const fetchFn = vi.fn(async () => jsonResponse(body));

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "wrong-author", author: "attacker" });
  });

  it("verifies a post authored by the handle carrying the binding line", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(oembed({ author: HANDLE, text: bindingLine })));

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "verified" });
  });

  it("matches the handle case-insensitively", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(oembed({ author: "BarackObama", text: bindingLine })));

    const result = await verifyBindingPost({ handle: "barackobama", postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "verified" });
  });

  it("recovers the binding line through embed markup and escaped entities", async () => {
    // X wraps links in anchors and escapes text; stripping tags must not glue
    // neighbouring words onto the address, which is word-boundary anchored.
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        oembed({
          author: HANDLE,
          text: `me &amp; my key<a href="https://t.co/x">.</a>Verifying my Henceforth identity: ${ADDRESS}<a href="https://t.co/y">link</a>`,
        }),
      ),
    );

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "verified" });
  });

  it("refuses when the live post carries no binding line for that address", async () => {
    const other = PrivateKey.fromRandom().toPublicKey().toAddress();
    const fetchFn = vi.fn(async () =>
      jsonResponse(oembed({ author: HANDLE, text: `Verifying my Henceforth identity: ${other}` })),
    );

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "no-binding" });
  });

  it("refuses a post id X does not serve", async () => {
    const fetchFn = vi.fn(async () => new Response("<!DOCTYPE html>", { status: 404, headers: { "content-type": "text/html;charset=utf-8" } }));

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "not-found" });
  });

  it("refuses an archive whose binding post has no id, without calling X", async () => {
    const fetchFn = vi.fn(async () => jsonResponse(oembed({ author: HANDLE, text: bindingLine })));

    const result = await verifyBindingPost({ handle: HANDLE, postId: "", address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "not-found" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("fails closed on a non-JSON 200, a transport error, and a timeout", async () => {
    const nonJson = vi.fn(async () => new Response("<html>whoops</html>", { status: 200, headers: { "content-type": "text/html" } }));
    const transportError = vi.fn(async () => { throw new TypeError("network down"); });
    const timeout = vi.fn(async () => { throw new DOMException("The operation was aborted.", "TimeoutError"); });

    for (const fetchFn of [nonJson, transportError, timeout]) {
      const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);
      expect(result).toEqual({ kind: "unreachable" });
    }
  });

  it("fails closed when the embed names an author X could not resolve to a handle", async () => {
    const body = oembed({ author: HANDLE, text: bindingLine });
    body.author_url = "https://x.com/";
    const fetchFn = vi.fn(async () => jsonResponse(body));

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "unreachable" });
  });

  it("refuses a retweet: the retweeter's author_url must not certify another account's text", async () => {
    // The live vector, reproduced from a real oEmbed response on 2026-07-21.
    // The attacker posts a binding line naming the VICTIM's address, the victim
    // retweets it, and X then serves that text under the victim's author_url.
    // One tap by the victim is the whole exploit — the author check passes and
    // the first paragraph carries a genuine binding line.
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        retweetOembed({
          retweeter: HANDLE,
          originalAuthor: "attacker",
          originalPostId: "1012002789747195904",
          text: bindingLine,
        }),
      ),
    );

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "wrong-author", author: "attacker" });
  });

  it("refuses a quote-style embed whose tail names the requested handle but a different post", async () => {
    // Same handle, different status id: the text being certified is not the
    // post the claim named, so it cannot stand in for it.
    const fetchFn = vi.fn(async () =>
      jsonResponse(
        retweetOembed({
          retweeter: HANDLE,
          originalAuthor: HANDLE,
          originalPostId: "999999999999999999",
          text: bindingLine,
        }),
      ),
    );

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "wrong-author", author: HANDLE });
  });

  it("still verifies an ordinary post, whose tail names the same handle and the same post", async () => {
    // Guards against the retweet refusal swallowing the happy path: the normal
    // embed's tail already points at exactly the requested handle and id.
    const fetchFn = vi.fn(async () => jsonResponse(oembed({ author: HANDLE, text: bindingLine })));

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "verified" });
  });

  it("fails closed when the embed carries no attribution tail to corroborate the author", async () => {
    // No tail means nothing independently names the author of the text in the
    // first paragraph, so author_url alone would be certifying it again.
    const body = oembed({ author: HANDLE, text: bindingLine });
    body.html = `<blockquote class="twitter-tweet"><p lang="en" dir="ltr">${bindingLine}</p></blockquote>`;
    const fetchFn = vi.fn(async () => jsonResponse(body));

    const result = await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    expect(result).toEqual({ kind: "unreachable" });
  });

  it("asks X only for the post the claim names", async () => {
    // Typed on the signature rather than with a parameter binding: this is the one
    // mock whose arguments are read below, and a zero-argument mock gives `calls[0]`
    // an empty tuple type.
    const fetchFn = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async () =>
      jsonResponse(oembed({ author: HANDLE, text: bindingLine })));

    await verifyBindingPost({ handle: HANDLE, postId: POST_ID, address: ADDRESS }, fetchFn as unknown as typeof fetch);

    const url = String(fetchFn.mock.calls[0][0]);
    expect(url).toContain("publish.x.com/oembed");
    expect(url).toContain(encodeURIComponent(`https://x.com/${HANDLE}/status/${POST_ID}`));
  });
});
