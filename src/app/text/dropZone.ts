export type DropFailure =
  | "nothing-dropped"
  | "missing-tweets"
  | "missing-profile"
  | "missing-account"
  | "unparseable";

export type Selection =
  | { ok: true; tweets: File; profile: File; account: File }
  | { ok: false; reason: DropFailure };

/** Exact filenames, because a real X archive also contains tweets-media.js. */
const exactly = (files: File[], name: string): File | undefined =>
  files.find((f) => f.name.toLowerCase() === name);

export function selectArchiveFiles(files: File[]): Selection {
  if (files.length === 0) return { ok: false, reason: "nothing-dropped" };
  const tweets = exactly(files, "tweets.js");
  if (!tweets) return { ok: false, reason: "missing-tweets" };
  const profile = exactly(files, "profile.js");
  if (!profile) return { ok: false, reason: "missing-profile" };
  const account = exactly(files, "account.js");
  if (!account) return { ok: false, reason: "missing-account" };
  return { ok: true, tweets, profile, account };
}

export function dropFailureMessage(reason: DropFailure): string {
  switch (reason) {
    case "nothing-dropped":
      return "Nothing arrived. Ask X for your data, then drop the files from the archive's data folder.";
    case "missing-tweets":
      return "That folder has no tweets.js. Look inside the data folder of the archive X sent you — tweets-media.js is a different file.";
    case "missing-profile":
      return "Found tweets.js, but no profile.js. Both live in the archive's data folder.";
    case "missing-account":
      return "Found tweets.js and profile.js, but no account.js. All three live in the archive's data folder.";
    case "unparseable":
      return "Those files did not read as an X archive. Nothing left your browser, so nothing was lost — try the originals X gave you.";
  }
}
