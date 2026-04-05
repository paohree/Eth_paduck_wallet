// blockchain.js — Alchemy RPC 호출 서비스
// ethers.js를 통해 Alchemy에 잔액 조회 요청을 보낸다.
// RPC 제공자를 교체해야 할 때 이 파일만 수정하면 된다.
//
// ethers.js를 쓰는 이유:
//   JSON-RPC 요청 포맷 구성, wei→ETH 변환, 에러 처리를 직접 구현하지 않아도 된다.
//
// Provider를 모듈 레벨에서 한 번만 생성하는 이유:
//   매 요청마다 생성하면 HTTP 연결 오버헤드가 반복된다.

"use strict";

const { ethers } = require("ethers");
const config = require("../config");

const provider = new ethers.JsonRpcProvider(config.alchemyUrl);

// 받는 값: EIP-55 정규화된 이더리움 주소
// 반환값: ETH 단위 잔액 문자열 (예: "2.5")
// 실패 시: Error throw — 메시지는 서버 로그용이며 클라이언트에 노출하지 않는다.
async function getBalance(address) {
  const balanceWei = await provider.getBalance(address);
  return ethers.formatEther(balanceWei); // wei → ETH 변환 (1 ETH = 10^18 wei)
}

module.exports = { getBalance };
