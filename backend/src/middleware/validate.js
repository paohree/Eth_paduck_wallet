// validate.js — 입력값 검증 미들웨어
// Alchemy를 호출하기 전에 주소 형식을 검증한다.
// 잘못된 주소를 걸러내지 않으면 매 요청마다 Alchemy 호출이 발생해 API 한도가 소모된다.
//
// ethers.isAddress()를 쓰는 이유:
//   정규식은 형식만 체크하지만, ethers.isAddress()는 EIP-55 체크섬까지 검증한다.
//   ethers.js는 이미 blockchain.js에서 사용 중이므로 추가 의존성이 없다.
//
// 주소 정규화(ethers.getAddress)를 하는 이유:
//   "0xabc..."와 "0xABC..."는 같은 주소지만 문자열이 다르다.
//   정규화하지 않으면 캐시 키가 달라져 같은 주소를 여러 번 조회하게 된다.

"use strict";

const { ethers } = require("ethers");

// 받는 값: req.query.address (사용자 입력 문자열)
// 통과 시: req.normalizedAddress에 EIP-55 정규화된 주소를 저장하고 next() 호출
// 실패 시: 400 반환
function validateAddress(req, res, next) {
  const { address } = req.query;

  if (!address || typeof address !== "string") {
    return res.status(400).json({
      error: "address 파라미터가 필요합니다.",
      example: "/api/balance?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    });
  }

  const trimmed = address.trim();

  // 42자 초과는 유효한 이더리움 주소가 아니다. ethers.isAddress()에 넘기기 전에 차단.
  if (trimmed.length > 42) {
    return res.status(400).json({ error: "유효하지 않은 Ethereum 주소입니다." });
  }

  if (!ethers.isAddress(trimmed)) {
    return res.status(400).json({ error: "유효하지 않은 Ethereum 주소입니다." });
  }

  req.normalizedAddress = ethers.getAddress(trimmed);
  next();
}

module.exports = validateAddress;
