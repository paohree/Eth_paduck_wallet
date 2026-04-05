// balance.js — GET /api/balance 라우트
// 미들웨어 순서: 입력값 검증 → rate limit → 캐시 확인 → Alchemy 호출
//
// 검증을 rate limit보다 먼저 처리하는 이유:
//   잘못된 주소 도배로 rate limit 카운트를 소모시키는 공격을 막기 위해.

"use strict";

const express = require("express");
const validateAddress = require("../middleware/validate");
const rateLimitMiddleware = require("../middleware/rateLimit");
const cache = require("../services/cache");
const { getBalance } = require("../services/blockchain");

const router = express.Router();

// 받는 값: query.address (문자열)
// 반환값: { address, balance, unit, cached, cachedAt }
router.get("/", validateAddress, rateLimitMiddleware, async (req, res) => {
  const address = req.normalizedAddress; // validate.js에서 정규화된 주소

  // 캐시 히트: Alchemy 호출 없이 반환
  const cached = cache.get(address);
  if (cached) {
    return res.json({
      address,
      balance: cached.balance,
      unit: "ETH",
      cached: true,
      cachedAt: new Date(cached.cachedAt).toISOString(),
    });
  }

  // 캐시 미스: Alchemy 호출
  try {
    const balance = await getBalance(address);
    cache.set(address, balance);
    return res.json({ address, balance, unit: "ETH", cached: false, cachedAt: null });
  } catch (err) {
    // 에러 상세는 서버 로그에만 남긴다. 클라이언트에 내부 정보를 노출하지 않는다.
    console.error(`[Balance Route] Alchemy 호출 실패. address=${address}`, err);
    return res.status(503).json({ error: "잔액 조회에 실패했습니다. 잠시 후 다시 시도해주세요." });
  }
});

module.exports = router;
