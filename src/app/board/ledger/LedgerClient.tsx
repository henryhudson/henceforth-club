"use client";

import { useMemo, useState } from "react";
import { CSV_HEADER, parsePastedRows, toCsv } from "@/lib/ledger/csv";
import { formatPence, sumPence } from "@/lib/ledger/money";
import { PERIODS } from "@/lib/ledger/periods";
import { validateTransaction } from "@/lib/ledger/validate";
import { ACCOUNTS, CATEGORIES, type Commit, type Transaction } from "@/lib/ledger/types";

type Props = {
  initialTransactions: Transaction[];
  commits: Record<string, Commit>;
};

type Draft = Partial<Transaction> & { id?: string };

const blank = (): Draft => ({
  date: "",
  account: ACCOUNTS[0],
  amount: "",
  description: "",
  category: CATEGORIES[CATEGORIES.length - 1],
  source: "",
});

export default function LedgerClient({ initialTransactions, commits }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [periodId, setPeriodId] = useState(PERIODS[PERIODS.length - 2].id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const period = PERIODS.find((p) => p.id === periodId)!;
  const commit = commits[periodId];
  const locked = Boolean(commit);

  const rows = useMemo(
    () =>
      transactions
        .filter((t) => t.date >= period.start && t.date <= period.end)
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    [transactions, period],
  );

  const net = sumPence(rows.map((r) => r.amount));
  const draftErrors = draft ? validateTransaction(draft) : [];
  // Field name is the text before the first colon — see validate.ts, which
  // prefixes every message with the field it concerns.
  const badField = (field: string) => draftErrors.some((e) => e.startsWith(`${field}:`));

  const pasted = useMemo(
    () =>
      parsePastedRows(pasteText).map((row) => ({ row, errors: validateTransaction(row) })),
    [pasteText],
  );
  const pasteHasErrors = pasted.some((p) => p.errors.length > 0);

  async function refresh() {
    const res = await fetch("/api/ledger");
    if (res.ok) setTransactions((await res.json()).transactions);
  }

  /** Every write funnels through here so a 409 always reads the same way. */
  async function send(init: RequestInit & { url?: string }) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(init.url ?? "/api/ledger", init);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(
          res.status === 409
            ? (body.error ?? "that period is committed and read-only")
            : (body.errors?.join("; ") ?? body.error ?? `failed (${res.status})`),
        );
        return false;
      }
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft || draftErrors.length) return;
    const ok = draft.id
      ? await send({
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transaction: draft }),
        })
      : await send({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transactions: [draft] }),
        });
    if (ok) setDraft(null);
  }

  async function remove(id: string) {
    await send({ url: `/api/ledger?id=${encodeURIComponent(id)}`, method: "DELETE" });
  }

  async function commitPaste() {
    if (!pasted.length || pasteHasErrors) return;
    const ok = await send({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactions: pasted.map((p) => p.row) }),
    });
    if (ok) {
      setPasteText("");
      setPasteOpen(false);
    }
  }

  function download() {
    saveFile(toCsv(rows), `ledger-${period.start}_${period.end}.csv`, "text/csv");
  }

  function saveFile(content: string, name: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * The proof endpoint returns hashes and period metadata only; the transaction
   * itself is added here, from the row already on screen, so the exported file
   * is self-contained — recompute the leaf from the transaction, walk the
   * sibling path, compare to the root the chain carries.
   */
  async function exportProof(t: Transaction) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/ledger/proof?id=${encodeURIComponent(t.id)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(body.error ?? `exporting the proof failed (${res.status})`);
        return;
      }
      saveFile(
        JSON.stringify({ transaction: t, ...body }, null, 2) + "\n",
        `ledger-proof-${t.id}.json`,
        "application/json",
      );
    } finally {
      setBusy(false);
    }
  }

  const cellClass = (bad: boolean) =>
    `w-full bg-transparent px-2 py-1 text-sm outline-none ${bad ? "text-accent-red ring-1 ring-accent-red/60" : ""}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-serif text-2xl">The ledger</h1>
        <p className="mt-1 text-sm text-muted">
          Henceforth Bitcoin Limited · registration 13829963. Amounts are held as integer
          pence; a committed period is read-only.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={periodId}
          onChange={(e) => { setPeriodId(e.target.value); setDraft(null); }}
          className="rounded border border-muted/30 bg-transparent px-3 py-2 text-sm"
        >
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>

        <span className="text-sm text-muted">
          {rows.length} {rows.length === 1 ? "row" : "rows"} · net{" "}
          <strong className={net < 0 ? "text-accent-red" : "text-accent-green"}>
            £{formatPence(net)}
          </strong>
        </span>

        {locked ? (
          <span
            title={`root ${commit.root} · txid ${commit.txid}`}
            className="rounded bg-accent-green/10 px-2 py-1 font-mono text-[11px] text-accent-green"
          >
            committed · {commit.root.slice(0, 12)}…
          </span>
        ) : (
          <span className="rounded bg-muted/10 px-2 py-1 text-[11px] text-muted">open</span>
        )}

        <button onClick={download} className="rounded border border-muted/30 px-3 py-2 text-sm">
          Export CSV
        </button>

        {!locked && (
          <>
            <button
              onClick={() => setDraft(blank())}
              disabled={busy}
              className="rounded border border-accent-green/40 px-3 py-2 text-sm text-accent-green"
            >
              Add row
            </button>
            <button
              onClick={() => setPasteOpen((v) => !v)}
              disabled={busy}
              className="rounded border border-accent-green/40 px-3 py-2 text-sm text-accent-green"
            >
              Paste many
            </button>
          </>
        )}
      </div>

      {message && (
        <p className="mb-4 rounded border border-accent-red/40 px-3 py-2 text-sm text-accent-red">
          {message}
        </p>
      )}

      {pasteOpen && !locked && (
        <section className="mb-6 rounded border border-muted/25 p-4">
          <p className="mb-2 text-sm text-muted">
            Paste rows from a statement — tab or comma separated, in the column order{" "}
            <code className="text-accent-green">{CSV_HEADER.join(", ")}</code>. A header line
            is ignored. Nothing is written until you confirm.
          </p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full rounded border border-muted/30 bg-transparent p-2 font-mono text-xs"
            placeholder="2025-08-01&#9;NatWest&#9;-19.00&#9;Domain renewal&#9;Website&#9;Statements/2025/NatWest"
          />
          {pasted.length > 0 && (
            <>
              <table className="mt-3 w-full text-xs">
                <tbody>
                  {pasted.map(({ row, errors }, i) => (
                    <tr key={i} className={errors.length ? "text-accent-red" : ""}>
                      <td className="py-1 pr-2 font-mono">{row.date}</td>
                      <td className="py-1 pr-2">{row.account}</td>
                      <td className="py-1 pr-2 text-right font-mono">{row.amount}</td>
                      <td className="py-1 pr-2">{row.description}</td>
                      <td className="py-1 text-muted">{errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                onClick={commitPaste}
                disabled={busy || pasteHasErrors}
                className="mt-3 rounded border border-accent-green/40 px-3 py-2 text-sm text-accent-green disabled:opacity-40"
              >
                {pasteHasErrors
                  ? `Fix ${pasted.filter((p) => p.errors.length).length} row(s) first`
                  : `Add ${pasted.length} row(s)`}
              </button>
            </>
          )}
        </section>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-muted/25 text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2">Date</th>
            <th className="py-2">Account</th>
            <th className="py-2 text-right">Amount</th>
            <th className="py-2">Description</th>
            <th className="py-2">Category</th>
            <th className="py-2">Source</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className="border-b border-muted/10">
              <td className="py-1 font-mono text-xs">{t.date}</td>
              <td className="py-1">{t.account}</td>
              <td className={`py-1 text-right font-mono ${t.amount.startsWith("-") ? "text-accent-red" : "text-accent-green"}`}>
                {t.amount}
              </td>
              <td className="py-1">{t.description}</td>
              <td className="py-1 text-muted">{t.category}</td>
              <td className="py-1 text-xs text-muted">{t.source}</td>
              {locked ? (
                <td className="py-1 text-right whitespace-nowrap">
                  <button
                    onClick={() => exportProof(t)}
                    disabled={busy}
                    title="Export this transaction's inclusion proof — it verifies against the committed root without disclosing any other row"
                    className="px-2 text-xs text-accent-green"
                  >
                    proof
                  </button>
                </td>
              ) : (
                <td className="py-1 text-right whitespace-nowrap">
                  <button onClick={() => setDraft({ ...t })} className="px-2 text-xs text-muted">edit</button>
                  <button
                    onClick={() => setDraft({ ...t, id: undefined })}
                    title="Copy every field into a new row — a recurring charge is one action and a date edit"
                    className="px-2 text-xs text-muted"
                  >
                    duplicate
                  </button>
                  <button onClick={() => remove(t.id)} disabled={busy} className="px-2 text-xs text-accent-red">delete</button>
                </td>
              )}
            </tr>
          ))}

          {draft && (
            <tr className="border-b border-accent-green/30 bg-accent-green/5">
              <td>
                <input
                  value={draft.date ?? ""}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                  placeholder="YYYY-MM-DD"
                  className={`${cellClass(badField("date"))} font-mono text-xs`}
                />
              </td>
              <td>
                <select
                  value={draft.account}
                  onChange={(e) => setDraft({ ...draft, account: e.target.value })}
                  className={cellClass(false)}
                >
                  {ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </td>
              <td>
                <input
                  value={draft.amount ?? ""}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  placeholder="-19.00"
                  className={`${cellClass(badField("amount"))} text-right font-mono`}
                />
              </td>
              <td>
                <input
                  value={draft.description ?? ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className={cellClass(badField("description"))}
                />
              </td>
              <td>
                <select
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className={cellClass(false)}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td>
                <input
                  value={draft.source ?? ""}
                  onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                  className={cellClass(false)}
                />
              </td>
              <td className="text-right whitespace-nowrap">
                <button
                  onClick={saveDraft}
                  disabled={busy || draftErrors.length > 0}
                  className="px-2 text-xs text-accent-green disabled:opacity-40"
                >
                  save
                </button>
                <button onClick={() => setDraft(null)} className="px-2 text-xs text-muted">cancel</button>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Typing is never blocked; the save is. An error shown while a field is
          half-typed is guidance, not a rejection. */}
      {draft && draftErrors.length > 0 && (
        <ul className="mt-2 text-xs text-accent-red">
          {draftErrors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
    </main>
  );
}
