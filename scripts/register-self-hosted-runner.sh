#!/usr/bin/env bash
# Register this Mac as a self-hosted GitHub Actions runner for the NeuroCanvas
# repository. Idempotent — safe to re-run; pulls a fresh registration token
# each time so you don't have to chase tokens through the GitHub UI.
#
# Usage:
#   ./scripts/register-self-hosted-runner.sh                  # interactive
#   GITHUB_TOKEN=<pat> ./scripts/register-self-hosted-runner.sh  # non-interactive
#
# The PAT needs the `repo` scope (full) so it can mint registration tokens
# via POST /repos/:owner/:repo/actions/runners/registration-token.
#
# After this finishes the runner is installed at ~/actions-runner and started
# as a launchd service that auto-starts at login. To stop / remove it:
#   cd ~/actions-runner && ./svc.sh uninstall && ./config.sh remove --token <token>

set -euo pipefail

REPO="vanjamodrinjak21/neuro-canvas"
RUNNER_DIR="${HOME}/actions-runner"
RUNNER_NAME="$(scutil --get ComputerName 2>/dev/null || hostname -s)"
LABELS="self-hosted,macOS,ARM64"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    GITHUB_TOKEN="$(gh auth token)"
  else
    echo "Need a GitHub PAT with 'repo' scope."
    echo "Either:"
    echo "  1) export GITHUB_TOKEN=ghp_xxx and re-run"
    echo "  2) gh auth login   (then re-run)"
    exit 1
  fi
fi

echo "→ requesting fresh runner registration token from GitHub …"
RESPONSE="$(curl -fsSL \
  -X POST \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${REPO}/actions/runners/registration-token")"

REG_TOKEN="$(printf '%s' "${RESPONSE}" | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')"
if [[ -z "${REG_TOKEN}" || "${REG_TOKEN}" == "null" ]]; then
  echo "✗ couldn't extract token from GitHub response:"
  printf '%s\n' "${RESPONSE}"
  exit 1
fi

mkdir -p "${RUNNER_DIR}"
cd "${RUNNER_DIR}"

# Detect arch for the right tarball
ARCH="$(uname -m)"
case "${ARCH}" in
  arm64|aarch64) RUNNER_ARCH="osx-arm64" ;;
  x86_64)        RUNNER_ARCH="osx-x64"   ;;
  *) echo "✗ unsupported macOS arch: ${ARCH}"; exit 1 ;;
esac

# Pin a stable runner version. Bump as needed; check
# https://github.com/actions/runner/releases for the latest.
RUNNER_VERSION="2.319.1"
TARBALL="actions-runner-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"

if [[ ! -f "./run.sh" ]]; then
  echo "→ downloading runner v${RUNNER_VERSION} for ${RUNNER_ARCH} …"
  curl -fL -o "${TARBALL}" \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"
  tar xzf "${TARBALL}"
  rm -f "${TARBALL}"
fi

# Idempotent reconfigure: if already configured, remove first using the new token
if [[ -f ".runner" ]]; then
  echo "→ existing runner config detected — re-registering …"
  ./config.sh remove --token "${REG_TOKEN}" || true
fi

echo "→ configuring runner '${RUNNER_NAME}' with labels '${LABELS}' …"
./config.sh \
  --unattended \
  --url "https://github.com/${REPO}" \
  --token "${REG_TOKEN}" \
  --name "${RUNNER_NAME}" \
  --labels "${LABELS}" \
  --work "_work" \
  --replace

echo "→ installing as launchd service (auto-starts on login) …"
sudo ./svc.sh install || ./svc.sh install
sudo ./svc.sh start   || ./svc.sh start

echo
echo "✓ runner registered."
echo "  GitHub → Settings → Actions → Runners should show '${RUNNER_NAME}' (Idle)."
echo "  Logs:   ~/actions-runner/_diag"
echo "  Stop:   cd ~/actions-runner && sudo ./svc.sh stop"
echo "  Remove: cd ~/actions-runner && sudo ./svc.sh uninstall && ./config.sh remove --token <fresh-token>"
