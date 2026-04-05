/**
 * rateLimit.js — IP 기반 Rate Limiting 미들웨어 (직접 구현)
 *
 * ──────────────────────────────────────────────────────────
 * [문제] Rate Limiting이 없으면 어떤 일이 생기는가? (시나리오 2)
 *
 * 공격자는 우리 API 엔드포인트를 알게 된 순간부터 스크립트로 대량 호출할 수 있다:
 *   GET /api/balance?address=0x0000...  (스레드 50개, while(true))
 *
 * 이 공격이 초래하는 결과:
 *   1. 초당 수천 건의 요청이 서버에 도달
 *   2. 각 요청이 Alchemy 호출로 이어지면 API 한도를 빠르게 소진한다
 *   3. 서버 자체도 CPU/메모리 과부하로 느려지거나 다운될 수 있다
 *   4. 결과적으로 정상 사용자도 서비스를 이용하지 못하게 된다
 *
 * [왜 IP 기반으로 제한하는가?]
 * 로그인 시스템이 없으므로 사용자를 식별할 방법이 IP뿐이다.
 * IP 기반 제한의 한계는 알고 선택했다:
 *   - VPN/프록시로 IP를 바꾸면 우회 가능하다
 *   - NAT 환경(학교, 회사)에서는 여러 사람이 같은 IP를 공유하므로
 *     한 명이 한도를 채우면 다른 정상 사용자도 차단된다
 * 이 한계에도 불구하고 IP 제한은 대부분의 무차별 공격을 막는 데 효과적이다.
 *
 * [왜 라이브러리(express-rate-limit)를 쓰지 않았는가?]
 * - 의존성 최소화 원칙: 꼭 필요한 패키지만 사용한다
 * - 동작 원리를 완전히 이해하고 직접 제어할 수 있다
 * - 이 과제 규모에서 직접 구현으로 충분하다
 *
 * [고정 윈도우(Fixed Window) 방식]
 * "1분에 10번" 제한을 적용할 때 1분을 고정된 구간으로 자른다.
 *
 * 예: 0:00~1:00에 10번 → 한도 소진
 *     1:00에 카운터 초기화 → 다시 10번 허용
 *
 * 한계: 0:55에 10번, 1:05에 10번 → 10초 내 20번이 가능하다.
 * (슬라이딩 윈도우는 이를 막지만 구현이 복잡하다)
 * 이 과제에서는 고정 윈도우로도 충분한 방어가 된다.
 *
 * [숫자 근거: 1분에 10번]
 * 정상 사용자는 지갑 잔액을 수동으로 확인할 때 1분에 1~2번이 자연스럽다.
 * 10번은 정상 사용에 여유를 두면서도 자동화 공격(수백~수천 회)과 명확히 구분된다.
 * ──────────────────────────────────────────────────────────
 */

"use strict";

const config = require("../config");

/**
 * IP별 요청 기록을 저장하는 Map.
 *
 * 구조: Map<ip: string, { count: number, resetAt: number }>
 *   - ip: 클라이언트 IP 주소 (문자열)
 *   - count: 현재 윈도우에서의 요청 수
 *   - resetAt: 이 윈도우가 만료되는 타임스탬프 (Date.now() 기준 밀리초)
 *
 * [Map을 쓰는 이유]
 * Object는 키로 문자열만 쓸 수 있고, 기본 속성(toString 등)과 충돌 가능성이 있다.
 * Map은 이 문제가 없고, size 속성으로 현재 크기를 O(1)로 알 수 있다.
 */
const ipStore = new Map();

/**
 * 오래된 IP 기록을 정리하는 함수.
 *
 * [왜 필요한가?]
 * ipStore가 무한정 커지면 메모리 문제가 생긴다.
 * 만료된(resetAt < now) 엔트리는 더 이상 필요 없으므로 주기적으로 삭제한다.
 * 이 함수는 서버 시작 시 일정 주기로 자동 실행된다.
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [ip, record] of ipStore.entries()) {
    if (now > record.resetAt) {
      ipStore.delete(ip);
    }
  }
}

// 만료 엔트리 정리를 윈도우 크기(windowMs)의 2배 주기로 실행한다.
// 서버가 살아있는 한 주기적으로 실행되므로 메모리 누수를 막는다.
setInterval(cleanupExpiredEntries, config.rateLimit.windowMs * 2);

/**
 * rateLimitMiddleware — Express 미들웨어
 *
 * 요청한 IP가 windowMs 이내에 maxRequests 이상 요청했으면
 * 429 Too Many Requests를 반환하고 처리를 중단한다.
 */
function rateLimitMiddleware(req, res, next) {
  // ── IP 추출 ──
  // req.ip는 Express가 자동으로 파싱한 클라이언트 IP이다.
  // 프록시 뒤에 배포할 경우 app.set('trust proxy', 1)이 필요하다.
  // (app.js에서 설정함)
  const ip = req.ip || req.connection.remoteAddress || "unknown";

  const now = Date.now();
  const { windowMs, maxRequests } = config.rateLimit;

  const record = ipStore.get(ip);

  if (!record || now > record.resetAt) {
    // ── 새 윈도우 시작 ──
    // 기록이 없거나 이전 윈도우가 만료됐으면 카운터를 1로 리셋한다.
    ipStore.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return next();
  }

  if (record.count >= maxRequests) {
    // ── 한도 초과 ──
    // 현재 윈도우에서 maxRequests를 이미 다 소진한 경우.
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);

    // Retry-After 헤더: 클라이언트가 언제 다시 시도할 수 있는지 알 수 있게 한다.
    // 표준 HTTP 헤더이므로 자동화 클라이언트도 올바르게 처리할 수 있다.
    res.set("Retry-After", String(retryAfterSec));

    return res.status(429).json({
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      retryAfterSeconds: retryAfterSec,
    });
  }

  // ── 정상 통과 ──
  record.count++;
  next();
}

module.exports = rateLimitMiddleware;
