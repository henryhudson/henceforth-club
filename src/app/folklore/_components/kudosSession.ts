"use client";

import { useEffect, useState } from "react";

// The kudos session, read once per page load and shared by every control on
// the page — thirty feed rows must not mean thirty balance reads. The
// kudos_token cookie is httpOnly, so the only way the client learns whether
// a float stands behind it is to ask the float route; the promise caches at
// module level and every control awaits the same one.

export type KudosSession =
  | { kind: "funded"; float: number }
  | { kind: "visitor" }
  | { kind: "unavailable" };

let shared: Promise<KudosSession> | null = null;

/** The page's one session read — the float route, asked once. */
export function fetchKudosSession(): Promise<KudosSession> {
  shared ??= readSession();
  return shared;
}

async function readSession(): Promise<KudosSession> {
  try {
    const res = await fetch("/api/folklore/float");
    if (res.status === 401) return { kind: "visitor" };
    if (!res.ok) return { kind: "unavailable" };
    const body = (await res.json()) as { float?: unknown };
    return typeof body.float === "number"
      ? { kind: "funded", float: body.float }
      : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/** The shared session as a hook — null until the read lands. */
export function useKudosSession(): KudosSession | null {
  const [session, setSession] = useState<KudosSession | null>(null);
  useEffect(() => {
    let live = true;
    void fetchKudosSession().then((s) => {
      if (live) setSession(s);
    });
    return () => {
      live = false;
    };
  }, []);
  return session;
}
