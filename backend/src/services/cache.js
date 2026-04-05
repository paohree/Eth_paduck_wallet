/**
 * cache.js — 인메모리 잔액 캐시
 *
 * ──────────────────────────────────────────────────────────
 * [문제] 캐싱이 없으면 어떤 일이 생기는가? (시나리오 4)
 *
 * 악의 없는 사용자라도 다음 행동이 Alchemy를 낭비시킨다:
 *   - 페이지 새로고침 반복
 *   - 우리 API를 자신의 서비스에 붙여서 주기적으로 호출
 *   - 모니터링 용도로 1초마다 잔액 체크
 *
 * Ethereum Sepolia 블록 생성 주기 ≈ 12초.
 * 즉, 잔액은 최소 12초에 한 번씩만 바뀔 수 있다.
 * 1초마다 조회하면 12번 중 11번은 의미없는 Alchemy 호출이다.
 *
 * [캐싱의 효과]
 * TTL 30초 동안 같은 주소에 대한 반복 요청은 Alchemy를 전혀 호출하지 않는다.
 * 트래픽이 몰리는 주소(유명한 지갑)일수록 효과가 극적이다.
 *
 * [왜 인메모리 캐시인가? (Redis 대신)]
 * Redis: TTL 내장, 서버 재시작 후에도 유지, 다중 서버 공유 가능
 *         BUT 별도 서버 설치/설정/운영 필요 → 이 과제 규모에 과함
 * 인메모리: 추가 의존성 없음, 설정 불필요, 매우 빠름
 *             BUT 서버 재시작 시 초기화, 단일 서버만 가능
 * → 이 과제는 단일 서버이므로 인메모리로 충분하다.
 *   서버를 재시작하면 캐시가 비워지지만, 이는 서비스 중단이 아닌 일시적 성능 저하일 뿐이다.
 *
 * [캐시 키: 정규화된 주소]
 * validate.js에서 ethers.getAddress()로 정규화된 주소를 캐시 키로 사용한다.
 * 대소문자 변형이 같은 키로 매핑되어 캐시 오염(시나리오 5)을 방지한다.
 * ──────────────────────────────────────────────────────────
 */

"use strict";

const config = require("../config");

/**
 * 캐시 엔트리의 구조:
 *   {
 *     balance: string,   // ETH 단위 잔액 문자열 (예: "2.0")
 *     cachedAt: number,  // 캐싱된 시각 (Date.now() 밀리초)
 *   }
 */

/** 실제 데이터를 담는 Map. 키: 정규화된 주소, 값: 캐시 엔트리 */
const store = new Map();

/**
 * get — 캐시에서 잔액을 조회한다.
 *
 * @param {string} address - 정규화된(EIP-55 체크섬) Ethereum 주소
 * @returns {{ balance: string, cachedAt: number } | null}
 *          캐시 히트 시 엔트리 반환, 미스 또는 만료 시 null 반환
 */
function get(address) {
  const entry = store.get(address);

  if (!entry) {
    // 캐시에 없음 → 미스
    return null;
  }

  const age = Date.now() - entry.cachedAt;
  if (age > config.cache.ttlMs) {
    // TTL 만료 → 엔트리 삭제 후 미스 반환
    store.delete(address);
    return null;
  }

  // 캐시 히트
  return entry;
}

/**
 * set — 잔액을 캐시에 저장한다.
 *
 * @param {string} address - 정규화된 Ethereum 주소
 * @param {string} balance - ETH 단위 잔액 문자열
 */
function set(address, balance) {
  // ── 캐시 크기 제한 ──
  // maxSize를 초과하면 가장 오래된 엔트리를 삭제한다 (LRU 근사).
  // Map의 삽입 순서가 유지되므로 .keys().next().value 가 가장 오래된 키다.
  if (store.size >= config.cache.maxSize) {
    const oldestKey = store.keys().next().value;
    store.delete(oldestKey);
  }

  store.set(address, {
    balance,
    cachedAt: Date.now(),
  });
}

/**
 * getStats — 캐시 현황을 반환한다. (디버깅/모니터링용)
 *
 * @returns {{ size: number, maxSize: number, ttlMs: number }}
 */
function getStats() {
  return {
    size: store.size,
    maxSize: config.cache.maxSize,
    ttlMs: config.cache.ttlMs,
  };
}

module.exports = { get, set, getStats };
