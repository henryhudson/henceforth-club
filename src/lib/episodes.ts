export type Episode = {
  number: number;
  slug: string;
  title: string;
  dek: string;
  published: boolean;
  durationSec?: number; // set from the rendered mp4
  music?: { season: string; piece: string };
  concepts?: string[];
  codeAlong?: string[];
  transcript?: string[];
  video?: { mp4: string };
};

export const episodes: Episode[] = [
  {
    number: 1,
    slug: "what-is-henceforth",
    title: "What is Henceforth?",
    dek: "A calculator you can teach — that also writes Bitcoin.",
    published: true,
    durationSec: 98,
    music: { season: "Spring", piece: "Vivaldi · Allegro (RV 269 i)" },
    concepts: [
      "FORTH is a calculator you talk to in postfix: 2 3 + .",
      "You can teach it new words — : double 2 * ; — then reuse them.",
      "The same machine writes Bitcoin Script, and a payment reads like a sentence.",
    ],
    // Curated to commands that run on a fresh install — tutorial-only lesson
    // words (program-intro, henceforth?) are excluded; a new app hasn't defined them.
    codeAlong: [
      "2 3 +",
      ".",
      ": double  2 * ;",
      "21 double .",
      "SCRIPT-BEGIN",
      "OP_DUP OP_HASH160 OP_EQUALVERIFY OP_CHECKSIG",
      "SCRIPT-END",
      ': pay-rent  1000 s" 1Q88RPbgtGfaDvQYd9Yx3UC86vAhcDSjob" send ;',
    ],
    transcript: [
      "so — what IS this thing?",
      "watch. it answers by doing.",
      "give it two numbers… and +.",
      "it added them. it's a calculator.",
      "but here's the good part —",
      "i just taught it a word.",
      "double means times two.",
      "see that? it knows double now.",
      "words you make. that's the idea.",
      "now… the other half.",
      "same prompt. watch closely.",
      "these are bitcoin words.",
      "that's the shape of a coin-lock.",
      "same machine. just more words.",
      "one last word — read it slow.",
      "pay rent: send 1000 there.",
      "it reads like a sentence.",
      "and it's also a payment.",
      "that's henceforth.",
      "one prompt. you teach it. let's go.",
    ],
    video: { mp4: "/learn/what-is-henceforth/episode.mp4" },
  },
  {
    number: 2,
    slug: "the-stack",
    title: "The Stack",
    dek: "Numbers live in a pile — newest on top, newest off first.",
    published: false,
    music: { season: "Summer", piece: "Vivaldi · Presto (RV 315 iii)" },
  },
  {
    number: 3,
    slug: "backwards-maths",
    title: "Why the maths looks backwards",
    dek: "Postfix, and why the stack is the parentheses.",
    published: false,
    music: { season: "Autumn", piece: "Vivaldi · Allegro (RV 293 i)" },
  },
];

const byNumber = [...episodes].sort((a, b) => a.number - b.number);

export function publishedEpisodes(): Episode[] {
  return byNumber.filter((e) => e.published);
}

export function getEpisode(slug: string): Episode | undefined {
  return episodes.find((e) => e.slug === slug);
}

// Neighbours by episode number across ALL episodes, so the page can tease an
// unpublished "next … soon". The page decides whether to link based on .published.
export function adjacentEpisodes(slug: string): { prev?: Episode; next?: Episode } {
  const i = byNumber.findIndex((e) => e.slug === slug);
  if (i === -1) return {};
  return { prev: byNumber[i - 1], next: byNumber[i + 1] };
}

export function formatDuration(sec?: number): string | undefined {
  if (!sec) return undefined;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
