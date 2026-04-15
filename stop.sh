#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.pids"

if [ ! -f "$PID_FILE" ]; then
  echo "No .pids file found — nothing to stop."
  exit 0
fi

read -r API_PID VITE_PID < "$PID_FILE"

kill_pid() {
  local pid=$1
  local name=$2
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" && echo "Stopped $name (PID $pid)"
  else
    echo "$name (PID $pid) was not running."
  fi
}

kill_pid "$API_PID"  "API server"
kill_pid "$VITE_PID" "Frontend"

rm -f "$PID_FILE"
echo "Done."
