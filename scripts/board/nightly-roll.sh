#!/bin/zsh
# The 06:00 board roll, with a witness. The roll itself already fails loudly
# (a refused store write throws and exits non-zero); what it lacked was
# anyone to hear it — three, then four, silent mornings before a card count
# moving in a hand-read log gave it away. This wrapper leaves a dated verdict
# in content/board/.nightly-roll.json for the morning routine to read, and on
# failure raises a macOS notification so the laptop itself says so.
#
# LaunchAgent: ~/Library/LaunchAgents/club.henceforth.board-roll.plist
set -o pipefail
cd /Users/henryhudson/Programming/Main/henceforth-club || exit 1
STATUS=content/board/.nightly-roll.json
TODAY=$(date +%F)
OUT=$(node --env-file=.env.local scripts/board/hh-plan-update.mjs "$TODAY" '{"roll":true}' 2>&1)
CODE=$?
TAIL=$(printf '%s' "$OUT" | grep -v "localstorage-file\|trace-warnings" | tail -3)
python3 - "$TODAY" "$CODE" "$TAIL" "$STATUS" <<'PYEOF'
import json, sys, datetime
today, code, tail, status = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
json.dump({"date": today, "at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
           "ok": code == 0, "exitCode": code, "tail": tail}, open(status, "w"), indent=1)
PYEOF
printf '%s\n' "$OUT"
if [ "$CODE" -ne 0 ]; then
  osascript -e "display notification \"exit $CODE — read content/board/.nightly-roll.json\" with title \"Board roll FAILED ($TODAY)\"" 2>/dev/null
fi
exit $CODE
