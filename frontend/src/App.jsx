/**
 * App.jsx — 루트 컴포넌트
 *
 * 상태(state)를 관리하고 AddressInput, BalanceDisplay를 조합한다.
 *
 * [컴포넌트 역할 분리]
 * - App: 상태 관리, API 호출 조율
 * - AddressInput: 입력 UI, 클라이언트 검증
 * - BalanceDisplay: 결과 표시 (성공/에러)
 * - api.js: 실제 fetch 호출
 *
 * 이 분리로 각 컴포넌트의 책임이 명확해진다.
 */

import { useState } from "react";
import AddressInput from "./components/AddressInput";
import BalanceDisplay from "./components/BalanceDisplay";
import { fetchBalance } from "./services/api";

export default function App() {
  // 조회 결과 (성공 시 백엔드 응답 객체, 미조회 시 null)
  const [result, setResult] = useState(null);

  // 에러 정보 (실패 시 { message, status, retryAfterSeconds }, 없으면 null)
  const [error, setError] = useState(null);

  // 로딩 상태 (fetch 중일 때 true)
  const [isLoading, setIsLoading] = useState(false);

  /**
   * handleSearch — 잔액 조회를 실행하는 메인 함수
   *
   * @param {string} address - 검증된 Ethereum 주소 (AddressInput에서 전달)
   */
  async function handleSearch(address) {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await fetchBalance(address);
      setResult(data);
    } catch (err) {
      setError({
        message: err.message,
        status: err.status,
        retryAfterSeconds: err.retryAfterSeconds,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="app-container">
      {/* 헤더 */}
      <header className="app-header">
        <div className="header-left">
          <span className="duck-icon">🐥</span>
          <span className="app-title">Paduck Wallet</span>
        </div>
        <span className="network-badge">Sepolia</span>
      </header>

      {/* 계정 아이콘 */}
      <div className="account-section">
        <div className="account-avatar">🐥</div>
        <p className="account-label">지갑 주소를 입력해 잔액을 조회하세요</p>
      </div>

      {/* 메인 */}
      <main className="app-main">
        <AddressInput onSearch={handleSearch} isLoading={isLoading} />

        {isLoading && (
          <div className="loading-indicator" aria-live="polite">
            <div className="spinner" />
            <span>잔액을 조회하는 중...</span>
          </div>
        )}

        {!isLoading && (
          <BalanceDisplay result={result} error={error} />
        )}
      </main>

      <footer className="app-footer">
        Ethereum Sepolia Testnet
      </footer>
    </div>
  );
}
