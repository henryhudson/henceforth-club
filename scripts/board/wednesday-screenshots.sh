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
APPS=()

for arg in "$@"; do
    case "$arg" in
        --no-open) OPEN_PAGE=false ;;
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

    if ! ( cd "$repo" && ./Scripts/regenerate-snapshots.sh ) > "$OUT/$app.log" 2>&1; then
        echo "  capture script reported failure — see $OUT/$app.log" >&2
    fi

    mkdir -p "$OUT/$app"
    find "$OUT/$app" -maxdepth 1 -name '*.png' -delete
    n=$(find "$src" -maxdepth 1 -name '*.png' 2>/dev/null | wc -l | tr -d ' ')
    if [ "$n" -eq 0 ]; then
        # Zero is a failure, never a quiet week — say so loudly.
        echo "  NO SCREENSHOTS PRODUCED — this is a failure, not an empty week" >&2
        printf '%s\tfailed\t0\t%s\n' "$app" "$sha" >> "$SUMMARY"
        continue
    fi
    find "$src" -maxdepth 1 -name '*.png' -exec cp {} "$OUT/$app/" \;
    echo "  $n screenshots"

    if [ -n "$PREV" ] && [ -d "$PREV/$app" ]; then
        python3 "$HERE/diff-screens.py" "$PREV/$app" "$OUT/$app" "$OUT/$app.diff.json" \
            || echo "  comparison failed" >&2
    fi
    printf '%s\tok\t%s\t%s\n' "$app" "$n" "$sha" >> "$SUMMARY"
done

python3 "$HERE/render-screenshot-review.py" "$OUT" "$TODAY" "${PREV:-}"

echo ""
echo "==> $OUT"
column -t -s $'\t' "$SUMMARY" 2>/dev/null || cat "$SUMMARY"
[ "$OPEN_PAGE" = true ] && open "$OUT/index.html"
exit 0
