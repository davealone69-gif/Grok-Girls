#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
export TRIPOSR_HOME="${TRIPOSR_HOME:-$HOME/TripoSR}"
export TRIPOSR_PORT="${TRIPOSR_PORT:-8081}"
export TRIPOSR_MIN_AVAILABLE_MB="${TRIPOSR_MIN_AVAILABLE_MB:-1800}"
if [ ! -f "$TRIPOSR_HOME/run.py" ]; then
  echo "ERROR: TripoSR not installed at $TRIPOSR_HOME"
  exit 1
fi
REPO="${GROK_GIRLS_HOME:-$HOME/Grok-Girls}"
mkdir -p "$HOME/.cache/grokgirls"
nohup python "$REPO/tools/triposr-worker/server.py" >"$HOME/.cache/grokgirls/triposr-worker.log" 2>&1 </dev/null &
echo "TripoSR worker start requested on 127.0.0.1:$TRIPOSR_PORT"
