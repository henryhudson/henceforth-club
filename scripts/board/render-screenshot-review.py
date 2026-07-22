#!/usr/bin/env python3
"""
render-screenshot-review.py — build the ship-day screenshot review page.

The page exists to be read in about a minute before an archive. So it leads
with what moved most, shows each mover beside last week's version and a
difference heatmap, and pushes everything unchanged into a collapsed section.
It never claims a screen "changed" as a verdict — it reports how much moved and
lets the reader decide, because live data and an interface change are not
separable by measurement (see diff-screens.py for the evidence).
"""
import html
import json
import os
import sys

CSS = """
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{font:14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;
 padding:2rem;background:#fafaf9;color:#1c1917;max-width:1400px}
@media(prefers-color-scheme:dark){body{background:#0c0a09;color:#e7e5e4}
 h2,tr{border-color:#292524!important} img{border-color:#292524!important;background:#1c1917!important}}
h1{font-size:1.6rem;margin:0 0 .2rem}
.sub{opacity:.65;margin-bottom:.6rem}
.method{opacity:.55;font-size:.8rem;margin-bottom:2rem;max-width:62ch;line-height:1.5}
h2{font-size:1.1rem;margin:2.5rem 0 .6rem;border-bottom:1px solid #d6d3d1;padding-bottom:.35rem}
h3{font-size:.9rem;margin:1.6rem 0 .5rem;font-weight:600;opacity:.8}
.tally{opacity:.65;font-weight:400;font-size:.85rem}
.mover{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;margin-bottom:1.6rem;
 align-items:start}
.mover figure{margin:0}
img{width:100%;border:1px solid #d6d3d1;border-radius:6px;background:#fff;display:block}
figcaption{font-size:.72rem;opacity:.65;margin-top:.3rem}
.name{font-weight:600;font-size:.85rem;margin-bottom:.4rem;grid-column:1/-1;
 display:flex;align-items:baseline;gap:.6rem}
.pct{font-variant-numeric:tabular-nums;font-size:.78rem;padding:.1rem .45rem;border-radius:4px;
 background:#fde68a;color:#78350f}
.pct.big{background:#fecaca;color:#7f1d1d}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:.9rem}
.warn{background:#fecaca;color:#7f1d1d;padding:.6rem .8rem;border-radius:6px;margin:.6rem 0}
.ok{opacity:.7;font-style:italic}
details{margin:.8rem 0}
summary{cursor:pointer;font-size:.85rem;opacity:.75}
"""


def load(path):
    return json.load(open(path)) if os.path.exists(path) else None


def main():
    out, today = sys.argv[1], sys.argv[2]
    prev = sys.argv[3] if len(sys.argv) > 3 else ""
    prev_name = os.path.basename(prev) if prev else ""

    rows = []
    tsv = os.path.join(out, "summary.tsv")
    if os.path.exists(tsv):
        for line in open(tsv):
            p = line.rstrip("\n").split("\t")
            if len(p) == 4:
                rows.append(p)

    P = [f"<!doctype html><meta charset=utf-8><title>Ship screenshots {today}</title>",
         f"<style>{CSS}</style>",
         f"<h1>Ship screenshots — {today}</h1>",
         f"<div class=sub>{'compared against ' + html.escape(prev_name) if prev_name else 'first capture — nothing to compare against yet'}</div>",
         "<div class=method>Ranked by how much of each screen moved since last week, most first. "
         "A percentage is not a verdict: screens showing live data move every run regardless of the "
         "interface, so read the heatmap rather than the number. Screens measuring exactly zero are "
         "genuinely unchanged.</div>"]

    for app, status, n, sha in rows:
        if status == "no-script":
            P.append(f"<h2>{html.escape(app)} <span class=tally>— no capture script, skipped</span></h2>")
            continue
        if status == "failed":
            P.append(f"<h2>{html.escape(app)} <span class=tally>— capture FAILED at {html.escape(sha)}</span></h2>")
            P.append("<div class=warn>No screenshots were produced. That is a failure to investigate, "
                     "not an uneventful week — check the log beside this page.</div>")
            continue

        d = load(os.path.join(out, f"{app}.diff.json"))
        head = f"<h2>{html.escape(app)} <span class=tally>— {n} screens at {html.escape(sha)}"
        if d:
            head += (f" · {len(d['moved'])} moved · {len(d['added'])} new · "
                     f"{len(d['removed'])} vanished · {len(d['identical'])} identical")
        head += "</span></h2>"
        P.append(head)

        if not d:
            P.append("<p class=ok>No previous capture to compare against.</p>")

        if d and d["removed"]:
            P.append("<div class=warn><b>Stopped capturing:</b> " +
                     ", ".join(html.escape(f) for f in d["removed"]) +
                     " — a screen that stops capturing is usually a broken navigation path, "
                     "not a deleted feature. Worth opening before you archive.</div>")

        if d and d["moved"]:
            P.append("<h3>Moved — this week, last week, and what differs</h3>")
            for m in d["moved"]:
                f = m["file"]
                cls = "pct big" if m["pct"] >= 5 else "pct"
                note = f" — {html.escape(m['note'])}" if m.get("note") else ""
                P.append("<div class=mover>")
                P.append(f"<div class=name><span>{html.escape(f)}</span>"
                         f"<span class='{cls}'>{m['pct']:.2f}% moved</span>{note}</div>")
                P.append(f"<figure><img loading=lazy src='{html.escape(app)}/{html.escape(f)}'>"
                         f"<figcaption>this week</figcaption></figure>")
                # Read from the local _prev copy, never ../<last-week>/ — an old
                # folder can be pruned and the page must still render.
                P.append(f"<figure><img loading=lazy src='{html.escape(app)}/_prev/{html.escape(f)}'>"
                         f"<figcaption>{html.escape(prev_name) if prev_name else 'last time'}</figcaption></figure>")
                P.append(f"<figure><img loading=lazy src='{html.escape(app)}/_diff/{html.escape(f)}'>"
                         f"<figcaption>what moved, in red</figcaption></figure>")
                P.append("</div>")

        if d and d["added"]:
            P.append("<h3>New this week</h3><div class=grid>")
            for f in d["added"]:
                P.append(f"<figure><img loading=lazy src='{html.escape(app)}/{html.escape(f)}'>"
                         f"<figcaption>{html.escape(f)}</figcaption></figure>")
            P.append("</div>")

        appdir = os.path.join(out, app)
        allpng = sorted(f for f in os.listdir(appdir) if f.endswith(".png")) if os.path.isdir(appdir) else []
        shown = set()
        if d:
            shown = {m["file"] for m in d["moved"]} | set(d["added"])
        rest = [f for f in allpng if f not in shown]
        if rest:
            P.append(f"<details><summary>{len(rest)} unchanged and burst frames</summary><div class=grid>")
            for f in rest:
                P.append(f"<figure><img loading=lazy src='{html.escape(app)}/{html.escape(f)}'>"
                         f"<figcaption>{html.escape(f)}</figcaption></figure>")
            P.append("</div></details>")

    open(os.path.join(out, "index.html"), "w").write("\n".join(P))
    print(f"review page → {os.path.join(out, 'index.html')}")


if __name__ == "__main__":
    main()
