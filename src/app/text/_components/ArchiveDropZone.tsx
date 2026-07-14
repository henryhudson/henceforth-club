"use client";

import { useState } from "react";
import { parseArchive } from "../parseArchive";
import { portable, type Portable } from "../source";
import { dropFailureMessage, selectArchiveFiles } from "../dropZone";
import ProfileView from "./ProfileView";
import CostQuote from "./CostQuote";
import FileDropLabel from "./FileDropLabel";

export default function ArchiveDropZone({ gbpPerBsv }: { gbpPerBsv?: number }) {
  const [source, setSource] = useState<Portable | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(list: FileList | null) {
    setError(null);
    const picked = selectArchiveFiles(list ? Array.from(list) : []);
    if (!picked.ok) return setError(dropFailureMessage(picked.reason));
    try {
      setSource(portable(parseArchive(
        await picked.tweets.text(),
        await picked.profile.text(),
        await picked.account.text(),
      )));
    } catch {
      setError(dropFailureMessage("unparseable"));
    }
  }

  return (
    <div>
      <div className="mx-auto max-w-2xl px-6 pb-6">
        <FileDropLabel onFiles={onFiles}>
          Choose or drop{" "}
          <span className="text-foreground">tweets.js · profile.js · account.js</span>{" "}
          from the export X emailed you
          <span className="mt-1 block text-xs">Parsed in your browser. Nothing is uploaded.</span>
        </FileDropLabel>
        {error && <p className="mt-3 text-sm text-accent-orange">{error}</p>}
      </div>

      {source && (
        <>
          <ProfileView archive={source.archive} isPreview />
          <div className="mx-auto max-w-2xl px-6 pb-10">
            <CostQuote source={source} gbpPerBsv={gbpPerBsv} />
          </div>
        </>
      )}
    </div>
  );
}
