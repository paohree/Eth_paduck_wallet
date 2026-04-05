#!/bin/bash

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "백엔드 시작..."
cd "$ROOT_DIR/backend" && node src/server.js &
BACKEND_PID=$!

sleep 1

echo "프론트엔드 시작..."
cd "$ROOT_DIR/frontend" && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 서버 실행 중"
echo "   백엔드:  http://localhost:5001"
echo "   프론트:  http://localhost:5173"
echo ""
echo "종료하려면 stop.sh 실행"

# PID 저장
echo "$BACKEND_PID $FRONTEND_PID" > "$ROOT_DIR/.pids"
