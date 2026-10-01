#!/usr/bin/env bash
# Rebuild the headless-phone audit rig from scratch (workspace snapshots drop
# node_modules and the Chrome download) and run the UI duplication audit.
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"

export PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_DIR:-$HERE/.chrome}"
export LD_LIBRARY_PATH="$HERE/sysroot/usr/lib/x86_64-linux-gnu"

# 1. puppeteer (node_modules is not persisted between turns)
if [ ! -d node_modules/puppeteer ]; then
  echo "== installing puppeteer =="
  npm init -y > /dev/null 2>&1
  npm i puppeteer --no-audit --no-fund 2>&1 | tail -2
fi

# 2. chrome-headless-shell binary
if ! ls -d .chrome/chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell > /dev/null 2>&1; then
  echo "== installing chrome-headless-shell =="
  npx --yes @puppeteer/browsers install chrome-headless-shell@stable --path /home/user/tools/.chrome 2>&1 | tail -2
fi
export CHROME_BIN=$(ls -d .chrome/chrome-headless-shell/*/chrome-headless-shell-linux64/chrome-headless-shell | head -1)

# 3. shared libs the sandbox lacks (no root: debs unpacked into a private sysroot)
if [ ! -d sysroot/usr/lib/x86_64-linux-gnu ] || [ -z "$(ls -A sysroot/usr/lib/x86_64-linux-gnu 2>/dev/null)" ]; then
  echo "== fetching system libs from the Debian trixie pool =="
  python3 fetch_libs.py 2>&1 | tail -6
fi

# 4. the built app must be served (dist/ is also not persisted)
if ! curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/ | grep -q 200; then
  echo "== starting static server for dist/ =="
  (cd "$HERE/../../dist" && nohup python3 -m http.server 4173 --bind 0.0.0.0 > /tmp/serve.log 2>&1 &)
  sleep 2
fi
echo "== server: $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/) =="

echo "== running audit =="
node audit_ui.mjs
