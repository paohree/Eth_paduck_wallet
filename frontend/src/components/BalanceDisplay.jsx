// BalanceDisplay.jsx — 조회 결과 표시 컴포넌트
// 에러, 성공, 초기 세 가지 상태를 처리한다.

// 받는 값:
//   result: { address, balance, unit, cached, cachedAt } | null
//   error:  { message, status, retryAfterSeconds } | null
export default function BalanceDisplay({ result, error }) {
  if (error) {
    return (
      <div className="result-card error-card" role="alert">
        <div className="error-icon">⚠️</div>
        <p className="error-message">{error.message}</p>
        {error.retryAfterSeconds && (
          <p className="retry-hint">{error.retryAfterSeconds}초 후에 다시 시도해주세요.</p>
        )}
        {error.status && <p className="error-status">HTTP {error.status}</p>}
      </div>
    );
  }

  if (result) {
    const displayBalance = parseFloat(result.balance).toFixed(6);
    const shortAddress = `${result.address.slice(0, 6)}...${result.address.slice(-5)}`;
    const cachedTimeStr = result.cachedAt
      ? new Date(result.cachedAt).toLocaleTimeString("ko-KR")
      : null;

    return (
      <div className="result-card success-card">
        <div className="balance-section">
          <p className="balance-label">총 잔액</p>
          <div className="balance-amount">
            <span className="balance-number">{displayBalance}</span>
            <span className="balance-unit">ETH</span>
          </div>
        </div>

        <div className="address-section">
          <span className="address-label">주소</span>
          <span className="address-value" title={result.address}>{shortAddress}</span>
        </div>

        {/* cached 필드를 표시하는 이유: 값이 왜 바뀌지 않는지 사용자가 알 수 있게 하기 위해 */}
        <div className="cache-section">
          <span className={`cache-badge ${result.cached ? "badge-cached" : "badge-fresh"}`}>
            {result.cached ? `캐시된 데이터 (${cachedTimeStr} 기준)` : "최신 데이터 (방금 조회)"}
          </span>
        </div>
      </div>
    );
  }

  return null;
}
