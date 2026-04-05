// rateLimit.js — IP 기반 Rate Limiting 미들웨어
// 동일 IP가 짧은 시간에 너무 많은 요청을 보내 Alchemy 한도를 소모하는 것을 막는다.
//
// IP 기반 제한의 한계:
//   VPN/프록시로 우회 가능. NAT 환경(학교, 회사)에서는 여러 사용자가 같은 IP를 공유한다.
//   로그인 없이는 더 정밀한 식별이 불가능하므로 이 한계를 인지하고 선택했다.
//
// 고정 윈도우 방식:
//   "1분에 10번" 제한. 1분 단위로 카운터를 초기화한다.
//   윈도우 경계(0:55~1:05)에서 최대 20번 허용될 수 있지만, 이 규모에서는 충분하다.
//
// 라이브러리(express-rate-limit) 대신 직접 구현한 이유:
//   의존성을 최소화하고 동작 원리를 직접 제어하기 위해.

"use strict";

const config = require("../config");

// IP별 요청 기록. { count: number, resetAt: number } 형태로 저장.
const ipStore = new Map();

// 만료된 엔트리를 주기적으로 정리해 메모리 누수를 막는다.
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [ip, record] of ipStore.entries()) {
    if (now > record.resetAt) ipStore.delete(ip);
  }
}
setInterval(cleanupExpiredEntries, config.rateLimit.windowMs * 2);

// 받는 값: req.ip (Express가 파싱한 클라이언트 IP)
// 통과 시: next() 호출
// 초과 시: 429 + Retry-After 헤더 반환
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();
  const { windowMs, maxRequests } = config.rateLimit;
  const record = ipStore.get(ip);

  if (!record || now > record.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      retryAfterSeconds: retryAfterSec,
    });
  }

  record.count++;
  next();
}

module.exports = rateLimitMiddleware;
