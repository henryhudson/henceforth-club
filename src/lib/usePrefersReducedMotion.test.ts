import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  REDUCED_MOTION_QUERY,
  motionQueryStore,
  usePrefersReducedMotion,
  type MotionQuery,
} from "./usePrefersReducedMotion";

/** A media query the test can flip, standing in for the browser's own. The
 *  suite runs under node with no DOM, so the store is driven directly. */
function fakeQuery(matches: boolean) {
  const listeners = new Set<() => void>();
  const query: MotionQuery = {
    matches,
    addEventListener: (_type, listener) => { listeners.add(listener); },
    removeEventListener: (_type, listener) => { listeners.delete(listener); },
  };
  return {
    query,
    listenerCount: () => listeners.size,
    set(next: boolean) {
      query.matches = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

describe("the reduced-motion store", () => {
  it("asks for the preference by the name the stylesheet uses", () => {
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
  });

  it("answers what the query says now, not what it said when the store was built", () => {
    // The defect this replaces: every caller read `matches` once inside an
    // effect with an empty dependency array, so the answer was frozen at mount.
    const media = fakeQuery(false);
    const store = motionQueryStore(media.query);
    expect(store.getSnapshot()).toBe(false);
    media.set(true);
    expect(store.getSnapshot()).toBe(true);
  });

  it("tells its subscriber when the reader turns reduced motion on mid-page", () => {
    const media = fakeQuery(false);
    const store = motionQueryStore(media.query);
    const seen: boolean[] = [];
    store.subscribe(() => seen.push(store.getSnapshot()));
    media.set(true);
    media.set(false);
    expect(seen).toEqual([true, false]);
  });

  it("detaches the listener when the subscription ends, leaving nothing behind", () => {
    const media = fakeQuery(false);
    const store = motionQueryStore(media.query);
    let calls = 0;
    const unsubscribe = store.subscribe(() => { calls += 1; });
    expect(media.listenerCount()).toBe(1);
    unsubscribe();
    expect(media.listenerCount()).toBe(0);
    media.set(true);
    expect(calls).toBe(0);
  });

  it("keeps each subscriber separate, so one unmounting does not silence the rest", () => {
    const media = fakeQuery(false);
    const store = motionQueryStore(media.query);
    let first = 0, second = 0;
    const stopFirst = store.subscribe(() => { first += 1; });
    store.subscribe(() => { second += 1; });
    stopFirst();
    media.set(true);
    expect(first).toBe(0);
    expect(second).toBe(1);
  });
});

describe("the hook on the server", () => {
  it("renders without reaching for a browser, and says the reader wants motion", () => {
    // This runner has no DOM, so a hook that touched `window` while rendering
    // would throw here. It answers false, which is what keeps the markup the
    // server sends the same as the markup the client hydrates: nothing that
    // reaches the page may depend on this value at render time.
    const Probe = () => createElement("i", null, String(usePrefersReducedMotion()));
    expect(renderToStaticMarkup(createElement(Probe))).toBe("<i>false</i>");
  });
});
