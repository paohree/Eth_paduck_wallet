// api.js — 백엔드 API 호출
// fetch 호출을 한 곳에서 관리한다. 컴포넌트는 이 함수만 호출하면 된다.

// 받는 값: 이더리움 주소 문자열
// 반환값: { address, balance, unit, cached, cachedAt }
// 실패 시: Error throw. error.message는 사용자에게 보여줄 한국어 메시지.
export async function fetchBalance(address) {
  const url = `/api/balance?address=${encodeURIComponent(address)}`;

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.");
  }

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error ||
      (response.status === 429
        ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
        : response.status === 400
        ? "유효하지 않은 주소입니다."
        : "잔액 조회에 실패했습니다.");

    const err = new Error(message);
    err.status = response.status;
    if (response.status === 429 && data?.retryAfterSeconds) {
      err.retryAfterSeconds = data.retryAfterSeconds;
    }
    throw err;
  }

  return data;
}
