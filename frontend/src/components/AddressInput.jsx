/**
 * AddressInput.jsx — 주소 입력 컴포넌트
 *
 * [프론트엔드 검증]
 * 백엔드에서도 검증하지만 프론트에서도 검증하는 이유:
 *   - 즉각적인 피드백: 서버 왕복 없이 바로 에러를 보여준다
 *   - 백엔드 rate limit 카운트 낭비를 줄인다
 *   - UX 향상
 *
 * [단, 프론트엔드 검증만으로는 보안이 되지 않는다]
 * JavaScript는 브라우저에서 실행되므로 우회가 쉽다.
 * 진짜 방어선은 항상 백엔드다.
 */

import { useState } from "react";

/**
 * @param {{ onSearch: (address: string) => void, isLoading: boolean }} props
 */
export default function AddressInput({ onSearch, isLoading }) {
  const [inputValue, setInputValue] = useState("");
  const [validationError, setValidationError] = useState("");

  /**
   * 클라이언트 측 Ethereum 주소 검증.
   * 백엔드의 ethers.isAddress()와 동일한 규칙:
   *   - "0x"로 시작
   *   - 이후 40자리 16진수
   *   - 총 42자
   *
   * 체크섬 검증은 생략한다. 사용자가 소문자 주소를 붙여넣기 하는 경우가 많기 때문이다.
   * 실제 체크섬 검증은 백엔드에서 수행된다.
   */
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
      setValidationError(
        "유효하지 않은 주소입니다. 0x로 시작하는 42자리 주소를 입력하세요."
      );
      return;
    }

    setValidationError("");
    onSearch(trimmed);
  }

  function handleChange(e) {
    setInputValue(e.target.value);
    if (validationError) {
      setValidationError("");
    }
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
        <p className="validation-error" role="alert">
          {validationError}
        </p>
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
