// cache.js — 인메모리 잔액 캐시
// 같은 주소를 반복 조회할 때 Alchemy를 호출하지 않고 저장된 결과를 반환한다.
//
// TTL 30초로 설정한 이유:
//   Sepolia 블록 생성 주기 ≈ 12초. 잔액은 최소 12초에 한 번만 바뀐다.
//   30초면 실시간성을 크게 해치지 않으면서 반복 호출을 줄일 수 있다.
//
// Redis 대신 인메모리를 쓰는 이유:
//   단일 서버 환경에서 추가 인프라 없이 충분하다.
//   서버 재시작 시 캐시가 초기화되지만 서비스 중단은 아니다.

"use strict";

const config = require("../config");

const store = new Map();

// 받는 값: 정규화된 이더리움 주소
// 반환값: { balance: string, cachedAt: number } 또는 null (미스/만료)
function get(address) {
  const entry = store.get(address);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > config.cache.ttlMs) {
    store.delete(address);
    return null;
  }

  return entry;
}

// 받는 값: 정규화된 이더리움 주소, ETH 단위 잔액 문자열
function set(address, balance) {
  // 최대 크기 초과 시 가장 오래된 엔트리 삭제 (LRU 근사)
  if (store.size >= config.cache.maxSize) {
    store.delete(store.keys().next().value);
  }
  store.set(address, { balance, cachedAt: Date.now() });
}

// 반환값: { size, maxSize, ttlMs } — 디버깅/모니터링용
function getStats() {
  return { size: store.size, maxSize: config.cache.maxSize, ttlMs: config.cache.ttlMs };
}

module.exports = { get, set, getStats };
