// The pure core of the period-commitment script. Nothing here reads the store,
// the environment or the network — commit.mjs owns those edges, and this
// module owns everything worth asserting.
//
// The hashing, periods and money rules MUST agree byte for byte with
// src/lib/ledger/{merkle,periods,money}.ts: the page and the proof endpoint
// verify against the root this script broadcasts, and a broadcast root is
// unfixable. The script cannot import TypeScript, so the rules are mirrored
// here and commit-core.test.mjs pins the two implementations together — a
// drift in either turns the suite red before any money moves.
import { createHash } from "node:crypto";
import { LockingScript, OP, P2PKH, SatoshisPerKilobyte, Transaction, Utils } from "@bsv/sdk";

const sha256Hex = (text) => createHash("sha256").update(text, "utf8").digest("hex");

// ── Hashing, mirroring src/lib/ledger/merkle.ts ────────────────────────────

const FIELDS = ["id", "date", "account", "amount", "description", "category", "source"];
const SEPARATOR = "\u001f";

export function canonicalise(t) {
  return FIELDS.map((field) => String(t[field] ?? "").split(SEPARATOR).join(" ")).join(SEPARATOR);
}

export const leafHash = (t) => sha256Hex(`L:${canonicalise(t)}`);
const nodeHash = (left, right) => sha256Hex(`N:${left}${right}`);

/** Leaves must already be sorted. An odd node is carried up, never duplicated. */
export function buildRoot(leaves) {
  if (leaves.length === 0) throw new Error("cannot commit an empty period");
  let level = leaves;
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? nodeHash(level[i], level[i + 1]) : level[i]);
    }
    level = next;
  }
  return level[0];
}

// ── Periods, mirroring src/lib/ledger/periods.ts ───────────────────────────

const RANGES = [
  ["2021-12-01", "2023-01-31", "incorporation to 31 January 2023"],
  ["2023-02-01", "2024-01-31", "01 February 2023 to 31 January 2024"],
  ["2024-02-01", "2024-12-31", "01 February 2024 to 31 December 2024"],
  ["2025-01-01", "2025-12-31", "01 January 2025 to 31 December 2025"],
  ["2026-01-01", "2026-12-31", "01 January 2026 to 31 December 2026"],
];

export const PERIODS = RANGES.map(([start, end, label]) => ({
  id: `${start}_${end}`,
  label,
  start,
  end,
}));

// ── Money, mirroring src/lib/ledger/money.ts ───────────────────────────────

const AMOUNT = /^(-?)(\d+)\.(\d{2})$/;

function parseAmount(s) {
  const m = AMOUNT.exec(s ?? "");
  if (!m) return null;
  const [, sign, whole, frac] = m;
  const pence = Number(whole) * 100 + Number(frac);
  if (!Number.isSafeInteger(pence)) return null;
  return sign === "-" ? -pence : pence;
}

export function formatPence(pence) {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export const netPence = (rows) =>
  rows.reduce((total, t) => total + (parseAmount(t.amount) ?? 0), 0);

// ── Row shape, mirroring src/lib/ledger/validate.ts ────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s) {
  const parsed = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s;
}

export function rowErrors(t) {
  const errors = [];
  if (!t.id) errors.push("id: must not be empty — the identifier is hashed into the leaf");
  const date = t.date ?? "";
  if (!ISO_DATE.test(date) || !isRealDate(date)) errors.push(`date: ${JSON.stringify(date)} must be YYYY-MM-DD`);
  if (parseAmount(t.amount ?? "") === null) {
    errors.push(`amount: ${JSON.stringify(t.amount ?? "")} must be signed with exactly two decimal places`);
  }
  if (!(t.description ?? "").trim()) errors.push("description: must not be empty");
  return errors;
}

// ── The commitment decision ────────────────────────────────────────────────

/**
 * Decide what a run would commit, refusing anything that would broadcast a
 * root the page could not honour. Returns { ok: true, commitment } or
 * { ok: false, reason }. Pure: the caller supplies the store's contents.
 */
export function planCommit({ periodId, transactions, existingCommit = null, supersede = false }) {
  const period = PERIODS.find((p) => p.id === periodId) ?? null;
  if (!period) {
    return { ok: false, reason: `unknown period ${JSON.stringify(periodId)} — known: ${PERIODS.map((p) => p.id).join(", ")}` };
  }

  const rows = transactions.filter((t) => t.date >= period.start && t.date <= period.end);
  if (rows.length === 0) return { ok: false, reason: `no transactions fall inside ${period.label}` };

  const errors = rows.flatMap((t) => rowErrors(t).map((e) => `${t.id || "(no id)"} — ${e}`));
  const distinct = new Set(rows.map((t) => t.id));
  if (distinct.size !== rows.length) {
    const seen = new Set();
    const duplicate = rows.find((t) => (seen.has(t.id) ? true : (seen.add(t.id), false)));
    errors.push(`duplicate identifier ${duplicate.id} — an inclusion proof could not name its row`);
  }
  if (errors.length) return { ok: false, reason: errors.join("\n") };

  if (existingCommit && !supersede) {
    return {
      ok: false,
      reason: `${period.label} is already committed (root ${existingCommit.root}) — pass --supersede to amend, carrying the old root`,
    };
  }

  const pairs = rows
    .map((t) => ({ id: t.id, leaf: leafHash(t) }))
    .sort((a, b) => (a.leaf < b.leaf ? -1 : a.leaf > b.leaf ? 1 : 0));

  return {
    ok: true,
    commitment: {
      periodId: period.id,
      root: buildRoot(pairs.map((p) => p.leaf)),
      leaves: pairs.map((p) => p.leaf),
      transactionIds: pairs.map((p) => p.id),
      count: pairs.length,
      ...(existingCommit ? { supersedes: existingCommit.root } : {}),
    },
  };
}

// ── The output and the transaction ─────────────────────────────────────────

const push = (script, text) => script.writeBin(Utils.toArray(text, "utf8"));

/**
 * OP_FALSE OP_RETURN "HFLEDGER" "1" <period> <root> <count> [<superseded root>]
 * The count is not decoration: without it a verifier cannot detect a set with
 * transactions removed from its tail, because a shorter set still produces a
 * valid-looking root.
 */
export function commitmentScript({ periodId, root, count, supersedes }) {
  const script = new LockingScript().writeOpCode(OP.OP_FALSE).writeOpCode(OP.OP_RETURN);
  push(script, "HFLEDGER");
  push(script, "1");
  push(script, periodId);
  push(script, root);
  push(script, String(count));
  if (supersedes) push(script, supersedes);
  return script;
}

/** A fabricated source for the dry run: priced and signed against, never spent. */
export function fabricatedSource(address, satoshis = 10_000) {
  const source = new Transaction();
  source.addOutput({ lockingScript: new P2PKH().lock(address), satoshis });
  return source;
}

// A commitment transaction is ~350 bytes; at the pinned 100 satoshis per
// kilobyte both transaction processors advertise, the fee is ~35 satoshis.
// The ceiling is generous headroom, far below anything painful.
export const FEE_CEILING_SATS = 1_000;

/**
 * Build, price and sign one commitment transaction. The change guards are the
 * same as scripts/board/render-pdf.mjs: the sdk's fee() silently DELETES the
 * change output when change <= 0, so without them a low-value source would
 * burn the whole input as miner fee.
 */
export async function buildCommitmentTransaction({
  privateKey,
  sourceTransaction,
  sourceOutputIndex,
  lockingScript,
}) {
  const inputValue = sourceTransaction.outputs[sourceOutputIndex].satoshis ?? 0;

  const tx = new Transaction();
  tx.addInput({
    sourceTransaction,
    sourceOutputIndex,
    unlockingScriptTemplate: new P2PKH().unlock(privateKey),
  });
  tx.addOutput({ lockingScript, satoshis: 0 });
  tx.addP2PKHOutput(privateKey.toAddress());

  await tx.fee(new SatoshisPerKilobyte(100));

  const fee = tx.getFee();
  const change = tx.outputs.find((o) => o.change === true && (o.satoshis ?? 0) > 0);
  if (!change) {
    throw new Error(
      `refusing to sign: fee ${fee} satoshis would consume the entire ${inputValue}-satoshi input, leaving no change output`,
    );
  }
  if (fee > FEE_CEILING_SATS) {
    throw new Error(
      `refusing to sign: computed fee ${fee} satoshis exceeds the ${FEE_CEILING_SATS}-satoshi ceiling (input ${inputValue} satoshis)`,
    );
  }

  await tx.sign();
  return tx;
}
