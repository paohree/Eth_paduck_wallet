// config.js — 환경변수 로드 및 검증
// 모든 환경변수를 한 곳에서 관리한다.
// 서버 시작 시 필수값이 누락되면 즉시 종료해 잘못된 설정으로 실행되는 것을 막는다.

"use strict";

require("dotenv").config();

const REQUIRED = ["ALCHEMY_URL"];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[Config] 필수 환경변수 누락: ${key}`);
    console.error(`[Config] .env.example 을 참고해 .env 파일을 생성하세요.`);
    process.exit(1);
  }
}

const config = {
  // Alchemy RPC URL (API 키 포함). 서버 환경변수에만 존재해야 한다.
  alchemyUrl: process.env.ALCHEMY_URL,

  port: parseInt(process.env.PORT || "5000", 10),

  // 프론트엔드 주소. 이 출처에서 오는 요청만 CORS 허용한다.
  allowedOrigin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",

  rateLimit: {
    windowMs: 60 * 1000, // 1분
    maxRequests: 10,      // 1분에 최대 10회
  },

  cache: {
    ttlMs: 30 * 1000,  // 30초. Sepolia 블록 생성 주기(약 12초)를 고려한 값.
    maxSize: 1000,     // 최대 캐시 엔트리 수. 초과 시 가장 오래된 항목 삭제.
  },
};

module.exports = config;
