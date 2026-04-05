/**
 * BalanceDisplay.jsx — 잔액 조회 결과 표시 컴포넌트
 *
 * 세 가지 상태를 처리한다:
 *   1. 에러 상태: 조회 실패 시 에러 메시지 표시
 *   2. 성공 상태: 잔액, 주소, 캐시 여부 표시
 *   3. 초기 상태: 아무것도 표시하지 않음
 */

/**
 * @param {{
 *   result: {
 *     address: string,
 *     balance: string,
 *     unit: string,
 *     cached: boolean,
 *     cachedAt: string | null,
 *   } | null,
 *   error: { message: string, status?: number, retryAfterSeconds?: number } | null,
 * }} props
 */
export default function BalanceDisplay({ result, error }) {
  // ── 에러 상태 ──
  if (error) {
    return (
      <div className="result-card error-card" role="alert">
        <div className="error-icon">⚠️</div>
        <p className="error-message">{error.message}</p>
        {error.retryAfterSeconds && (
          <p className="retry-hint">
            {error.retryAfterSeconds}초 후에 다시 시도해주세요.
          </p>
        )}
        {error.status && (
          <p className="error-status">HTTP {error.status}</p>
        )}
      </div>
    );
  }

  // ── 성공 상태 ──
  if (result) {
    // 잔액을 소수점 6자리까지만 표시한다.
    const displayBalance = parseFloat(result.balance).toFixed(6);

    // 주소 축약 표시: 0xd8dA...96045
    const shortAddress = `${result.address.slice(0, 6)}...${result.address.slice(-5)}`;

    // 캐시된 시각을 사람이 읽기 좋은 형식으로 변환
    const cachedTimeStr = result.cachedAt
      ? new Date(result.cachedAt).toLocaleTimeString("ko-KR")
      : null;

    return (
      <div className="result-card success-card">
        {/* 잔액 메인 표시 */}
        <div className="balance-section">
          <p className="balance-label">총 잔액</p>
          <div className="balance-amount">
            <span className="balance-number">{displayBalance}</span>
            <span className="balance-unit">ETH</span>
          </div>
        </div>

        {/* 주소 */}
        <div className="address-section">
          <span className="address-label">주소</span>
          <span className="address-value" title={result.address}>
            {shortAddress}
          </span>
        </div>

        {/* 캐시 여부
            사용자가 잔액을 조회했는데 방금과 같은 값이 나오면 "왜 안 바뀌지?"라고 의아해할 수 있다.
            캐시된 데이터임을 알려주면 투명성이 높아지고 혼란이 줄어든다. */}
        <div className="cache-section">
          <span className={`cache-badge ${result.cached ? "badge-cached" : "badge-fresh"}`}>
            {result.cached
              ? `캐시된 데이터 (${cachedTimeStr} 기준)`
              : "최신 데이터 (방금 조회)"}
          </span>
        </div>
      </div>
    );
  }

  // ── 초기 상태 ──
  return null;
}
