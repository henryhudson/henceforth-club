#!/usr/bin/env bash
#
# wednesday-screenshots.sh
# The ship-day screenshot gate: capture every app's screens from the commit
# about to be archived, compare them against last week, and open a review page
# with the screens that moved most, first.
#
#   ./scripts/board/wednesday-screenshots.sh              # all three apps
#   ./scripts/board/wednesday-screenshots.sh deck         # one app
#   ./scripts/board/wednesday-screenshots.sh --no-open
#   ./scripts/board/wednesday-screenshots.sh --on-mini    # capture on the mini
#
# WHERE IT CAPTURES, AND WHY THAT CHANGED (2026-09-11). The note below says this
# runs on the laptop because the mini's volume sat at capacity. That was true
# when it was written and is now the wrong way round: measured today, the mini
# had 224 GiB free at 49% used and the laptop 22 GiB at 95%, and the laptop is
# the machine whose fifteen-minute load average was 44 on ten cores. So
# --on-mini sends the capture to ~/Programming/Main/<repo> there, puts that
# checkout on THIS machine's commit first (detached, so nothing on the mini has
# an opinion about branches), and brings the screens back. The comparison and
# the review page stay here, because they are cheap and they are read here.
#
# The mini's three runners share ONE simulator device set, so a capture started
# while a job is testing contends with it. The run says so in the status file
# rather than quietly producing screens nobody can trust.
#
# WHY IT RUNS HERE AND NOT ON THE MAC MINI. Every app has a local capture script
# that drives real simulators from the repository root, and this laptop has the
# devices they need. The mini also captures screenshots on every scheduled run,
# but seals them in an .xcresult bundle nothing extracts (that is what
# fetch-mini-screenshots.sh is for), and its volume has sat at 100% capacity —
# on 2026-07-22 the ship-day run died with "No space left on device" before it
# compiled anything. A gate that blocks the ship when the build machine is full
# is worse than no gate.
#
# WHY IT MEASURES RATHER THAN GATES. Measured on 2026-07-22 with two consecutive
# Hansard captures and NO interface change: eleven of eighteen screens differed
# byte-for-byte, spread continuously from 0.07% to 15.2% of pixels, and the
# movers were exactly the screens showing live Parliament data. There is no gap
# in that distribution, so no threshold can separate "the interface changed"
# from "the data did" — and a gate that cries change every week stops being
# read. So this ranks by how much moved and shows a heatmap; a human spends
# thirty seconds on the top few. Screens that are genuinely stable measure
# exactly 0.000% and sink to the bottom, so the signal is real where it exists.
# The durable fix is deterministic capture from bundled fixtures with no live
# network — per-app work, tracked separately.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${SHIP_SCREENSHOT_DEST:-$HOME/Desktop/ship-screenshots}"
TODAY="$(date +%F)"
OUT="$DEST/$TODAY"
OPEN_PAGE=true
ON_MINI=false
MINI="${SHIP_SCREENSHOT_HOST:-henryhudson@henrys-mac-mini.local}"
APPS=()

for arg in "$@"; do
    case "$arg" in
        --no-open) OPEN_PAGE=false ;;
        --on-mini) ON_MINI=true ;;
        deck|henceforth|hansard) APPS+=("$arg") ;;
        *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done
[ ${#APPS[@]} -eq 0 ] && APPS=(deck henceforth hansard)

repo_for() { case "$1" in
    deck)       echo "$HOME/Programming/Main/DaDeckOfCards";;
    henceforth) echo "$HOME/Programming/Main/Henceforth";;
    hansard)    echo "$HOME/Programming/Main/Hansard";;
  esac; }
source_for() { case "$1" in
    deck)       echo "Tools/DaDeckOfCardsBoard/snapshots";;
    henceforth) echo "Tools/HenceforthBoard/snapshots";;
    hansard)    echo "Tools/HansardBoard/snapshots";;
  esac; }

mkdir -p "$OUT"
PREV="$(find "$DEST" -maxdepth 1 -type d -name '20*' ! -name "$TODAY" 2>/dev/null | sort | tail -1)"
[ -n "$PREV" ] && echo "==> comparing against $(basename "$PREV")" \
               || echo "==> no previous run to compare against (first time)"

SUMMARY="$OUT/summary.tsv"
: > "$SUMMARY"

# THE COMPLETION MARKER. On 2026-09-09 this run was killed partway through and
# left behind one log and a zero-byte summary, which is indistinguishable from a
# run that never started — so Hansard 1.11 shipped that evening believing the
# gate had simply not been asked for. An empty summary is now never ambiguous:
# the status file says "started" from the first second, and says "complete" only
# if the run reaches its own end. Anything else, a kill, a crash, a set -e exit,
# leaves "interrupted" behind, because the trap fires on the way out either way.
STATUS="$OUT/status.tsv"
COMPLETED=false
note_status() { printf '%s\t%s\t%s\n' "$(date +%FT%T%z)" "$1" "${2:-}" >> "$STATUS"; }
finish() {
    if [ "$COMPLETED" = true ]; then
        note_status complete "$(wc -l < "$SUMMARY" | tr -d ' ') app(s) recorded"
    else
        note_status interrupted "ended before finishing; any screens here are partial"
    fi
}
: > "$STATUS"
trap finish EXIT
note_status started "apps=${APPS[*]} host=$([ "$ON_MINI" = true ] && echo "$MINI" || echo local)"

for app in "${APPS[@]}"; do
    repo="$(repo_for "$app")"
    src="$repo/$(source_for "$app")"
    script="$repo/Scripts/regenerate-snapshots.sh"

    echo ""
    echo "########## $app ##########"

    if [ ! -x "$script" ]; then
        echo "  no capture script at $script — SKIPPED" >&2
        printf '%s\tno-script\t0\t-\n' "$app" >> "$SUMMARY"
        continue
    fi

    # Pin what is actually being captured. On ship day this must be the commit
    # being archived, so record it rather than assuming it.
    sha="$(git -C "$repo" rev-parse --short HEAD)"
    if [ -n "$(git -C "$repo" status --porcelain --untracked-files=no)" ]; then
        echo "  capturing at $sha — WORKING TREE DIRTY, these shots match no commit" >&2
    else
        echo "  capturing at $sha"
    fi

    if [ "$ON_MINI" = true ]; then
        # CAPTURE ON THE MAC MINI. This moved here on 2026-09-11 because the
        # reason it ran on the laptop has inverted: the comment at the head of
        # this file says the mini's volume sat at capacity, and today the mini
        # has ten times the laptop's free space while the laptop is the machine
        # at ninety five per cent that cannot run a capture at all.
        #
        # The mini is put on THIS machine's commit rather than trusting whatever
        # its nightly pull left there, because the whole point of the gate is
        # that the screens match the code being archived. A detached checkout,
        # so nothing on the mini has an opinion about branches.
        remote_repo="\$HOME/Programming/Main/$(basename "$repo")"
        note_status capturing "$app on $MINI at $sha"
        if ! ssh "$MINI" "cd $remote_repo && git fetch --quiet origin && git checkout --quiet --detach $sha" \
                > "$OUT/$app.log" 2>&1; then
            echo "  could not put $MINI on $sha — see $OUT/$app.log" >&2
            printf '%s\tremote-checkout-failed\t0\t%s\n' "$app" "$sha" >> "$SUMMARY"
            continue
        fi
        # The mini's three runners share ONE simulator device set, so a capture
        # started while a job is testing will fight it for devices. Say so
        # rather than producing screens nobody can trust.
        if ssh "$MINI" 'pgrep -f Runner.Worker >/dev/null 2>&1'; then
            echo "  NOTE: a continuous-integration job is running on $MINI; they share one device set" >&2
            note_status contended "$app captured while $MINI was running a job"
        fi
        if ! ssh "$MINI" "cd $remote_repo && ./Scripts/regenerate-snapshots.sh" \
                >> "$OUT/$app.log" 2>&1; then
            echo "  capture script reported failure on $MINI — see $OUT/$app.log" >&2
        fi
        mkdir -p "$OUT/$app"
        find "$OUT/$app" -maxdepth 1 -name '*.png' -delete
        rsync -a --include='*/' --include='*.png' --exclude='*' \
            "$MINI:$remote_repo/$(source_for "$app")/" "$OUT/$app/" >> "$OUT/$app.log" 2>&1 || true
        src="$OUT/$app"
    else
        if ! ( cd "$repo" && ./Scripts/regenerate-snapshots.sh ) > "$OUT/$app.log" 2>&1; then
            echo "  capture script reported failure — see $OUT/$app.log" >&2
        fi
    fi

    # When the capture ran on the mini, `src` IS the destination: rsync has
    # already put the screens there and the stale ones were deleted before it
    # did. Clearing and copying again here would delete exactly what was just
    # fetched, so both steps are local-capture only.
    mkdir -p "$OUT/$app"
    [ "$ON_MINI" = true ] || find "$OUT/$app" -maxdepth 1 -name '*.png' -delete
    n=$(find "$src" -maxdepth 1 -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
    if [ "$n" -eq 0 ]; then
        # Zero is a failure, never a quiet week — say so loudly.
        echo "  NO SCREENSHOTS PRODUCED — this is a failure, not an empty week" >&2
        printf '%s\tfailed\t0\t%s\n' "$app" "$sha" >> "$SUMMARY"
        continue
    fi
    [ "$ON_MINI" = true ] || find "$src" -maxdepth 1 -name '*.png' -exec cp {} "$OUT/$app/" \;
    echo "  $n screenshots"

    if [ -n "$PREV" ] && [ -d "$PREV/$app" ]; then
        python3 "$HERE/diff-screens.py" "$PREV/$app" "$OUT/$app" "$OUT/$app.diff.json" \
            || echo "  comparison failed" >&2
    fi
    printf '%s\tok\t%s\t%s\n' "$app" "$n" "$sha" >> "$SUMMARY"
done

python3 "$HERE/render-screenshot-review.py" "$OUT" "$TODAY" "${PREV:-}"

COMPLETED=true

echo ""
echo "==> $OUT"
column -t -s $'\t' "$SUMMARY" 2>/dev/null || cat "$SUMMARY"
[ "$OPEN_PAGE" = true ] && open "$OUT/index.html"
exit 0
