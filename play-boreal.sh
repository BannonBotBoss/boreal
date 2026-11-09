#!/usr/bin/env bash
# Start Boreal without attaching a foreground terminal session.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
PORT="${BOREAL_PORT:-5173}"
URL="http://127.0.0.1:${PORT}/"

if ! curl -sf -o /dev/null "$URL"; then
  if [[ ! -d node_modules ]]; then
    if command -v pnpm >/dev/null 2>&1; then pnpm install
    else npm install
    fi
  fi
  nohup npx vite --host 127.0.0.1 --port "$PORT" >/tmp/boreal-vite.log 2>&1 &
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "$URL" && break
    sleep 0.5
  done
fi

if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1 || true
fi
