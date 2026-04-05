// server.js — 진입점
// app.js의 Express 앱을 포트에 올린다.

"use strict";

const app = require("./app");
const config = require("./config");

const server = app.listen(config.port, () => {
  console.log(`[Server] 백엔드 서버 실행 중: http://localhost:${config.port}`);
  console.log(`[Server] 잔액 조회 API: http://localhost:${config.port}/api/balance?address=0x...`);
  console.log(`[Server] 허용된 CORS Origin: ${config.allowedOrigin}`);
});

// Ctrl+C 또는 프로세스 종료 시 처리 중인 요청을 완료한 뒤 종료한다.
function shutdown(signal) {
  console.log(`\n[Server] ${signal} 수신. 서버를 종료합니다...`);
  server.close(() => {
    console.log("[Server] 모든 요청 처리 완료. 종료.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
