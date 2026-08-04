// Commit one accounting period's Merkle root to the chain.
//
// A LOCAL script, deliberately never a Vercel route: a route would put a funded
// private key in the deployment environment — spendable by anyone with
// dashboard access or through a compromised build — to serve a job that runs
// about four times a year. The page reads commitment status from the store;
// only this machine can broadcast.
//
// Usage (from henceforth-club):
//   node --env-file=.env.local scripts/ledger/commit.mjs <periodId>                 dry run
//   node --env-file=.env.local scripts/ledger/commit.mjs <periodId> --broadcast     spends
//   ... --supersede    amend an already-committed period, carrying the old root
//
// Every run defaults to a dry run: the transaction is built, priced and signed
// against a fabricated ten-thousand-satoshi source and its hex printed, but
// nothing leaves this machine and nothing is written back. Broadcasting
// requires --broadcast explicitly, and the commitment record is stored only
// after the transaction processor has accepted the transaction.
import { Redis } from "@upstash/redis";
import { PrivateKey, Transaction } from "@bsv/sdk";
import {
  PERIODS,
  buildCommitmentTransaction,
  commitmentScript,
  fabricatedSource,
  formatPence,
  netPence,
  planCommit,
} from "./commit-core.mjs";

const args = process.argv.slice(2);
const [periodId] = args.filter((a) => !a.startsWith("--"));
const broadcast = args.includes("--broadcast");
const supersede = args.includes("--supersede");

if (!periodId) {
  console.error("usage: node --env-file=.env.local scripts/ledger/commit.mjs <periodId> [--broadcast] [--supersede]");
  console.error(`known periods:\n${PERIODS.map((p) => `  ${p.id}  (${p.label})`).join("\n")}`);
  process.exit(1);
}

const wif = process.env.BOARD_ARCHIVE_WIF;
if (!wif) {
  console.error("BOARD_ARCHIVE_WIF is not set — run with --env-file=.env.local");
  process.exit(1);
}
const key = PrivateKey.fromWif(wif);
const address = key.toAddress();

const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN,
});

const transactions = (await redis.get("ledger:transactions")) ?? [];
const existingCommit = await redis.get(`ledger:commit:${periodId}`);

const plan = planCommit({ periodId, transactions, existingCommit, supersede });
if (!plan.ok) {
  console.error(plan.reason);
  process.exit(1);
}

const { commitment } = plan;
const period = PERIODS.find((p) => p.id === commitment.periodId);
const rows = transactions.filter((t) => t.date >= period.start && t.date <= period.end);

console.log(period.label);
console.log(`  rows   ${commitment.count}`);
console.log(`  net    £${formatPence(netPence(rows))}`);
console.log(`  root   ${commitment.root}`);
if (commitment.supersedes) console.log(`  supersedes ${commitment.supersedes}`);

const lockingScript = commitmentScript(commitment);

let sourceTransaction;
let sourceOutputIndex;
if (broadcast) {
  // Mempool-inclusive endpoint, as scripts/board/render-pdf.mjs: the plain
  // /unspent one is confirmed-only and hides freshly broadcast change.
  const unspentResp = await fetch(`https://api.whatsonchain.com/v1/bsv/main/address/${address}/unspent/all`);
  if (!unspentResp.ok) throw new Error(`fetching unspent outputs for ${address} failed: ${await unspentResp.text()}`);
  const { result } = await unspentResp.json();
  const spendable = (Array.isArray(result) ? result : []).filter((u) => !u.isSpentInMempoolTx);
  if (spendable.length === 0) {
    throw new Error(`no spendable outputs for ${address} — fund the archive key, or retry once its change propagates`);
  }
  const utxo = spendable.reduce((largest, u) => (u.value > largest.value ? u : largest));

  const sourceHexResp = await fetch(`https://api.whatsonchain.com/v1/bsv/main/tx/${utxo.tx_hash}/hex`);
  if (!sourceHexResp.ok) throw new Error(`fetching source tx ${utxo.tx_hash} failed: ${await sourceHexResp.text()}`);
  sourceTransaction = Transaction.fromHex((await sourceHexResp.text()).trim());
  sourceOutputIndex = utxo.tx_pos;
} else {
  sourceTransaction = fabricatedSource(address);
  sourceOutputIndex = 0;
}

const tx = await buildCommitmentTransaction({
  privateKey: key,
  sourceTransaction,
  sourceOutputIndex,
  lockingScript,
});

// The root travels as utf8 hex characters; its byte encoding must appear in
// the output script or the commitment would be to something else entirely.
const rootUtf8Hex = Buffer.from(commitment.root, "utf8").toString("hex");
if (!tx.outputs[0].lockingScript.toHex().includes(rootUtf8Hex)) {
  throw new Error("built transaction's output script does not carry the root — refusing");
}

if (!broadcast) {
  console.log(`  fee    ${tx.getFee()} satoshis (dry run against a fabricated source — nothing broadcast)`);
  console.log(`\n${tx.toHex()}`);
  console.log("\ndry run only. Pass --broadcast to spend and record the commitment.");
  process.exit(0);
}

const broadcastResp = await fetch("https://api.whatsonchain.com/v1/bsv/main/tx/raw", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ txhex: tx.toHex() }),
});
const body = (await broadcastResp.text()).trim().replace(/^"+|"+$/g, "");
if (!broadcastResp.ok || !/^[0-9a-fA-F]{64}$/.test(body)) {
  throw new Error(`broadcast failed: ${body}`);
}
const txid = body.toLowerCase();

// Log BEFORE the write-back: if the store write fails, the transaction is
// already paid for and the identifier must survive on screen to be
// hand-recorded.
console.log(`broadcast ${txid}`);

await redis.set(`ledger:commit:${commitment.periodId}`, {
  ...commitment,
  txid,
  broadcastAt: new Date().toISOString(),
});
console.log(`recorded ledger:commit:${commitment.periodId} — the page now shows the period locked`);
