// Plain-English copy for every reason the job routes can refuse a request —
// pure, total: an unrecognised reason still gets an honest, generic message
// rather than a blank error.

export function jobRefusalMessage(reason: unknown): string {
  switch (reason) {
    case "bad-input":
      return "That didn't look like a file upload — try dropping the export again.";
    case "too-large":
      return "That export is too large for the web archive right now.";
    case "bad-zip":
      return "Those files did not read as a zip archive.";
    case "no-tweets-file":
      return "No tweets.js was found in that export.";
    case "no-posts":
      return "That export has no posts to archive.";
    case "no-handle":
      return "No account handle was found in that export.";
    case "at-capacity":
      return "The archive worker is at capacity right now — try again shortly.";
    case "store-unavailable":
      return "The archive service is temporarily unavailable — try again shortly.";
    case "price-unavailable":
      return "The live exchange rate is unavailable, so the price can't be converted honestly right now. Nothing was charged — try again shortly.";
    case "price-below-fee":
      return "At today's exchange rate, the £2 leg of the price converts to too few satoshis to move on-chain, so it can't honestly be offered. Nothing was charged.";
    default:
      return "Something went wrong reading that export. Nothing was charged — try again.";
  }
}
