/**
 * balance.js — GET /api/balance 라우트
 *
 * 요청 처리 흐름:
 *   1. validateAddress 미들웨어  → 형식 검증, 정규화된 주소를 req.normalizedAddress에 저장
 *   2. rateLimitMiddleware       → IP 기준 분당 요청 수 제한
 *   3. 캐시 확인                 → 히트 시 Alchemy 호출 없이 즉시 반환
 *   4. Alchemy 호출              → 캐시 미스 시에만 실행
 *   5. 캐시 저장 + 응답 반환
 *
 * [미들웨어 순서가 중요한 이유]
 * validateAddress → rateLimitMiddleware 순서가 맞다.
 * 만약 순서가 반대라면:
 *   잘못된 주소를 계속 보내서 rate limit 카운트를 소모시키고,
 *   결국 정상 사용자의 유효한 요청을 차단하는 공격이 가능해진다.
 * 형식이 잘못된 요청은 카운트에 포함시키지 않는다.
 */

"use strict";

const express = require("express");
const validateAddress = require("../middleware/validate");
const rateLimitMiddleware = require("../middleware/rateLimit");
const cache = require("../services/cache");
const { getBalance } = require("../services/blockchain");

const router = express.Router();

/**
 * GET /api/balance?address=0x...
 *
 * 성공 응답 (200):
 * {
 *   "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
 *   "balance": "2.500000000000000000",
 *   "unit": "ETH",
 *   "cached": false,
 *   "cachedAt": null
 * }
 *
 * 캐시 히트 응답 (200):
 * {
 *   "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
 *   "balance": "2.500000000000000000",
 *   "unit": "ETH",
 *   "cached": true,
 *   "cachedAt": "2024-01-01T00:00:00.000Z"
 * }
 *
 * [왜 cached 필드를 응답에 포함하는가?]
 * 투명성: 사용자가 "왜 잔액이 방금과 같지?"라고 의아해할 때 이유를 알 수 있다.
 * 디버깅: 개발자가 캐시가 제대로 동작하는지 확인할 수 있다.
 * 비용 트레이드오프: 응답이 약간 커지지만, 사용자 경험 향상이 더 크다.
 */
router.get(
  "/",
  validateAddress,      // ① 입력값 검증 (형식 오류 → 400)
  rateLimitMiddleware,  // ② 요청 횟수 제한 (한도 초과 → 429)
  async (req, res) => {
    // validateAddress에서 정규화된 주소를 사용한다.
    // req.query.address 대신 req.normalizedAddress를 쓰는 이유:
    //   - 항상 EIP-55 체크섬 형식이므로 캐시 키가 일관된다
    //   - 소문자/대문자 변형이 같은 캐시 항목을 참조한다
    const address = req.normalizedAddress;

    // ── ③ 캐시 확인 ──
    const cached = cache.get(address);
    if (cached) {
      // 캐시 히트: Alchemy를 호출하지 않고 저장된 결과를 반환한다.
      return res.json({
        address,
        balance: cached.balance,
        unit: "ETH",
        cached: true,
        cachedAt: new Date(cached.cachedAt).toISOString(),
      });
    }

    // ── ④ Alchemy 호출 ──
    // 여기까지 도달하는 요청만 실제 RPC 비용이 발생한다.
    // 입력값 검증, rate limiting, 캐시 확인이 모두 앞에 있으므로
    // 이 지점에 오는 요청은 최소화된다.
    try {
      const balance = await getBalance(address);

      // ── ⑤ 캐시 저장 ──
      cache.set(address, balance);

      return res.json({
        address,
        balance,
        unit: "ETH",
        cached: false,
        cachedAt: null,
      });
    } catch (err) {
      // ── 에러 처리 — 정보 노출 방지 (시나리오 6) ──
      //
      // err.message를 클라이언트에 그대로 반환하면 안 된다.
      // 내부 구현 정보(라이브러리 버전, 네트워크 구성, API 키 힌트)가 노출될 수 있다.
      //
      // 서버 로그: 상세 오류를 기록 (운영자/개발자용)
      // 클라이언트 응답: 일반적인 메시지만 반환
      //
      // [503 vs 500]
      // 500 Internal Server Error: 예상치 못한 서버 내부 버그
      // 503 Service Unavailable: 외부 서비스(Alchemy) 장애로 인한 일시적 불가
      // Alchemy 호출 실패는 외부 원인이므로 503이 더 정확하다.
      // 503을 받은 클라이언트는 "잠시 후 재시도"가 의미 있다는 것을 알 수 있다.
      console.error(`[Balance Route] Alchemy 호출 실패. address=${address}`, err);

      return res.status(503).json({
        error: "잔액 조회에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  }
);

module.exports = router;
