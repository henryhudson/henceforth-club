import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/board-auth";
import { loadCommit, loadTransactions, saveTransactions } from "@/lib/ledger/store";
import { validateTransaction } from "@/lib/ledger/validate";
import { periodFor } from "@/lib/ledger/periods";
import type { Transaction } from "@/lib/ledger/types";

export const runtime = "nodejs";

// This endpoint gates itself. src/middleware.ts matches ["/board", "/board/:path*"]
// and does not cover /api, so without the check below this would serve the
// company's complete financial history to anyone who asked for it.

async function authorised(): Promise<boolean> {
  const secret = process.env.BOARD_COOKIE_SECRET ?? "";
  if (!secret) return false;
  return verifySession((await cookies()).get("board_session")?.value, secret);
}

const deny = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

const byDateThenId = (a: Transaction, b: Transaction) =>
  a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

/**
 * A committed period is read-only: editing a transaction inside one silently
 * invalidates every inclusion proof drawn against that period's root.
 * Returns the period's label when it is locked, otherwise null.
 */
async function lockedPeriodLabel(date: string): Promise<string | null> {
  const period = periodFor(date);
  if (!period) return null;
  return (await loadCommit(period.id)) ? period.label : null;
}

export async function GET() {
  if (!(await authorised())) return deny();
  return NextResponse.json({ transactions: await loadTransactions() });
}

export async function POST(req: Request) {
  if (!(await authorised())) return deny();

  let body: { transactions?: Partial<Transaction>[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const incoming = body.transactions ?? [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: "no transactions" }, { status: 400 });
  }

  const errors = incoming.flatMap((t, i) =>
    validateTransaction(t).map((e) => `row ${i + 1}: ${e}`),
  );
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  for (const t of incoming) {
    const locked = await lockedPeriodLabel(t.date as string);
    if (locked) {
      return NextResponse.json(
        { error: `${locked} is committed and read-only` },
        { status: 409 },
      );
    }
  }

  const existing = await loadTransactions();
  // Identifiers must never collide with a seeded one or with each other, and
  // must remain stable: they are hashed into the Merkle leaf.
  const stamp = Date.now().toString(36);
  const added = incoming.map(
    (t, i) => ({ ...t, id: `n${stamp}${i.toString(36)}` }) as Transaction,
  );

  await saveTransactions([...existing, ...added].sort(byDateThenId));
  return NextResponse.json({ added: added.length, ids: added.map((t) => t.id) });
}

export async function PATCH(req: Request) {
  if (!(await authorised())) return deny();

  let body: { transaction?: Transaction };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const next = body.transaction;
  if (!next?.id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const errors = validateTransaction(next);
  if (errors.length) return NextResponse.json({ errors }, { status: 400 });

  const list = await loadTransactions();
  const current = list.find((t) => t.id === next.id);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Both the period it is leaving and the period it is joining must be open,
  // or a row could be moved out of a committed period and break its root.
  for (const date of new Set([current.date, next.date])) {
    const locked = await lockedPeriodLabel(date);
    if (locked) {
      return NextResponse.json(
        { error: `${locked} is committed and read-only` },
        { status: 409 },
      );
    }
  }

  await saveTransactions(
    list.map((t) => (t.id === next.id ? { ...next, id: current.id } : t)).sort(byDateThenId),
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await authorised())) return deny();

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const list = await loadTransactions();
  const target = list.find((t) => t.id === id);
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const locked = await lockedPeriodLabel(target.date);
  if (locked) {
    return NextResponse.json({ error: `${locked} is committed and read-only` }, { status: 409 });
  }

  await saveTransactions(list.filter((t) => t.id !== id));
  return NextResponse.json({ ok: true });
}
