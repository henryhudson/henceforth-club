import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { getRedis } from "@/lib/redis";

type DocFull = {
  id: string;
  repoName: string;
  type: string;
  title: string;
  date: string;
  html: string;
};

export const dynamic = "force-dynamic";

async function loadDoc(id: string): Promise<DocFull | null> {
  const redis = getRedis();
  if (redis) {
    const d = await redis.get<DocFull>(`board:doc:${id}`);
    if (d) return d;
  }
  try {
    const file = path.join(process.cwd(), "content/board/docs", `${id}.json`);
    return JSON.parse(await fs.readFile(file, "utf8")) as DocFull;
  } catch {
    return null;
  }
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const id = slug.join("/");
  const doc = await loadDoc(id);

  if (!doc) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center text-muted">
        Doc not found.{" "}
        <Link href="/board/docs" className="text-accent-green underline">
          Back to Plans &amp; specs
        </Link>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-card-border px-4 py-2 text-sm">
        <Link href="/board/docs" className="shrink-0 text-accent-green underline">
          ← Plans &amp; specs
        </Link>
        <span className="truncate text-muted">{doc.title}</span>
      </div>
      {/* The doc is self-contained HTML (own inline <style>); an iframe isolates
          its theme from the site's dark globals.css. First-party content, so
          scripts (plan checkboxes) + same-origin (localStorage) are allowed. */}
      <iframe
        srcDoc={doc.html}
        title={doc.title}
        sandbox="allow-scripts allow-same-origin"
        className="min-h-0 w-full flex-1 bg-white"
      />
    </main>
  );
}
