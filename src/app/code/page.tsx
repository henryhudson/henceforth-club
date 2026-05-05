import type { Metadata } from "next";
import FadeIn from "@/components/FadeIn";

export const metadata: Metadata = {
  title: "Code",
  description:
    "Open-source projects by Henry Hudson — SwiftBSV, FORTH tooling, Claude Code skills and plugins.",
};

const FEATURED = "SwiftBSV";

const REPOS: { name: string; description: string; tag: "swift" | "tex" | "tools" | "forth" }[] = [
  {
    name: "SwiftBSV",
    description:
      "Bitcoin SV comes to Swift. The open-source SDK that powers the Bitcoin layer in the Henceforth iOS app — Type42 (BRC-42) key derivation, SPV verification, ARC broadcasting, BRC-2 encryption.",
    tag: "swift",
  },
  {
    name: "SwiftBSVDocumentation",
    description:
      "LaTeX reference manual for SwiftBSV. Companion to the library's source.",
    tag: "tex",
  },
  {
    name: "HenceforthDocumentation",
    description:
      "LaTeX manual for the Henceforth app — every FORTH word by category, every Bitcoin Script opcode, the wallet architecture, and worked examples.",
    tag: "tex",
  },
  {
    name: "swift-claude-skills",
    description:
      "Swift and SwiftUI skills for Claude Code. Codifies modern API guidance — value types, @Observable, structured concurrency, Swift 6 isolation.",
    tag: "tools",
  },
  {
    name: "claude-plugins",
    description:
      "Personal Claude Code plugin marketplace. Skills, agents, and tooling that travel between projects.",
    tag: "tools",
  },
  {
    name: "forth",
    description:
      "Standalone FORTH experiments — predecessor work to the Henceforth interpreter.",
    tag: "forth",
  },
];

const TAG_LABELS: Record<string, string> = {
  swift: "Swift",
  tex: "LaTeX",
  tools: "Tooling",
  forth: "FORTH",
};

type GhRepo = {
  name: string;
  stargazers_count: number;
  pushed_at: string;
  html_url: string;
  language: string | null;
};

async function getRepo(name: string): Promise<GhRepo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/henryhudson/${name}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as GhRepo;
  } catch {
    return null;
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return "1 month ago";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

function StarIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-1.96c-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.18-1.48 3.14-1.17 3.14-1.17.62 1.58.23 2.75.11 3.04.73.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.79.56C20.21 21.39 23.5 17.08 23.5 12c0-6.35-5.15-11.5-11.5-11.5z" />
    </svg>
  );
}

async function RepoCard({
  name,
  description,
  tag,
  featured,
}: {
  name: string;
  description: string;
  tag: keyof typeof TAG_LABELS;
  featured?: boolean;
}) {
  const data = await getRepo(name);
  const url = data?.html_url ?? `https://github.com/henryhudson/${name}`;
  const stars = data?.stargazers_count ?? 0;
  const updated = data?.pushed_at ? formatRelative(data.pushed_at) : null;
  const language = data?.language;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`card-glow group flex flex-col rounded-xl border bg-card-bg/50 p-6 transition-colors h-full ${
        featured
          ? "border-accent-warm/40 hover:border-accent-warm sm:col-span-2"
          : "border-card-border hover:border-card-border-hover"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <GitHubIcon className="h-4 w-4 text-muted/60 group-hover:text-foreground transition-colors" />
          <h2
            className={`font-bold ${
              featured ? "text-lg text-accent-warm" : "text-base text-foreground"
            }`}
          >
            {name}
          </h2>
        </div>
        <span className="text-[10px] tracking-widest uppercase text-muted/40">
          {TAG_LABELS[tag]}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted flex-1">
        {description}
      </p>
      <div className="mt-5 flex items-center gap-4 text-xs text-muted/50">
        {language && <span>{language}</span>}
        <span className="inline-flex items-center gap-1">
          <StarIcon />
          {stars}
        </span>
        {updated && <span>updated {updated}</span>}
      </div>
    </a>
  );
}

export default async function CodePage() {
  const featured = REPOS.find((r) => r.name === FEATURED)!;
  const others = REPOS.filter((r) => r.name !== FEATURED);

  return (
    <div className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <div className="max-w-3xl">
            <p className="text-xs tracking-widest text-accent-warm/70 uppercase">
              Open Source
            </p>
            <h1 className="mt-6 text-5xl sm:text-7xl text-foreground font-bold">
              Code
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted max-w-2xl">
              The libraries, manuals, and tooling behind the apps. Every repo
              is public on GitHub — read it, fork it, or open an issue.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          <FadeIn>
            <RepoCard {...featured} featured />
          </FadeIn>
          {others.map((repo, i) => (
            <FadeIn key={repo.name} delay={(i + 1) * 0.06}>
              <RepoCard {...repo} />
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={0.4}>
          <div className="mt-16 text-center">
            <div className="section-line mb-12" />
            <p className="text-xs text-muted/50 mb-4 tracking-wider uppercase">
              More on GitHub
            </p>
            <a
              href="https://github.com/henryhudson"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-full border border-card-border bg-card-bg/50 px-8 py-4 text-sm text-muted hover:border-accent-warm hover:text-foreground transition-all"
            >
              <GitHubIcon className="h-5 w-5" />
              github.com/henryhudson
            </a>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
