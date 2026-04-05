/**
 * config.js — 환경변수 로드 및 검증
 *
 * [왜 이 파일이 필요한가]
 * 환경변수를 앱 전체에서 흩어서 process.env.XXX 로 직접 읽으면
 * 1) 오타가 생겨도 런타임 전까지 발견하기 어렵다
 * 2) 어떤 환경변수가 필요한지 한눈에 알기 어렵다
 * 3) 기본값 처리가 코드 곳곳에 흩어진다
 *
 * 이 파일에서 환경변수를 한 곳에서 로드하고 검증하면:
 * - 서버 시작 시점에 누락된 필수값을 즉시 감지해서 조용한 오동작을 막는다
 * - 다른 모듈은 이 파일만 import하면 된다
 */

"use strict";

// dotenv: .env 파일의 KEY=VALUE를 process.env에 주입한다.
// 이미 환경변수로 설정된 값은 덮어쓰지 않으므로, 배포 환경에서는 무해하다.
require("dotenv").config();

// ──────────────────────────────────────────────
// 필수 환경변수 검증
// 서버 시작 전에 빠져나가서, 잘못된 설정으로 서비스가 반쪽짜리로 동작하는 것을 막는다.
// ──────────────────────────────────────────────
const REQUIRED = ["ALCHEMY_URL"];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    // console.error 후 즉시 종료. 스택 트레이스 없이 명확한 메시지만 출력.
    console.error(`[Config] 필수 환경변수 누락: ${key}`);
    console.error(`[Config] .env.example 을 참고해 .env 파일을 생성하세요.`);
    process.exit(1);
  }
}

const config = {
  // Alchemy RPC URL — API 키 포함된 비밀값. 이 변수가 외부에 노출되면 RPC 자원이 탈취된다.
  alchemyUrl: process.env.ALCHEMY_URL,

  // 서버 포트. 기본값 5000.
  port: parseInt(process.env.PORT || "5000", 10),

  // CORS 허용 Origin. 프론트엔드 주소만 허용하여 다른 출처의 브라우저 요청을 차단한다.
  allowedOrigin: process.env.ALLOWED_ORIGIN || "http://localhost:5173",

  // Rate Limiting 설정
  rateLimit: {
    windowMs: 60 * 1000, // 1분 (밀리초)
    maxRequests: 10,      // 윈도우 내 최대 요청 수
  },

  // 캐시 설정
  cache: {
    // TTL = 30초.
    // Ethereum Sepolia 블록 생성 주기 ≈ 12초이므로, 30초는 블록 약 2.5개 분량이다.
    // 잔액은 최소 12초에 한 번씩만 바뀔 수 있으므로, 30초는 실시간성과 효율의 균형점.
    // 5초 → 거의 실시간이지만 Alchemy 호출 비용 높음
    // 60초 → 절약 극대화지만 잔액 변경이 1분 뒤에나 반영됨
    ttlMs: 30 * 1000,

    // 캐시 엔트리 최대 개수. 이를 초과하면 가장 오래된 항목부터 삭제한다.
    // 무한정 메모리 증가를 막기 위한 안전장치.
    maxSize: 1000,
  },
};

module.exports = config;
