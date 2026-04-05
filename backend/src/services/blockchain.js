/**
 * blockchain.js — Alchemy RPC 호출 서비스
 *
 * ──────────────────────────────────────────────────────────
 * [왜 이 파일이 분리되어 있는가?]
 * Alchemy 호출 로직을 라우트 핸들러에 직접 쓰면:
 *   - 라우트 파일이 비대해진다
 *   - 나중에 Alchemy를 다른 RPC 제공자로 교체할 때 라우트도 수정해야 한다
 *   - 단위 테스트가 어려워진다
 *
 * 이 파일에 Alchemy 관련 코드를 모아두면:
 *   - RPC 제공자를 교체해도 이 파일만 수정하면 된다
 *   - 라우트는 "어떤 주소의 잔액이 필요하다"만 알면 된다
 *
 * [왜 ethers.js인가?]
 * Alchemy를 직접 HTTP POST로 호출하는 것도 가능하다 (JSON-RPC 스펙):
 *   POST https://eth-sepolia.../v2/API키
 *   { "method": "eth_getBalance", "params": ["0x...", "latest"], "id": 1 }
 *
 * ethers.js를 사용하면:
 *   - wei → ETH 변환(formatEther)을 직접 구현하지 않아도 된다
 *   - 잘못된 주소 처리, 재시도 등 엣지케이스를 라이브러리가 처리한다
 *   - 코드가 간결해진다
 *
 * [왜 Provider를 모듈 레벨에서 한 번만 생성하는가?]
 * 매 요청마다 new ethers.JsonRpcProvider()를 생성하면:
 *   - 요청마다 새 HTTP 연결 협상이 발생한다 (느림)
 *   - 불필요한 메모리 할당이 반복된다
 * 모듈이 처음 로드될 때 한 번 생성하고 재사용하면 연결을 효율적으로 관리한다.
 *
 * [에러 처리 원칙 — 시나리오 6: 정보 노출 방지]
 * error.message를 클라이언트에 그대로 반환하면 안 된다.
 * ethers.js 에러 메시지에는 이런 정보가 포함될 수 있다:
 *   "could not detect network (event="noNetwork", version=6.9.0)"
 *   → 사용 중인 라이브러리와 버전 노출
 *   "invalid API key"
 *   → Alchemy 키 관련 힌트
 *
 * 대신: 서버 로그에 상세를 남기고, 클라이언트에는 일반 메시지만 반환한다.
 * ──────────────────────────────────────────────────────────
 */

"use strict";

const { ethers } = require("ethers");
const config = require("../config");

// ── Provider 초기화 ──
// JsonRpcProvider: HTTP(S) 엔드포인트를 사용하는 Ethereum 연결 객체.
// ALCHEMY_URL은 "https://eth-sepolia.g.alchemy.com/v2/{API키}" 형식이다.
// 이 URL은 서버 환경변수에만 존재하므로 클라이언트에 절대 노출되지 않는다.
const provider = new ethers.JsonRpcProvider(config.alchemyUrl);

/**
 * getBalance — 주어진 Ethereum 주소의 잔액을 조회한다.
 *
 * @param {string} address - EIP-55 정규화된 Ethereum 주소
 * @returns {Promise<string>} ETH 단위 잔액 문자열 (예: "2.500000000000000000")
 * @throws {Error} Alchemy 호출 실패 시 throw. 메시지는 내부용으로 서버 로그에만 남긴다.
 */
async function getBalance(address) {
  // provider.getBalance()가 내부적으로 하는 일:
  //   1. JSON-RPC 요청 생성:
  //      { "method": "eth_getBalance", "params": ["0x...", "latest"], "id": 1, "jsonrpc": "2.0" }
  //   2. ALCHEMY_URL로 HTTPS POST 요청
  //   3. Alchemy가 Ethereum 노드에서 잔액(wei 단위, 16진수)을 조회해 반환
  //   4. ethers.js가 BigInt로 파싱
  //
  // "latest"는 가장 최근에 확정된 블록 기준으로 잔액을 조회한다는 의미다.
  const balanceWei = await provider.getBalance(address);

  // ── wei → ETH 변환 ──
  // Ethereum의 최소 단위는 wei. 1 ETH = 10^18 wei.
  // formatEther()는 BigInt wei 값을 소수점이 있는 ETH 문자열로 변환한다.
  // 예: 2000000000000000000n → "2.0"
  //     1500000000000000000n → "1.5"
  //     0n                   → "0.0"
  const balanceEth = ethers.formatEther(balanceWei);

  return balanceEth;
}

module.exports = { getBalance };
