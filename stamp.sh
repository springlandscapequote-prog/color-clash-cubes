#!/usr/bin/env bash
# Stamp a new build version into version.json, js/version.js and the ?v= on every script/css tag in index.html.
# Runs automatically on every push to main (.github/workflows/stamp.yml). You can also run it by hand (see release.sh).
set -euo pipefail
cd "$(dirname "$0")"
V="${1:-$(date -u +%Y%m%d.%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo local)}"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf '{"version":"%s","built":"%s"}\n' "$V" "$NOW" > version.json
printf '/* Stamped by stamp.sh on every deploy. Do not edit by hand. */\nwindow.CCC_BUILD = "%s";\n' "$V" > js/version.js
sed -E -i "s#((css/style\.css|js/version\.js|js/game\.js|js/update\.js|js/app\.js)\?v=)[^\"']*#\1${V}#g" index.html
echo "stamped $V"
