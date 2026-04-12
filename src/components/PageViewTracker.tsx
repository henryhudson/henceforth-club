"use client";

import { useEffect } from "react";

/**
 * Silently pings /api/hit once per session to increment the counter.
 * Uses sessionStorage so a reload in the same tab doesn't double-count.
 */
export default function PageViewTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("hf-visited")) return;
      sessionStorage.setItem("hf-visited", "1");
    } catch {
      // sessionStorage might be blocked; fall through and count anyway
    }
    fetch("/api/hit", { method: "POST" }).catch(() => {
      // Silent fail — analytics shouldn't break the site
    });
  }, []);

  return null;
}
