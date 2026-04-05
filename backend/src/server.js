/**
 * server.js — HTTP 서버 시작 진입점
 *
 * app.js에서 만든 Express 앱을 실제로 포트에 바인딩한다.
 * "node src/server.js" 또는 "npm start"로 실행한다.
 */

"use strict";

const app = require("./app");
const config = require("./config");

const server = app.listen(config.port, () => {
  console.log(`[Server] 백엔드 서버 실행 중: http://localhost:${config.port}`);
  console.log(`[Server] 잔액 조회 API: http://localhost:${config.port}/api/balance?address=0x...`);
  console.log(`[Server] 허용된 CORS Origin: ${config.allowedOrigin}`);
});

// ──────────────────────────────────────────────────────────
// Graceful Shutdown
// ──────────────────────────────────────────────────────────
// SIGTERM: 운영 환경에서 프로세스 종료 요청 (Kubernetes, systemd 등)
// SIGINT: Ctrl+C (개발 환경)
//
// 즉시 process.exit()하면 처리 중인 요청이 강제로 끊긴다.
// server.close()는 새 연결은 받지 않으면서 기존 요청을 완료한 뒤 종료한다.
function shutdown(signal) {
  console.log(`\n[Server] ${signal} 수신. 서버를 종료합니다...`);
  server.close(() => {
    console.log("[Server] 모든 요청 처리 완료. 종료.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
