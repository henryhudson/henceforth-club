"use client";

import { useSyncExternalStore } from "react";

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** The slice of `MediaQueryList` this module uses, named so the suite can hand
 *  the store a fake in a test runner that has no browser. */
export type MotionQuery = {
  matches: boolean;
  addEventListener: (type: "change", listener: () => void) => void;
  removeEventListener: (type: "change", listener: () => void) => void;
};

/** A media query as an external store: what it says now, and a subscription
 *  that fires when the answer changes.
 *
 *  The subscription is the whole point. Every caller on this site read
 *  `matchMedia(...).matches` once, inside an effect with an empty dependency
 *  array, so a reader who turned reduced motion on while the page was open kept
 *  the animation until the component remounted. Nothing anywhere in the source
 *  listened for the change event, in either the modern or the legacy form. */
export function motionQueryStore(query: MotionQuery) {
  return {
    getSnapshot: () => query.matches,
    subscribe: (onChange: () => void) => {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
  };
}

// One store for the page, built on first use and shared by every caller, so a
// page carrying thirty fading sections holds one media query rather than thirty.
// Built lazily because `window` does not exist while the server renders, and
// reached only through `subscribe` and `getSnapshot`, which React calls on the
// client alone.
let shared: ReturnType<typeof motionQueryStore> | null = null;
const clientStore = () => (shared ??= motionQueryStore(window.matchMedia(REDUCED_MOTION_QUERY)));

const subscribe = (onChange: () => void) => clientStore().subscribe(onChange);
const getSnapshot = () => clientStore().getSnapshot();
// The server cannot know the reader's preference, so it renders the moving
// version and the client corrects it. Nothing that reaches the markup should
// depend on this value, or hydration would disagree with itself.
const getServerSnapshot = () => false;

/** Whether the reader has asked their system for less motion, kept current.
 *
 *  A caller that draws inside an effect must list this value in that effect's
 *  dependency array. That is what makes a change take effect: the effect tears
 *  its loop down and builds the right one, rather than reading a preference
 *  once at mount and never again. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
