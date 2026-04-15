#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$PROJECT_DIR/.pids"

echo "Starting JD Extractor..."

cd "$PROJECT_DIR"

# Start API server
npx tsx server.ts &
API_PID=$!

# Start Vite frontend
npx vite &
VITE_PID=$!

echo "$API_PID $VITE_PID" > "$PID_FILE"

echo "API server started (PID $API_PID) → http://localhost:7001"
echo "Frontend started  (PID $VITE_PID) → http://localhost:8080"
echo "PIDs saved to .pids — run ./stop.sh to shut down."
