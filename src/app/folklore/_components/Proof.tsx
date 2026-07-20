import { txExplorerUrl } from "@/lib/explorer";

export default function Proof({ txid }: { txid: string }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-8 text-sm text-muted">
      <p>
        This page is a convenience, not a dependency. The same archive is{" "}
        <a className="text-accent hover:underline" href={`/folklore/tx/${txid}`}>
          readable from the transaction
        </a>{" "}
        and from{" "}
        <a
          className="text-accent hover:underline"
          rel="noreferrer"
          target="_blank"
          href={txExplorerUrl(txid)}
        >
          a block explorer we do not run
        </a>
        . Plain readable text in an OP_RETURN output. No key, no server, no permission.
      </p>
    </section>
  );
}
