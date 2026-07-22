#!/usr/bin/env bash
#
# fetch-mini-screenshots.sh
# Bring the Mac mini's continuous-integration screenshots to the laptop.
#
# WHY THIS EXISTS. Henceforth's ScreenSnapshotUITests capture each screen with
# XCTAttachment(screenshot:) at .keepAlways lifetime, so the PNGs live INSIDE the
# .xcresult bundle. The workflow only ever runs `xcresulttool get test-results
# summary` on that bundle — it never runs `export attachments` — and the one
# upload step handles the build log, not screenshots. So every scheduled run has
# been capturing ~76 screenshots that never left the machine and were destroyed
# by the next work-tree cleanup (established 2026-07-22; the oldest surviving
# bundle was eleven days old).
#
# Run from the henceforth-club repo root, or anywhere — it takes no arguments:
#   ./scripts/board/fetch-mini-screenshots.sh
#
# Lands them in ~/Desktop/mini-screenshots/<bundle-date>-<app>/ and prunes to
# the newest KEEP_DAYS directories.
#
# DISK SAFETY. The mini's data volume has been at 100% capacity, so this never
# extracts more than one bundle at a time and deletes each extraction the moment
# it has been copied. It refuses to extract at all below FREE_FLOOR_MB, because
# making a full disk worse is how the scheduled review died.

set -euo pipefail

MINI="${MINI_HOST:-henryhudson@henrys-mac-mini.local}"
DEST="${SCREENSHOT_DEST:-$HOME/Desktop/mini-screenshots}"
FREE_FLOOR_MB=150
KEEP_DAYS=14

# -n is load-bearing, not tidiness: without it ssh consumes the while-loop's
# stdin and the bundle list is swallowed after the first iteration.
ssh_mini() { ssh -n -o ConnectTimeout=10 -o BatchMode=yes "$MINI" "$@"; }

if ! ssh_mini true 2>/dev/null; then
  echo "cannot reach $MINI over ssh — skipping screenshot fetch" >&2
  exit 0
fi

free_mb() { ssh_mini "df -m /System/Volumes/Data | tail -1 | awk '{print \$4}'"; }

mkdir -p "$DEST"
total_png=0
total_bundles=0

# Enumerate every result bundle across the three self-hosted runner work trees.
bundles=$(ssh_mini 'for d in ~/actions-runner ~/actions-runner-cards ~/actions-runner-hansard; do
  find "$d/_work" -maxdepth 4 -name "*.xcresult" 2>/dev/null
done')

if [ -z "$bundles" ]; then
  echo "no .xcresult bundles found on the mini" >&2
  exit 0
fi

while IFS= read -r bundle; do
  [ -n "$bundle" ] || continue

  avail=$(free_mb)
  if [ "$avail" -lt "$FREE_FLOOR_MB" ]; then
    echo "mini has only ${avail} MB free (floor ${FREE_FLOOR_MB} MB) — refusing to extract $(basename "$bundle")" >&2
    continue
  fi

  # Name the local folder after the bundle's own date and its repository, so a
  # stale bundle is obvious rather than silently passing as today's run.
  stamp=$(ssh_mini "stat -f '%Sm' -t '%Y-%m-%d' '$bundle'")
  app=$(basename "$(dirname "$bundle")")
  kind=$(basename "$bundle" .xcresult)
  out="$DEST/${stamp}-${app}-${kind}"

  tmp="/tmp/hh-attach-$$-$(basename "$bundle" .xcresult)"
  if ! ssh_mini "xcrun xcresulttool export attachments --path '$bundle' --output-path '$tmp'" >/dev/null 2>&1; then
    echo "  extract failed: $app/$kind" >&2
    ssh_mini "find '$tmp' -mindepth 1 -delete 2>/dev/null; rmdir '$tmp' 2>/dev/null" || true
    continue
  fi

  count=$(ssh_mini "find '$tmp' -maxdepth 1 -name '*.png' | wc -l | tr -d ' '")
  if [ "${count:-0}" -eq 0 ]; then
    echo "  no screenshots in $app/$kind (summary-only bundle)"
  else
    mkdir -p "$out"
    rsync -a -e ssh "$MINI:$tmp/" "$out/"
    echo "  $app/$kind → $out ($count screenshots, captured $stamp)"
    total_png=$((total_png + count))
    total_bundles=$((total_bundles + 1))
  fi

  # Always clean up, whether or not anything was copied — the disk is the
  # scarce resource here, not the extraction.
  ssh_mini "find '$tmp' -mindepth 1 -delete 2>/dev/null; rmdir '$tmp' 2>/dev/null" || true
done <<< "$bundles"

# Prune old local folders, newest KEEP_DAYS kept.
if [ -d "$DEST" ]; then
  ls -1d "$DEST"/*/ 2>/dev/null | sort -r | tail -n +$((KEEP_DAYS + 1)) | while IFS= read -r old; do
    find "$old" -mindepth 1 -delete 2>/dev/null || true
    rmdir "$old" 2>/dev/null || true
    echo "  pruned $(basename "$old")"
  done
fi

echo "screenshots: $total_png from $total_bundles bundle(s) → $DEST"
