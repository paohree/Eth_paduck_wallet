// App.jsx — 루트 컴포넌트
// 상태(조회 결과, 에러, 로딩)를 관리하고 하위 컴포넌트를 조합한다.

import { useState } from "react";
import AddressInput from "./components/AddressInput";
import BalanceDisplay from "./components/BalanceDisplay";
import TestPanel from "./components/TestPanel";
import { fetchBalance } from "./services/api";

export default function App() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 받는 값: 검증된 이더리움 주소 (AddressInput에서 전달)
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
      <header className="app-header">
        <div className="header-left">
          <span className="duck-icon">🐥</span>
          <span className="app-title">Paduck Wallet</span>
        </div>
        <span className="network-badge">Sepolia</span>
      </header>

      <div className="account-section">
        <div className="account-avatar">🐥</div>
        <p className="account-label">지갑 주소를 입력해 잔액을 조회하세요</p>
      </div>

      <main className="app-main">
        <AddressInput onSearch={handleSearch} isLoading={isLoading} />

        {isLoading && (
          <div className="loading-indicator" aria-live="polite">
            <div className="spinner" />
            <span>잔액을 조회하는 중...</span>
          </div>
        )}

        {!isLoading && <BalanceDisplay result={result} error={error} />}
      </main>

      <TestPanel />

      <footer className="app-footer">
        Ethereum Sepolia Testnet
      </footer>
    </div>
  );
}
