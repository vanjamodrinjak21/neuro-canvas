#!/usr/bin/env bash
# Builds the landing scroll-scrub frame sequence from the AI-generated hero master.
# Source master lives in .assets-src/ (gitignored); outputs land in public/landing/.
#
# Usage: ./scripts/build-landing-sequence.sh [path-to-master.mp4]
#
# Output:
#   public/landing/seq/frame_0001.avif ... frame_NNNN.avif  (WIDTH-wide, color-graded)
#   public/landing/poster.jpg / poster.avif                 (first frame, LCP fallback)
#   public/landing/hero-mobile.mp4                          (720p autoplay loop for <768px)
#   public/landing/seq/manifest.json                        ({count,width,height,pattern})
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="${1:-.assets-src/landing/hero-master-4k.mp4}"
OUT_SEQ="public/landing/seq"
OUT_DIR="public/landing"
# Hue rotation + saturation calibrated against brand teal #00D2BE per master:
# raw Seedance drifts ~20° cold/cyan (-13 fit the 1080p master), but the
# ByteDance aigc 4K upscale re-warms the palette, so the 4K master needs -8.
GRADE="${GRADE:-hue=h=-8:s=1.15}"
# every 2nd frame of the 289-frame master -> 145 frames, plenty for a 400vh rail
SELECT="select=not(mod(n\,2))"
# 2560w from the 4K upscaled master: supersampled + near-1:1 on retina canvases
# (3840 would balloon decoded-bitmap RAM in the prefetch window; 2560 is the ceiling)
WIDTH="${WIDTH:-2560}"
CRF="${CRF:-32}"
PRESET=5

[ -f "$SRC" ] || { echo "ERROR: master not found: $SRC" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ERROR: ffmpeg required" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT_SEQ"

echo "==> extracting graded PNG frames (every 2nd frame @${WIDTH}w)"
ffmpeg -hide_banner -v error -i "$SRC" \
  -vf "$SELECT,$GRADE,scale=$WIDTH:-2:flags=lanczos" -fps_mode vfr \
  "$TMP/frame_%04d.png"

COUNT=$(ls "$TMP"/frame_*.png | wc -l | tr -d ' ')
echo "==> encoding $COUNT frames to AVIF (crf $CRF, preset $PRESET)"
i=0
for png in "$TMP"/frame_*.png; do
  i=$((i+1))
  ffmpeg -hide_banner -v error -i "$png" \
    -c:v libsvtav1 -crf "$CRF" -preset "$PRESET" \
    "$OUT_SEQ/$(basename "${png%.png}").avif" -y
  [ $((i % 25)) -eq 0 ] && echo "    $i/$COUNT"
done

echo "==> poster (JPEG fallback + AVIF)"
ffmpeg -hide_banner -v error -i "$SRC" -vf "$GRADE,scale=$WIDTH:-2:flags=lanczos" -frames:v 1 -q:v 2 "$OUT_DIR/poster.jpg" -y
ffmpeg -hide_banner -v error -i "$SRC" -vf "$GRADE,scale=$WIDTH:-2:flags=lanczos" -frames:v 1 -c:v libsvtav1 -crf 30 -preset 4 "$OUT_DIR/poster.avif" -y

echo "==> mobile autoplay loop (720p h264)"
ffmpeg -hide_banner -v error -i "$SRC" \
  -vf "$GRADE,scale=1280:-2" -c:v libx264 -crf 23 -preset slow \
  -pix_fmt yuv420p -movflags +faststart -an "$OUT_DIR/hero-mobile.mp4" -y

W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$OUT_SEQ/frame_0001.avif" 2>/dev/null || echo 1920)
H=$(ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$OUT_SEQ/frame_0001.avif" 2>/dev/null || echo 1080)

cat > "$OUT_SEQ/manifest.json" <<EOF
{
  "count": $COUNT,
  "width": $W,
  "height": $H,
  "pattern": "/landing/seq/frame_%04d.avif",
  "poster": "/landing/poster.jpg",
  "posterAvif": "/landing/poster.avif",
  "mobileVideo": "/landing/hero-mobile.mp4"
}
EOF

echo "==> done"
du -sh "$OUT_SEQ" "$OUT_DIR/poster.jpg" "$OUT_DIR/poster.avif" "$OUT_DIR/hero-mobile.mp4"
cat "$OUT_SEQ/manifest.json"
