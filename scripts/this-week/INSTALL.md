# This Week in Parliament — weekly digest automation (Mac mini)

Generates the weekly digest every **Tuesday 20:00 (local)**, writes a
`status:"draft"` file, commits + pushes it, and emails you the digest for
review. A draft is hidden from the archive **and 404s at its own URL** (the
`[week]` route only renders `published` issues) — so you review from the email
(it contains the full digest) or the JSON, then flip `"draft"` → `"published"`,
which is what makes it render live.

## Files

- `PROMPT.md` — the editor instructions handed to Claude Code (research, verify, write, validate).
- `run-weekly.sh` — the wrapper: computes the week, runs Claude, commits/pushes, emails.
- `email-body.mjs` — builds the plain-text review email from the JSON.
- `com.henryhudson.thisweek-digest.plist` — the launchd schedule (Tue 20:00 local).

## Prerequisites on the Mac mini

- A checkout of this repo (default path `~/Programming/Main/henceforth-club`) with `npm install` done.
- The `claude` CLI installed and authenticated (the same one your daily review uses).
- A working mailer (whatever your daily review emails with).

## Install

```sh
cd ~/Programming/Main/henceforth-club
git pull                              # get scripts/this-week/

chmod +x scripts/this-week/run-weekly.sh

# 1) Wire the email line. Either set SEND_EMAIL to your mailer, or edit the
#    send_email() function in run-weekly.sh. It receives the subject as $1 and
#    the body on stdin; $MAILTO is exported. Example with msmtp:
#       export SEND_EMAIL='msmtp -t'   # (and put To:/Subject: in a header — or adapt)
#    If /usr/bin/mail already sends on this machine, no change is needed.

# 2) Adjust config at the top of run-weekly.sh if needed:
#    HENCEFORTH_REPO, CLAUDE_BIN, CLAUDE_MODEL (default: opus), MAILTO.
#    Confirm the --permission-mode flag matches your CLI version (it uses
#    bypassPermissions; older CLIs use --dangerously-skip-permissions).

# 3) Install the launchd job (edit the plist's script path first if the repo
#    is not at ~/Programming/Main/henceforth-club).
cp scripts/this-week/com.henryhudson.thisweek-digest.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.henryhudson.thisweek-digest.plist 2>/dev/null
launchctl load   ~/Library/LaunchAgents/com.henryhudson.thisweek-digest.plist
```

## Test it now (without waiting for Tuesday)

```sh
# Dry of the whole pipeline (this WILL generate, commit, push, and email):
~/Programming/Main/henceforth-club/scripts/this-week/run-weekly.sh

# Or trigger via launchd:
launchctl start com.henryhudson.thisweek-digest

# Watch the log:
tail -f ~/Library/Logs/thisweek-digest.log
```

## Verify the schedule

```sh
launchctl list | grep thisweek-digest
```

## Notes

- **Timing:** launchd fires at 20:00 *local* time, so it tracks BST/GMT automatically.
- **The Tuesday → coming-Wednesday rule** is handled in the wrapper (it computes the
  Wednesday and passes it to the agent), so it can never regenerate last week's issue.
- **To publish a draft:** edit `content/this-week/<date>.json`, set
  `"status": "published"`, and push. Vercel redeploys and it appears in the archive.
- **Failures email you too** (subject `FAILED: …`), so a broken run is never silent.
