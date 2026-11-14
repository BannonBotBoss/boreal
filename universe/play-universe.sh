#!/usr/bin/env bash
# Start Boreal Universe on 127.0.0.1:5174 (uses parent node_modules).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
cd "$DIR"
if [[ ! -d "$ROOT/node_modules" ]]; then
  (cd "$ROOT" && (pnpm install || npm install))
fi
if command -v xdg-open >/dev/null; then OPEN=xdg-open
elif command -v open >/dev/null; then OPEN=open
else OPEN=""
fi
if ss -ltn 2>/dev/null | grep -q ':5174 '; then
  [[ -n "$OPEN" ]] && "$OPEN" "http://127.0.0.1:5174/" || true
  exit 0
fi
node "$ROOT/node_modules/vite/bin/vite.js" --config vite.config.ts --host 127.0.0.1 --port 5174 &
PID=$!
for _ in $(seq 1 60); do
  if ss -ltn 2>/dev/null | grep -q ':5174 '; then
    [[ -n "$OPEN" ]] && "$OPEN" "http://127.0.0.1:5174/" || true
    wait "$PID"
    exit 0
  fi
  sleep 0.5
done
echo "Boreal Universe did not start on port 5174" >&2
kill "$PID" 2>/dev/null || true
exit 1
