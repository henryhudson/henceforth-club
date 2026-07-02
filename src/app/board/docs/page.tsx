import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { getRedis } from "@/lib/redis";

type DocMeta = {
  id: string;
  repo: string;
  repoName: string;
  type: string;
  title: string;
  date: string;
};

export const dynamic = "force-dynamic";

const LOCAL = path.join(process.cwd(), "content/board/docs/index.json");
const REPO_ORDER = ["henceforth", "hansard", "deck", "site"];
const REPO_ACCENT: Record<string, string> = {
  henceforth: "text-accent-warm",
  hansard: "text-accent-green",
  deck: "text-accent",
  site: "text-muted",
};

async function loadIndex(): Promise<DocMeta[]> {
  const redis = getRedis();
  if (redis) {
    const idx = await redis.get<DocMeta[]>("board:docs:index");
    if (idx && idx.length) return idx;
  }
  try {
    return JSON.parse(await fs.readFile(LOCAL, "utf8")) as DocMeta[];
  } catch {
    return [];
  }
}

export default async function DocsPage() {
  const docs = await loadIndex();

  const byRepo = new Map<string, DocMeta[]>();
  for (const d of docs) {
    const arr = byRepo.get(d.repo);
    if (arr) arr.push(d);
    else byRepo.set(d.repo, [d]);
  }
  const repos = [...byRepo.keys()].sort(
    (a, b) => REPO_ORDER.indexOf(a) - REPO_ORDER.indexOf(b),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Plans &amp; specs</h1>
        <div className="flex gap-3 text-sm text-accent-green">
          <Link href="/board" className="underline">
            Board
          </Link>
          <Link href="/board/reports" className="underline">
            Reports
          </Link>
          <Link href="/board/week" className="underline">This week</Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">
        Superpowers design docs — specs and build plans across the apps.
      </p>

      {docs.length === 0 && (
        <p className="mt-10 text-muted">
          No docs synced yet — run{" "}
          <code className="text-accent-green">node --env-file=.env.local scripts/board/sync-docs.mjs</code>.
        </p>
      )}

      <div className="mt-10 flex flex-col gap-10">
        {repos.map((repo) => {
          const list = byRepo.get(repo)!;
          const accent = REPO_ACCENT[repo] ?? "text-muted";
          return (
            <section key={repo}>
              <h2 className="mb-4 border-b border-card-border pb-1 text-xl font-bold">
                <span className={accent}>{list[0].repoName}</span>
                <span className="ml-2 text-xs font-normal text-muted">{list.length} docs</span>
              </h2>
              <ul className="flex flex-col gap-2.5">
                {list.map((d) => (
                  <li key={d.id} className="flex items-baseline gap-3">
                    <span className="w-[5.5rem] shrink-0 text-xs text-muted">{d.date || "—"}</span>
                    <span
                      className={`shrink-0 rounded-full border border-card-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        d.type === "spec" ? "text-accent-green" : "text-accent"
                      }`}
                    >
                      {d.type}
                    </span>
                    <Link
                      href={`/board/docs/${d.id}`}
                      className="text-foreground underline-offset-2 hover:underline"
                    >
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
