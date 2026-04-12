#!/usr/bin/env bash
# Render the /hansard animation frames + UK anthem into a Twitter-ready MP4.
#
# Pipeline:
#   1. Ensure anthem audio is downloaded (US Navy Band — public domain).
#   2. Ensure frame sequence exists (run generate-hansard-video.js if not).
#   3. ffmpeg: loop frames to audio length, transcode to H.264/AAC MP4.

set -euo pipefail
cd "$(dirname "$0")"

FRAMES_DIR=".frames"
AUDIO_FILE="anthem.oga"
AUDIO_URL="https://upload.wikimedia.org/wikipedia/commons/7/71/U.S._Navy_Band_-_God_Save_the_King.oga"
OUT_FILE="hansard-anthem.mp4"

# Step 1: download audio if missing
if [ ! -f "$AUDIO_FILE" ]; then
  echo "→ Downloading anthem audio (US Navy Band, public domain)…"
  curl -sL -A "henceforth.club/1.0 (contact: henry@henceforth.club)" \
    -o "$AUDIO_FILE" "$AUDIO_URL"
  echo "  saved: $AUDIO_FILE"
fi

# Step 2: render frames if missing
if [ ! -d "$FRAMES_DIR" ] || [ -z "$(ls -A "$FRAMES_DIR"/*.png 2>/dev/null)" ]; then
  echo "→ Rendering animation frames…"
  node generate-hansard-video.js
fi

# Step 3: ffmpeg — loop frames, pad + fade audio, cap at 50.0s (= 5 full
# animation cycles so Twitter's in-feed loop has a seamless boundary).
echo "→ Encoding MP4…"
ffmpeg -y -hide_banner -loglevel warning \
  -stream_loop -1 -framerate 30 -i "$FRAMES_DIR/frame_%04d.png" \
  -i "$AUDIO_FILE" \
  -t 50 \
  -af "apad,afade=t=out:st=49.3:d=0.7" \
  -vf "fade=t=in:st=0:d=0.4" \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -preset medium \
  -profile:v high -level 4.0 \
  -c:a aac -b:a 192k -ar 44100 \
  -movflags +faststart \
  "$OUT_FILE"

echo ""
echo "✓ Done: scripts/$OUT_FILE"
ls -lh "$OUT_FILE"
