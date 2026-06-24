"use client";

import { useState } from "react";
import { parseArchive, type XArchive } from "../parseArchive";
import { realArchive } from "../real";
import ProfileView from "./ProfileView";

export default function ArchiveExplorer() {
  const [archive, setArchive] = useState<XArchive>(realArchive);
  const [isSample, setIsSample] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    try {
      const find = (needle: string) =>
        Array.from(files).find((f) => f.name.toLowerCase().includes(needle));
      const tweets = find("tweets");
      const profile = find("profile");
      const account = find("account");
      if (!tweets || !profile || !account) {
        throw new Error(
          "Select your tweets.js, profile.js and account.js (in the archive's data/ folder).",
        );
      }
      const a = parseArchive(
        await tweets.text(),
        await profile.text(),
        await account.text(),
      );
      setArchive(a);
      setIsSample(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pb-6">
        <label className="block cursor-pointer rounded-xl border border-dashed border-card-border bg-card-bg/50 p-5 text-center text-sm text-muted transition hover:border-accent">
          <input
            type="file"
            multiple
            accept=".js,.json"
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          Drop your{" "}
          <span className="text-foreground">tweets.js · profile.js · account.js</span> to see
          your real profile
          <span className="mt-1 block text-xs">Parsed in your browser — nothing is uploaded.</span>
        </label>
        {error && <p className="mt-3 text-sm text-accent-orange">{error}</p>}
        {isSample && (
          <p className="mt-3 text-center text-xs text-muted">
            Live from X — @henryhudson6, 10 most recent. Drop a full archive above for all 1,230.
          </p>
        )}
      </div>
      <ProfileView archive={archive} />
    </div>
  );
}
