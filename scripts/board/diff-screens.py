#!/usr/bin/env python3
"""
diff-screens.py — compare this week's captures against last week's.

WHY THIS IS NOT A BYTE COMPARISON. Measured on 2026-07-22 with two consecutive
Hansard captures and NO interface change between them: eleven of eighteen screens
differed byte-for-byte, spread continuously from 0.07% to 15.2% of pixels. There
is no gap in that distribution, so no percentage threshold can separate "the
interface changed" from "the capture did".

AND THE CAUSE IS NOT WHAT IT LOOKED LIKE. The first guess was live parliamentary
data, because the movers were the data-bearing screens. Rendering the difference
disproved it: member-iphone, the biggest mover at 15.2%, showed the SAME
paragraph twice at two vertical offsets — identical content at a different scroll
position. So a large part of the noise is the capture not settling to the same
place twice, which is far more fixable than live data, and is the thing to attack
first when making these deterministic.

So this does not pretend to classify. It measures, ranks, and paints what moved
in red over this week's screenshot, and lets a human spend thirty seconds on the
few that moved most. Screens that are genuinely stable sit at exactly 0.000% and
drop to the bottom — on that same run, bills, division and the iPad member
screens were all exactly zero, so the signal is real where it exists.
"""
import json
import os
import re
import shutil
import sys

from PIL import Image, ImageChops

BURST = re.compile(r"-f\d\d-")
# Pixels differing by less than this on the 0-255 luma scale are compression and
# antialiasing noise, not content.
NOISE_FLOOR = 8


def compare(prev_path, cur_path, diff_path):
    a = Image.open(prev_path).convert("RGB")
    b = Image.open(cur_path).convert("RGB")
    if a.size != b.size:
        return {"pct": 100.0, "note": f"size changed {a.size} → {b.size}"}
    d = ImageChops.difference(a, b)
    luma = d.convert("L")
    total = a.size[0] * a.size[1]
    differing = sum(luma.histogram()[NOISE_FLOOR:])
    pct = 100.0 * differing / total
    if differing:
        # Paint what moved in red ON TOP of this week's screenshot, rather than
        # emitting a bare black-and-white difference. A floating ghost image is
        # unreadable out of context — the first version of this showed the same
        # paragraph twice at two scroll offsets and simply looked broken. Seeing
        # the highlight over the real screen tells you immediately whether the
        # change is a control that moved or a whole view that shifted.
        mask = luma.point(lambda v: 255 if v >= NOISE_FLOOR else 0).convert("L")
        overlay = Image.new("RGB", b.size, (255, 40, 40))
        highlighted = Image.composite(overlay, b, mask)
        Image.blend(b, highlighted, 0.72).save(diff_path)
    return {"pct": pct, "note": ""}


def main():
    prev_dir, cur_dir, out_json = sys.argv[1], sys.argv[2], sys.argv[3]
    diff_dir = os.path.join(cur_dir, "_diff")
    # Last week's version of anything that moved is copied in beside this
    # week's, so the review page is SELF-CONTAINED. Pointing at ../<last-week>/
    # breaks the moment an old folder is pruned — which is exactly how the first
    # version of this page ended up with a dead middle image.
    prev_copy = os.path.join(cur_dir, "_prev")
    os.makedirs(diff_dir, exist_ok=True)
    os.makedirs(prev_copy, exist_ok=True)

    results, added, removed, burst = [], [], [], 0
    cur_files = sorted(f for f in os.listdir(cur_dir) if f.endswith(".png"))

    for f in cur_files:
        if BURST.search(f):
            burst += 1
            continue
        prev_path = os.path.join(prev_dir, f)
        if not os.path.exists(prev_path):
            added.append(f)
            continue
        r = compare(prev_path, os.path.join(cur_dir, f), os.path.join(diff_dir, f))
        if r["pct"] > 0:
            shutil.copyfile(prev_path, os.path.join(prev_copy, f))
        results.append({"file": f, **r})

    if os.path.isdir(prev_dir):
        for f in sorted(os.listdir(prev_dir)):
            if not f.endswith(".png") or BURST.search(f):
                continue
            if not os.path.exists(os.path.join(cur_dir, f)):
                removed.append(f)

    results.sort(key=lambda r: -r["pct"])
    moved = [r for r in results if r["pct"] > 0]
    with open(out_json, "w") as fh:
        json.dump(
            {
                "moved": moved,
                "identical": [r["file"] for r in results if r["pct"] == 0],
                "added": added,
                "removed": removed,
                "burst": burst,
            },
            fh,
            indent=1,
        )
    print(f"    {len(moved)} moved · {len(added)} new · {len(removed)} vanished · "
          f"{len(results) - len(moved)} identical · {burst} burst frames not compared")


if __name__ == "__main__":
    main()
