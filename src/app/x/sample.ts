import type { XArchive } from "./parseArchive";

// A sample profile so the page shows a real layout before you load your own
// archive. Replace by dropping your tweets.js / profile.js / account.js.
export const sampleArchive: XArchive = {
  profile: {
    handle: "henryhudson",
    displayName: "Henry Hudson",
    bio: "iOS engineer. Building Henceforth — a Forth interpreter welded to a Bitcoin wallet.",
    location: "London",
    website: "https://henceforth.club",
    createdAt: "2011-03-01T00:00:00.000Z",
  },
  posts: [
    {
      id: "5",
      at: "Mon Jun 23 09:00:00 +0000 2026",
      text: "Reclaimed my whole X profile onto Bitcoin today. It lives on-chain now — mine, permanently.",
    },
    {
      id: "4",
      at: "Sun Jun 22 18:30:00 +0000 2026",
      text: "exactly the 2-PDA equivalence I keep going on about",
      replyToScreenName: "satoshi",
      replyToId: "3",
    },
    {
      id: "3",
      at: "Sat Jun 21 12:00:00 +0000 2026",
      text: "A Forth word and a Bitcoin Script are the same artifact. This isn't a coincidence.",
    },
    { id: "2", at: "Fri Jun 20 08:15:00 +0000 2026", text: "Shipping is a feature." },
    { id: "1", at: "Tue Mar 01 00:00:00 +0000 2011", text: "hello world" },
  ],
};
