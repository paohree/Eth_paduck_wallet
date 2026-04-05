// AddressInput.jsx — 주소 입력 컴포넌트
// 주소 형식을 클라이언트에서 먼저 검증해 불필요한 서버 요청을 줄인다.
// 진짜 보안은 백엔드에서 한다. 프론트 검증은 UX와 rate limit 절약 목적이다.

import { useState } from "react";

// 받는 값: onSearch(address) 콜백, isLoading 불리언
export default function AddressInput({ onSearch, isLoading }) {
  const [inputValue, setInputValue] = useState("");
  const [validationError, setValidationError] = useState("");

  // 0x + 40자리 16진수 형식만 체크한다. 체크섬 검증은 백엔드에서 한다.
  function isValidAddress(address) {
    return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
  }

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = inputValue.trim();

    if (!trimmed) {
      setValidationError("주소를 입력해주세요.");
      return;
    }
    if (!isValidAddress(trimmed)) {
      setValidationError("유효하지 않은 주소입니다. 0x로 시작하는 42자리 주소를 입력하세요.");
      return;
    }

    setValidationError("");
    onSearch(trimmed);
  }

  function handleChange(e) {
    setInputValue(e.target.value);
    if (validationError) setValidationError("");
  }

  return (
    <form onSubmit={handleSubmit} className="address-form">
      <label className="input-label">지갑 주소</label>
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        placeholder="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
        className={`address-input ${validationError ? "input-error" : ""}`}
        disabled={isLoading}
        aria-label="Ethereum 지갑 주소"
        maxLength={42}
        spellCheck={false}
        autoComplete="off"
      />

      {validationError && (
        <p className="validation-error" role="alert">{validationError}</p>
      )}

      <button
        type="submit"
        className="search-button"
        disabled={isLoading || !inputValue.trim()}
      >
        {isLoading ? "조회 중..." : "잔액 조회"}
      </button>
    </form>
  );
}
