#!/usr/bin/env bash
# Copy freshly-compiled PDFs from the LaTeX source dir into public/
# so they're picked up by the next Vercel deploy.
#
# Usage: ./scripts/sync-docs.sh
# Or via npm:  npm run sync-docs
#
# Exits non-zero if any source PDF is missing — fail loud rather than
# silently shipping a stale doc.

set -euo pipefail

LATEX_DIR="$HOME/Programming/latex/hforth"
PUBLIC_DIR="$(cd "$(dirname "$0")/.." && pwd)/public"

# (source-name → destination-name in public/)
declare -a DOCS=(
  "hforth.pdf:hforth.pdf"
)

echo "→ Syncing PDFs from $LATEX_DIR → $PUBLIC_DIR"

for entry in "${DOCS[@]}"; do
  src_name="${entry%%:*}"
  dst_name="${entry##*:}"
  src_path="$LATEX_DIR/$src_name"
  dst_path="$PUBLIC_DIR/$dst_name"

  if [[ ! -f "$src_path" ]]; then
    echo "  ✗ MISSING: $src_path" >&2
    exit 1
  fi

  if [[ -f "$dst_path" ]] && cmp -s "$src_path" "$dst_path"; then
    echo "  · unchanged: $dst_name"
  else
    cp "$src_path" "$dst_path"
    src_size=$(wc -c < "$src_path" | tr -d ' ')
    echo "  ✓ updated:   $dst_name ($src_size bytes)"
  fi
done

echo "→ Done. Don't forget to: git add public/*.pdf && git commit"
