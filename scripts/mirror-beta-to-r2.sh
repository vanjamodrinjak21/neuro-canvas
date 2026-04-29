#!/usr/bin/env bash
set -euo pipefail

# Mirrors the current GitHub `beta` release assets to Cloudflare R2 under
# `beta/`. Uses the AWS CLI as a generic S3 client against R2's S3-compatible
# endpoint — no AWS account is involved.
#
# Idempotent: re-running overwrites existing keys with --no-progress + sha256.
# After CI runs once, the release.yml workflow does this step automatically.

REPO="vanjamodrinjak21/neuro-canvas"
TAG="beta"

# Required env (loaded from .env if present). Use a strict KEY="VALUE" parser
# so stray lines like "api key : foo" in .env don't blow up the whole script.
if [[ -f ".env" ]]; then
  while IFS='=' read -r KEY REST; do
    [[ -z "$KEY" || "$KEY" =~ ^[[:space:]]*# ]] && continue
    [[ ! "$KEY" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && continue
    VALUE="${REST%$'\r'}"
    VALUE="${VALUE#\"}"; VALUE="${VALUE%\"}"
    export "$KEY=$VALUE"
  done < .env
fi

: "${R2_ACCOUNT_ID:?R2_ACCOUNT_ID is required}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID is required}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY is required}"
: "${R2_BUCKET:?R2_BUCKET is required}"

ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
WORK="$(mktemp -d 2>/dev/null || mktemp -d -t nc-beta-mirror)"
trap 'rm -rf "$WORK"' EXIT

# AWS CLI reads its creds from these env vars; R2 keys map 1:1.
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="auto"

echo "→ Fetching asset list for $REPO tag=$TAG"
ASSETS_JSON="$WORK/assets.json"
gh release view "$TAG" --repo "$REPO" --json assets > "$ASSETS_JSON"

# Download + sha256 each asset (POSIX while-read; macOS bash 3.2 has no mapfile).
mkdir -p "$WORK/dl"
VERSION=""
COUNT=0
while IFS=$'\t' read -r NAME URL; do
  [ -z "$NAME" ] && continue
  COUNT=$((COUNT + 1))
  echo "↓ $NAME"
  curl -fsSL --retry 3 -o "$WORK/dl/$NAME" "$URL"
  ( cd "$WORK/dl" && shasum -a 256 "$NAME" > "$NAME.sha256" )
  if [ -z "$VERSION" ]; then
    VERSION="$(echo "$NAME" | sed -nE 's/.*_([0-9]+\.[0-9]+\.[0-9]+)_.*/\1/p')"
  fi
done < <(jq -r '.assets[] | "\(.name)\t\(.url)"' "$ASSETS_JSON")

if [ "$COUNT" -eq 0 ]; then
  echo "✗ No assets on release $TAG — nothing to mirror." >&2
  exit 1
fi
echo "  $COUNT assets staged"
echo "→ Detected VERSION=${VERSION:-unknown}"

# Upload everything under beta/.
echo "↑ Uploading to s3://$R2_BUCKET/beta/ via $ENDPOINT"
aws s3 cp "$WORK/dl" "s3://$R2_BUCKET/beta/" \
  --endpoint-url "$ENDPOINT" \
  --recursive \
  --no-progress

# Compose latest.json (matches release.yml/write-manifest).
PUBLISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat > "$WORK/latest.json" <<JSON
{
  "version": "${VERSION:-1.0.0}",
  "tag": "$TAG",
  "channel": "beta",
  "published_at": "$PUBLISHED_AT",
  "release_url": "https://github.com/$REPO/releases/tag/$TAG",
  "platforms": {
    "macos-arm64": "https://cdn.neuro-canvas.com/beta/NeuroCanvas_${VERSION:-1.0.0}_aarch64.dmg",
    "windows-x64-msi": "https://cdn.neuro-canvas.com/beta/NeuroCanvas_${VERSION:-1.0.0}_x64_en-US.msi",
    "windows-x64-exe": "https://cdn.neuro-canvas.com/beta/NeuroCanvas_${VERSION:-1.0.0}_x64-setup.exe"
  }
}
JSON

aws s3 cp "$WORK/latest.json" "s3://$R2_BUCKET/latest.json" \
  --endpoint-url "$ENDPOINT" \
  --content-type application/json \
  --no-progress

echo "✓ Done. Verify:"
echo "  curl -I https://cdn.neuro-canvas.com/beta/NeuroCanvas_${VERSION:-1.0.0}_aarch64.dmg"
echo "  curl    https://cdn.neuro-canvas.com/latest.json"
