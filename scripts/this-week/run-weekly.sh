#!/bin/zsh
# This Week in Parliament — weekly digest generator.
# Runs on the Mac mini via launchd, Wednesday 14:00 LOCAL time, after Prime
# Minister's Questions (see the .plist).
#
# Division of labour:
#   - Claude Code (headless) does the EDITORIAL work: research, verify, write
#     the draft JSON, validate. (See PROMPT.md.)
#   - This wrapper does DELIVERY deterministically: compute the date window,
#     git commit/push, build the review email from the JSON, and send it.
#
# It writes a status:"draft" file, so the issue is NOT shown in the public
# archive until you flip "draft" -> "published". You review the email, then
# publish.
set -euo pipefail

# ─── config — adjust for the Mac mini ────────────────────────────────────────
REPO="${HENCEFORTH_REPO:-$HOME/Programming/Main/henceforth-club}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
CLAUDE_MODEL="${CLAUDE_MODEL:-opus}"
MAILTO="${MAILTO:-hnryhdsn@gmail.com}"
LOG="${LOG:-$HOME/Library/Logs/thisweek-digest.log}"

# How to send mail. Default pipes a plain-text body (stdin) to /usr/bin/mail.
# Wire this to whatever your daily-review email setup uses (msmtp, a custom
# send script, etc). It is given the subject as $1 and the body on stdin.
#   e.g. export SEND_EMAIL='msmtp -a default "$MAILTO"'   (with your own subject handling)
send_email() {
  local subject="$1"
  if [[ -n "${SEND_EMAIL:-}" ]]; then
    SUBJECT="$subject" MAILTO="$MAILTO" eval "$SEND_EMAIL"
  else
    /usr/bin/mail -s "$subject" "$MAILTO"
  fi
}
# ─────────────────────────────────────────────────────────────────────────────

exec >>"$LOG" 2>&1
echo "===== $(date '+%F %T %Z') run start ====="

cd "$REPO"
git pull --ff-only origin main || { echo "git pull failed"; exit 1; }

# Target Wednesday: the COMING Wednesday (today if today is Wednesday).
dow=$(date +%u)                                  # 1=Mon … 7=Sun
add=$(( (3 - dow + 7) % 7 ))                      # days until Wednesday (0 if Wed)
WED=$(date -v+"${add}"d +%Y-%m-%d)
START=$(date -v+"${add}"d -v-7d +%Y-%m-%d)
WINDOW_LABEL="$(date -j -f %Y-%m-%d "$START" '+%-d %b') – $(date -j -f %Y-%m-%d "$WED" '+%-d %b %Y')"
FILE="content/this-week/$WED.json"
echo "window: $WINDOW_LABEL  ->  $FILE"

# Editorial pass (writes + validates the draft only).
PROMPT="$(sed -e "s|{{WEEK_DATE}}|$WED|g" -e "s|{{START_DATE}}|$START|g" -e "s|{{WINDOW_LABEL}}|$WINDOW_LABEL|g" "$REPO/scripts/this-week/PROMPT.md")"
# NOTE: --permission-mode bypassPermissions runs unattended (writes files + runs
# bash). If your CLI version differs, match the flag your daily review uses
# (e.g. --dangerously-skip-permissions).
"$CLAUDE_BIN" -p "$PROMPT" \
  --model "$CLAUDE_MODEL" \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch" \
  --permission-mode bypassPermissions || { echo "claude run failed"; printf 'Digest generation FAILED for %s — claude run errored.\n' "$WINDOW_LABEL" | send_email "FAILED: This Week in Parliament $WED"; exit 1; }

# Verify the agent produced a parseable file.
if [[ ! -f "$FILE" ]]; then
  echo "ERROR: $FILE not written"
  printf 'Digest generation FAILED for %s — %s was not written.\n' "$WINDOW_LABEL" "$FILE" | send_email "FAILED: This Week in Parliament $WED"
  exit 1
fi
node -e "JSON.parse(require('fs').readFileSync('$FILE','utf8'))" || {
  echo "ERROR: invalid JSON in $FILE"
  printf 'Digest generation FAILED for %s — %s is not valid JSON.\n' "$WINDOW_LABEL" "$FILE" | send_email "FAILED: This Week in Parliament $WED"
  exit 1
}

# Inject the busiest-members snapshot deterministically — the editorial pass
# never writes overview.mostActive (see PROMPT.md step 6).
MOST_ACTIVE=$(node "$REPO/scripts/this-week/compute-most-active.mjs" "$START" "$WED")
node -e '
  const fs = require("fs")
  const [,, file, json] = process.argv
  const digest = JSON.parse(fs.readFileSync(file, "utf8"))
  const mostActive = JSON.parse(json)
  if (mostActive && digest.overview) digest.overview.mostActive = mostActive
  fs.writeFileSync(file, JSON.stringify(digest, null, 2) + "\n")
' "$FILE" "$MOST_ACTIVE"

# Commit + push (status stays "draft" — hidden from the public archive).
git add "$FILE"
git commit -m "This Week in Parliament: $WINDOW_LABEL (draft)" || echo "nothing to commit"
git push origin main || { echo "push failed"; exit 1; }

# Build the review email from the JSON and send it.
BODY="$(node "$REPO/scripts/this-week/email-body.mjs" "$FILE" 2>/dev/null)" || BODY="Digest written to $FILE (email-body build failed — open the file to review)."
print -r -- "$BODY" | send_email "This Week in Parliament — $WINDOW_LABEL (draft for review)"
echo "emailed $MAILTO"
echo "===== run done ====="
