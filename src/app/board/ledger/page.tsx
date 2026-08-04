import { loadAllCommits, loadTransactions } from "@/lib/ledger/store";
import LedgerClient from "./LedgerClient";

// Gated by src/middleware.ts, which matches ["/board", "/board/:path*"]. The
// /api/ledger endpoint the client writes through gates itself separately —
// the matcher does not cover /api.
export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const [transactions, commits] = await Promise.all([
    loadTransactions(),
    loadAllCommits(),
  ]);

  if (!transactions.length) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        No ledger data yet — run{" "}
        <code className="text-accent-green">
          node --env-file=.env.local scripts/ledger/seed.mjs
        </code>
      </main>
    );
  }

  return <LedgerClient initialTransactions={transactions} commits={commits} />;
}
