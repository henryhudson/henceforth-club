import type { XArchive } from "../parseArchive";
import ProfileView from "./ProfileView";

/**
 * Shared profile page shell used by both `/x/<handle>` and `/x/tx/<txid>`.
 * When `txid` is present the profile was read from Bitcoin and we link the
 * transaction; otherwise it's a pre-inscription live preview.
 */
export default function ProfilePage({
  archive,
  txid,
}: {
  archive: XArchive;
  txid?: string | null;
}) {
  return (
    <main className="min-h-screen bg-background pt-16">
      <header className="mx-auto max-w-2xl px-6 py-8 text-center">
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-muted">
          Reclaimed from X · {txid ? "on Bitcoin" : "preview"}
        </p>
        {txid ? (
          <a
            href={`https://whatsonchain.com/tx/${txid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block break-all font-mono text-[11px] text-accent hover:underline"
          >
            {txid.slice(0, 16)}&hellip;{txid.slice(-8)} &#8599;
          </a>
        ) : (
          <p className="mt-2 text-[11px] text-muted">
            Not yet inscribed &mdash; live preview from X
          </p>
        )}
      </header>
      <ProfileView archive={archive} />
    </main>
  );
}
