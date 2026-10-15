#!/usr/bin/env bash
# Manual release (the GitHub Action does the same stamping automatically on every push to main).
#   ./release.sh "what changed"
# Stamps a new version, commits everything, pushes, then waits until the LIVE site serves that exact version.
set -euo pipefail
cd "$(dirname "$0")"
MSG="${1:-release}"
git pull --rebase -q origin main || true
./stamp.sh
V=$(sed -E 's/.*"version":"([^"]+)".*/\1/' version.json)
git add -A
git commit -m "$MSG (version $V)" || true
git push origin HEAD:main
URL="https://springlandscapequote-prog.github.io/color-clash-cubes/version.json"
echo "waiting for the live site to serve $V ..."
for i in $(seq 1 40); do
  LIVE=$(curl -fsS "$URL?t=$(date +%s)" -H 'Cache-Control: no-cache' 2>/dev/null | sed -E 's/.*"version":"([^"]+)".*/\1/' || true)
  if [ "$LIVE" = "$V" ]; then echo "LIVE is on $V"; exit 0; fi
  sleep 6
done
echo "live still shows ${LIVE:-nothing} (the Action may have re-stamped it; check version.json)"; exit 1
