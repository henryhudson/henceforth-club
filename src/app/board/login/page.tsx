"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/board-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: password.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      router.replace(params.get("from") || "/board");
      router.refresh();
    } else {
      setError(
        res.status === 429
          ? "Too many attempts — wait a moment."
          : "Incorrect password.",
      );
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <input
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        aria-label="Board password"
        className="rounded-xl border border-card-border bg-card-bg/50 px-4 py-3 text-foreground placeholder:text-muted/60 outline-none backdrop-blur-md transition-colors focus:border-accent-green"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-green/40 bg-accent-green/10 px-5 py-2.5 text-sm font-medium text-accent-green shadow-lg shadow-accent-green/10 backdrop-blur-md transition-all hover:border-accent-green/60 hover:bg-accent-green/20 hover:shadow-accent-green/20 disabled:opacity-50"
      >
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function BoardLoginPage() {
  // Computed after mount from the browser's local clock (not the server's UTC),
  // so the greeting matches the visitor's time of day. Null on first render to
  // keep server and client markup identical (no hydration mismatch).
  const [greeting, setGreeting] = useState<string | null>(null);
  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-6xl flex-col items-center justify-center px-6">
      <h1 className="mb-1 text-3xl font-bold tracking-tight text-foreground">
        {greeting ?? " "}
      </h1>
      <p className="mb-8 text-sm text-muted">Enter password to continue.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
