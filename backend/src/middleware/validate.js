/**
 * validate.js — 입력값 검증 미들웨어
 *
 * ──────────────────────────────────────────────────────────
 * [문제] 입력값 검증이 없으면 어떤 일이 생기는가?
 *
 * 공격자(혹은 버그 있는 클라이언트)가 이런 요청을 보낼 수 있다:
 *   GET /api/balance?address=         (빈 값)
 *   GET /api/balance?address=hello    (형식 자체가 다름)
 *   GET /api/balance?address=0xABCD   (너무 짧음)
 *   GET /api/balance?address=<script>alert(1)</script>  (XSS 시도)
 *
 * 검증 없이 이 값들을 Alchemy에 그대로 전달하면:
 *   1. Alchemy가 "invalid address" 에러를 반환한다 → 요청 1건 소비
 *   2. 매번 다른 잘못된 주소를 보내면 캐시 히트가 없어 매번 Alchemy를 호출한다
 *   3. <script> 같은 값이 응답에 포함되어 HTML에 렌더링되면 XSS 공격이 된다
 *
 * [왜 이게 문제인가?]
 * Alchemy API는 요청당 과금 또는 한도가 있다.
 * 잘못된 입력으로 인한 호출도 카운트된다.
 * 즉, 공격자는 우리 비용/한도를 소모하면서 자신은 아무것도 잃지 않는다.
 *
 * [어떻게 막는가?]
 * Alchemy를 호출하기 전에 입력값을 검증한다.
 * 검증 실패 시 즉시 400을 반환하고, Alchemy 호출은 일어나지 않는다.
 *
 * [왜 ethers.isAddress()를 쓰는가?]
 * 선택지 A: 정규식 /^0x[0-9a-fA-F]{40}$/ → 형식만 체크, 체크섬 무시
 * 선택지 B: ethers.isAddress()            → 형식 + EIP-55 체크섬까지 검증
 *
 * ethers.js는 어차피 Alchemy 호출에 사용하므로 추가 의존성이 없다.
 * 체크섬 검증으로 오타를 잡아낼 수 있어 선택지 B가 더 엄격하고 좋다.
 *
 * [소문자 주소 처리]
 * ethers.isAddress()는 소문자 주소("0xabc..." 전부 소문자)를 유효하다고 판단한다.
 * 체크섬 형식이 아니더라도 유효한 hex 주소면 true를 반환하기 때문이다.
 * 따라서 별도의 toLowerCase() 처리 없이 그대로 사용 가능하다.
 * ──────────────────────────────────────────────────────────
 */

"use strict";

const { ethers } = require("ethers");

/**
 * validateAddress — Express 미들웨어
 *
 * req.query.address 가 유효한 Ethereum 주소인지 검증한다.
 * 유효하면 next()로 다음 미들웨어/라우트 핸들러로 넘긴다.
 * 유효하지 않으면 400 Bad Request를 반환하고 처리를 중단한다.
 */
function validateAddress(req, res, next) {
  const { address } = req.query;

  // ── 1. 존재 여부 확인 ──
  // undefined, null, 빈 문자열 모두 잡는다.
  if (!address || typeof address !== "string") {
    return res.status(400).json({
      error: "address 파라미터가 필요합니다.",
      example: "/api/balance?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    });
  }

  // ── 2. 길이 사전 검사 ──
  // Ethereum 주소는 정확히 42자("0x" + 40자리 hex).
  // 아주 긴 문자열(예: SQL injection, 버퍼 오버플로 시도)을
  // ethers.isAddress()에 넘기기 전에 미리 걸러낸다.
  // 42자를 초과하는 것은 어떤 경우에도 유효한 Ethereum 주소가 아니다.
  const trimmed = address.trim();
  if (trimmed.length > 42) {
    return res.status(400).json({
      error: "유효하지 않은 Ethereum 주소입니다.",
    });
  }

  // ── 3. ethers.isAddress() 검증 ──
  // - "0x" 접두사 확인
  // - 이후 40자리 16진수 확인
  // - EIP-55 체크섬 확인 (대소문자가 섞인 체크섬 형식이거나 전부 소문자/대문자)
  if (!ethers.isAddress(trimmed)) {
    return res.status(400).json({
      error: "유효하지 않은 Ethereum 주소입니다.",
    });
  }

  // ── 4. 정규화된 주소를 req에 저장 ──
  // ethers.getAddress()는 주어진 주소를 EIP-55 체크섬 형식으로 정규화한다.
  // 예: 0xd8da... → 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
  //
  // [왜 정규화하는가? — 캐시 오염 방지 (시나리오 5)]
  // 대소문자만 다른 세 주소는 모두 동일한 계정이다:
  //   0xd8da6bf26964af9d7eed9e03e53415d37aa96045  (소문자)
  //   0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045  (대문자)
  //   0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045  (체크섬)
  // 정규화 없이 캐시 키로 쓰면 3개의 분리된 캐시 엔트리가 생겨 Alchemy를 3번 호출한다.
  // 정규화하면 항상 같은 키 → 캐시 히트율 극대화.
  req.normalizedAddress = ethers.getAddress(trimmed);

  next();
}

module.exports = validateAddress;
