/**
 * vite.config.js — Vite 개발 서버 설정
 *
 * [프록시 설정이 필요한 이유]
 * 개발 환경에서 프론트엔드는 http://localhost:5173에서,
 * 백엔드는 http://localhost:5000에서 실행된다.
 *
 * 프론트엔드에서 fetch('/api/balance') 요청을 보내면:
 *   - 프록시 없이: localhost:5173/api/balance → 없는 경로, 404
 *   - 프록시 있음: localhost:5173/api/balance → Vite가 localhost:5000/api/balance로 전달
 *
 * 이 방식의 장점:
 *   - 브라우저 입장에서는 같은 출처(localhost:5173)로 요청하므로 CORS 문제가 없다
 *   - 백엔드 URL을 프론트엔드 코드에 하드코딩하지 않아도 된다
 *   - 배포 시 Nginx 등에서도 같은 /api 프록시 설정을 쓸 수 있다
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // /api 로 시작하는 모든 요청을 백엔드로 전달
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});
