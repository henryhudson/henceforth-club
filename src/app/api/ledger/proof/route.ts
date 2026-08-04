import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/board-auth";
import { buildProof, verifyProof } from "@/lib/ledger/merkle";
import { periodById } from "@/lib/ledger/periods";
import { loadAllCommits } from "@/lib/ledger/store";

export const runtime = "nodejs";

// Gated the same way as /api/ledger: src/middleware.ts matches /board only,
// so this endpoint refuses on its own.
//
// The proof is drawn from the commitment's frozen leaves, never from the live
// store — no transaction content is loaded here at all, so the response cannot
// disclose another row's description, amount or account even by accident. That
// disclosure boundary is the property the whole design exists for.

async function authorised(): Promise<boolean> {
  const secret = process.env.BOARD_COOKIE_SECRET ?? "";
  if (!secret) return false;
  return verifySession((await cookies()).get("board_session")?.value, secret);
}

const deny = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  if (!(await authorised())) return deny();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const commits = await loadAllCommits();
  const commit = Object.values(commits).find((c) => c.transactionIds.includes(id));
  if (!commit) {
    return NextResponse.json(
      { error: "no committed period contains this transaction" },
      { status: 404 },
    );
  }

  const index = commit.transactionIds.indexOf(id);
  const leaf = commit.leaves[index];
  const steps = await buildProof(commit.leaves, index);

  // A commitment that cannot prove its own leaf is corrupt; refuse to serve it
  // rather than hand out a proof that will fail everywhere else.
  if (!(await verifyProof(leaf, steps, commit.root))) {
    return NextResponse.json({ error: "stored commitment is inconsistent" }, { status: 500 });
  }

  return NextResponse.json({
    transactionId: id,
    periodId: commit.periodId,
    periodLabel: periodById(commit.periodId)?.label ?? commit.periodId,
    leaf,
    steps,
    root: commit.root,
    count: commit.count,
    txid: commit.txid,
  });
}
