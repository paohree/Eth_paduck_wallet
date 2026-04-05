#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$ROOT_DIR/.pids" ]; then
  read BACKEND_PID FRONTEND_PID < "$ROOT_DIR/.pids"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  rm "$ROOT_DIR/.pids"
fi

pkill -f "node src/server.js" 2>/dev/null
pkill -f "vite" 2>/dev/null
lsof -ti:5001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "✅ 서버 종료됨"
