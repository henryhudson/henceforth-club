import type { Metadata } from "next";
import Link from "next/link";
import { LINK_FLOOR_PENCE } from "@/lib/folkloreJob/linkQuote";
import { TXID_RE } from "../linkRecord";
import SubmitFlow from "./SubmitFlow";

/**
 * Metadata rides the same gate as the page body (the archive page's posture):
 * while the flag is off, the description honestly says submissions have not
 * opened; once it is on, a link preview describes the live form.
 */
export function generateMetadata(): Metadata {
  return process.env.FOLKLORE_SUBMIT_ENABLED === "true"
    ? {
        title: "Submit to the board",
        description: `Paste a transaction id and list it on the folklore board — a ${LINK_FLOOR_PENCE}p stamp you sign yourself, inscribed on Bitcoin. Comments too.`,
      }
    : {
        title: "Submit to the board",
        description: "Submit links and comments to the folklore board — not open yet.",
      };
}

// The honest closed state, nothing more — no form, no fetch. It exists so
// /folklore/submit is never a dead link or a broken form while the submit
// rail stays dark (the route answers 503 not-available for the same reason).
function SubmitStub() {
  return (
    <div className="min-h-screen bg-background pt-28">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Submit to the board</h1>
        <p className="mt-3 text-muted">
          Submissions are not open yet — links and comments arrive here once the payment rails have
          had their first funded end-to-end run. The board itself is live to read.
        </p>
        <div className="mt-6 text-sm">
          <Link href="/folklore" className="text-accent hover:underline">
            &larr; Back to the board
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The mechanical gate — the same flag the submit route fails closed on
 * (src/app/api/folklore/link/route.ts), read the same way: anything but the
 * exact string "true" renders only the stub above, and the form, the quote,
 * and the payment hand-off stay unreachable. The route keeps its own gate
 * regardless; this page merely refuses to show a form the rail would refuse.
 */
export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ parent?: string | string[] }>;
}) {
  if (process.env.FOLKLORE_SUBMIT_ENABLED !== "true") {
    return <SubmitStub />;
  }

  // A link's thread page can deep-link straight into comment mode with
  // ?parent=<txid>; anything that is not a plausible txid is simply ignored.
  const { parent } = await searchParams;
  const defaultParent = typeof parent === "string" && TXID_RE.test(parent) ? parent : undefined;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Submit to the board
        </p>
        <h1 className="mt-3 text-3xl font-bold text-foreground">
          {LINK_FLOOR_PENCE}p + the inscription fee
        </h1>
        <p className="mt-2 text-sm text-muted">
          A transaction id — a Twetch post, a Treechat post, an archive, anything on Bitcoin — or a
          comment, written to Bitcoin and ranked by kudos. The {LINK_FLOOR_PENCE}p floor deters spam
          and stays trivial for you.
        </p>
      </header>

      <SubmitFlow floorPence={LINK_FLOOR_PENCE} defaultParent={defaultParent} />

      <p className="mx-auto max-w-2xl px-6 pb-10 text-center text-sm text-muted">
        <Link href="/folklore" className="text-accent hover:underline">
          &larr; Back to the board
        </Link>
      </p>
    </div>
  );
}
