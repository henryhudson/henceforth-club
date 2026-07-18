/**
 * The profile the showroom shows to a visitor who has not yet asked X for their
 * own archive.
 *
 * It is read from Bitcoin, which is why it costs nothing to show and why it can
 * be the proof rather than a screenshot. It is not a default rendering of Henry's
 * timeline: a stranger arriving cold used to read his posts before understanding
 * what the site was for.
 */
export const WITNESS_HANDLE = "henryhudson6";

/**
 * The line that used to sit as free-floating hero copy — it is Henry's tweet,
 * so the landing pins the post itself instead of paraphrasing it as a tagline.
 * https://x.com/henryhudson6/status/2077655210709671962
 */
export const PINNED_POST = {
  id: "2077655210709671962",
  handle: "henryhudson6",
  displayName: "Hudson",
  text: "Talk to descendants about information your ancestors desired to pass on",
  at: "2026-07-16T07:22:57.000Z",
} as const;
