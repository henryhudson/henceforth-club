#!/bin/zsh
#
# morning-review.sh — start the /hh routine by itself, every morning at seven.
#
# Henry, 2026-09-09: "have it start automatically at 0700". The routine takes
# an hour or two, so a seven o'clock start means the Morning Edition, both
# printed sheets and the day's decisions are waiting when his own window opens
# at eight (~/Gardening/schedule.md, "The morning review").
#
# WHY IT RUNS HERE AND NOT ON THE MAC MINI. The mini already runs an overnight
# chain — pull-repos 02:50, pre-review 03:30, daily-reviews-pull 04:00,
# daily-reviews-send 05:00 — and its pull half works. Its GENERATION half has
# been dead since May: the five o'clock mailer logs "outbox empty; nothing to
# do" every morning and the newest review in its outbox is dated 27 May. The
# reviews are therefore generated on this laptop, which is also the machine
# holding the simulators, the credentials in .env.local and the board file.
#
# PERMISSION MODE. `auto` deliberately, not bypass. It is the mode the
# 9 September run used to complete the whole routine, and it is the mode that
# REFUSED both pull-request merges that day. Unattended, that refusal is the
# behaviour we want: the routine should adjudicate, write, publish and print,
# and leave merges and releases to Henry.
#
# The run is capped at three hours so a hung session cannot sit all day.

set -uo pipefail

CLAUDE="${CLAUDE_BIN:-$HOME/.local/bin/claude}"
MAIN="$HOME/Programming/Main"
LOG="$HOME/Library/Logs/morning-review.log"
CAP_SECONDS="${MORNING_REVIEW_CAP:-10800}"

mkdir -p "$(dirname "$LOG")"

{
  print -r -- ""
  print -r -- "=== morning review started $(date '+%Y-%m-%dT%H:%M:%S%z') ==="
} >> "$LOG"

if [[ ! -x "$CLAUDE" ]]; then
  print -r -- "no claude binary at $CLAUDE; nothing run" >> "$LOG"
  exit 127
fi

# The board file lives in DaDeckOfCards, so that is the working directory; the
# other three repositories are handed over explicitly rather than reached for.
cd "$MAIN/DaDeckOfCards" || { print -r -- "no DaDeckOfCards checkout" >> "$LOG"; exit 1; }

"$CLAUDE" -p "/hh" \
  --permission-mode auto \
  --add-dir "$MAIN/Henceforth" \
  --add-dir "$MAIN/Hansard" \
  --add-dir "$MAIN/henceforth-club" \
  >> "$LOG" 2>&1 &
run=$!

# Wall-clock cap: poll rather than sleep-and-kill so a run that finishes early
# is not held open, and so the log records which of the two happened.
waited=0
while kill -0 "$run" 2>/dev/null; do
  if (( waited >= CAP_SECONDS )); then
    print -r -- "=== capped at ${CAP_SECONDS}s; killing $run ===" >> "$LOG"
    kill "$run" 2>/dev/null
    sleep 5
    kill -9 "$run" 2>/dev/null
    break
  fi
  sleep 30
  waited=$((waited + 30))
done

wait "$run"
status=$?
print -r -- "=== morning review finished $(date '+%Y-%m-%dT%H:%M:%S%z') exit $status after ${waited}s ===" >> "$LOG"
exit $status
