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
    published: true,
    durationSec: 74,
    music: { season: "Summer", piece: "Vivaldi · Presto (RV 315 iii)" },
    concepts: [
      "Numbers pile up on a stack — the newest is always on top.",
      "Operators take from the top: + eats the top two, . prints the top.",
      "Take one too many and you hit underflow — the stack only returns what you put in.",
    ],
    codeAlong: ["3 4 5", "+", "+", ".", "10 20 30", ". . . ."],
    transcript: [
      "but where do the numbers go? onto a pile.",
      "a 3. a 4 on top. a 5 — newest always on top.",
      "that's the stack — a pile of numbers, just waiting.",
      "now watch + eat from it.",
      "+ takes the top two — the 5 and the 4 — and leaves a 9.",
      "again — 3 and 9. now just 12.",
      ". prints the top. there's the 12.",
      "you only ever touch the top.",
      "last on, first off — like a can of tennis balls.",
      "let's empty one right out. three on the pile, 30 on top.",
      "30… 20… 10. empty.",
      "now — one more than we put in. nothing's there.",
      "underflow. you hit the floor — and see, it didn't say ok.",
      "the stack gives back exactly what you put in.",
    ],
    video: { mp4: "/learn/the-stack/episode.mp4" },
  },
  {
    number: 3,
    slug: "backwards-maths",
    title: "Why the maths looks backwards",
    dek: "Postfix, and why the stack is the parentheses.",
    published: true,
    durationSec: 123,
    music: { season: "Autumn", piece: "Vivaldi · Allegro (RV 293 i)" },
    concepts: [
      "You write the numbers first, then the operation — 2 3 + . That's reverse Polish (postfix).",
      "The stack remembers as you go, so 2 3 + 4 * nests without any brackets.",
      "Because the last two numbers already sit on the stack, Fibonacci is one little word: : next-fib  tuck + ;.",
    ],
    codeAlong: [
      "2 3 +",
      ".",
      "2 3 + 4 *",
      ".",
      ": next-fib  tuck + ;",
      "1 1",
      "next-fib .s",
      "next-fib .s",
      "next-fib .s",
      "2drop",
      "2 + 3",
    ],
    transcript: [
      "you already know how to add.",
      "watch how this little machine wants it.",
      "you put the numbers down first —",
      "two, then three.",
      "then you say: add.",
      "five. the plus reached back and grabbed the two.",
      "numbers first, then the operation —",
      "that's reverse polish.",
      "and it stacks up — no brackets.",
      "two plus three is five —",
      "then five times four.",
      "twenty. the stack just remembers.",
      "now — one that's a headache in most languages.",
      "the fibonacci numbers — each one the last two, added.",
      "python needs a loop and two boxes to hold them.",
      "but our two numbers already sit on the stack.",
      "so it's one little word.",
      "take the pair, make the next one.",
      "start it with two ones.",
      "now nudge it forward — again and again.",
      "and it just keeps climbing —",
      "a hundred and forty-four — the twelfth.",
      "fibonacci. in one little word.",
      "clear the pair —",
      "and the school way? watch it break.",
      "no — the plus went looking for two numbers,",
      "and found nothing behind it.",
      "numbers first. that's the whole trick.",
      "henceforth.",
    ],
    video: { mp4: "/learn/backwards-maths/episode.mp4" },
  },
  {
    number: 4,
    slug: "words-from-words",
    title: "Words from words",
    dek: "Words made from words — all the way down to a payment.",
    published: true,
    durationSec: 113,
    music: { season: "Winter", piece: "Vivaldi · Allegro (RV 297 i)" },
    concepts: [
      "A colon definition teaches a new word: : double  2 * ; — then it's yours, used like any built-in.",
      "Bigger words are built from the small ones — quadruple is double double, square is dup *, cube is dup square *. Factoring, all the way down.",
      "Mistype a word and Henceforth points you home with a did you mean? hint — and a payment, : pay-rent … send ;, is defined the exact same way.",
    ],
    // Every word here is defined inline, so the whole lesson runs on a fresh
    // install. squre is the deliberate typo that triggers the did-you-mean hint.
    codeAlong: [
      ": double  2 * ;",
      "21 double .",
      "see double",
      ": quadruple  double double ;",
      "5 quadruple .",
      ": square  dup * ;",
      "7 square .",
      ": cube  dup square * ;",
      "3 cube .",
      "squre",
      ': pay-rent  1000 s" 1Q88RPbgtGfaDvQYd9Yx3UC86vAhcDSjob" send ;',
    ],
    transcript: [
      "last time — small words made big maths.",
      "but where do the small words come from?",
      "you make them. watch.",
      "double. you taught it this — episode one.",
      "still here. yours, and built-in, all at once.",
      "and you can look inside. there's its recipe.",
      "now — a bigger word, from the one you made.",
      "quadruple. just double — twice.",
      "twenty. a word, standing on a word.",
      "what if a word needs its number twice?",
      "you copy the top. that's dup.",
      "dup copies it — then times itself.",
      "forty-nine. seven, squared.",
      "cube stands on square — square stands on dup.",
      "small words. all the way down.",
      "and a word you never taught it?",
      "no — it only knows the words you made.",
      "but see — it points you home.",
      "one more. remember this — from episode one?",
      "that bitcoin word? it was a word i defined.",
      "same colon. same semicolon. same : ... ;",
      "a payment is just another word you teach.",
      "henceforth.",
    ],
    video: { mp4: "/learn/words-from-words/episode.mp4" },
  },
  {
    number: 5,
    slug: "moving-numbers",
    title: "Moving numbers",
    dek: "The shuffle words change where numbers sit — never what they are.",
    published: true,
    durationSec: 95,
    music: { season: "Bach", piece: "Brandenburg No. 3 · Allegro (BWV 1048 i)" },
    concepts: [
      "The stack only ever hands you its top — so to use a number twice, in a new order, or from underneath, you reach for a mover: dup, swap, over, rot, drop.",
      "Movers change where numbers sit, never what they are. swap flips the top two, so 10 4 swap - leaves 4 - 10 = -6 — same numbers, new order.",
      "A mover still needs operands — swap on a one-item stack hits the floor (underflow). Bitcoin Script has the same move, OP_DUP, which you'll wield in episode ten.",
    ],
    // Every command is typed live at the prompt, so the whole lesson runs on a
    // fresh install. The final bare swap is the deliberate underflow.
    codeAlong: [
      "7 dup .s",
      "2drop",
      "10 4 .s",
      "swap .s",
      "- .",
      "1 2 over .s",
      "2drop drop",
      "1 2 3 rot .s",
      "2drop drop",
      "7 8 drop .s",
      "swap",
    ],
    transcript: [
      "last time — you copied the top.",
      "that was dup. it made square.",
      "dup's got a family — words that just move numbers.",
      "because the stack only ever hands you the top.",
      "dup — copy the top. you've met this one.",
      "what if they're backwards?",
      "i want 4 minus 10 — but 4's on top.",
      "swap — flip the top two.",
      "minus six. same numbers, new order.",
      "and the one underneath?",
      "over — copy the second one up top.",
      "buried deeper?",
      "rot — bring the bottom one up.",
      "and when you don't need it?",
      "drop — throw the top away. pretty simple, huh?",
      "but they still need numbers to move.",
      "give swap one — it hits the floor.",
      "movers need a stocked stack.",
      "watch — none of them did math.",
      "they only move numbers. never change what they are.",
      "bitcoin has this same move — op_dup.",
      "you'll wield it in episode ten.",
      "henceforth.",
    ],
    video: { mp4: "/learn/moving-numbers/episode.mp4" },
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
