/**
 * api.js — 백엔드 API 호출 서비스
 *
 * [왜 이 파일이 분리되어 있는가?]
 * fetch 호출을 컴포넌트 안에 직접 쓰면:
 *   - 백엔드 URL이 여러 컴포넌트에 흩어진다
 *   - 에러 처리 로직이 중복된다
 *   - 나중에 엔드포인트가 바뀌면 여러 파일을 수정해야 한다
 *
 * 이 파일에 API 호출을 모아두면 컴포넌트는 "어떻게 가져오는가"를 몰라도 된다.
 */

/**
 * fetchBalance — 지갑 잔액을 백엔드 API에서 조회한다.
 *
 * @param {string} address - 사용자가 입력한 Ethereum 주소
 * @returns {Promise<{
 *   address: string,
 *   balance: string,
 *   unit: string,
 *   cached: boolean,
 *   cachedAt: string | null
 * }>}
 * @throws {Error} 네트워크 오류 또는 API 에러 시 throw.
 *                 error.message에 사용자에게 보여줄 메시지가 담긴다.
 */
export async function fetchBalance(address) {
  // Vite proxy 덕분에 절대 URL이 필요 없다.
  // /api/balance → Vite가 http://localhost:5000/api/balance로 전달한다.
  const url = `/api/balance?address=${encodeURIComponent(address)}`;

  let response;
  try {
    response = await fetch(url);
  } catch (networkError) {
    // fetch 자체가 실패한 경우: 서버가 꺼져있거나 네트워크 없음
    throw new Error("서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.");
  }

  const data = await response.json();

  if (!response.ok) {
    // 4xx, 5xx 응답: 서버가 error 필드를 담아 반환한 경우
    // data.error가 없으면 상태 코드 기반 기본 메시지를 사용한다.
    const message =
      data?.error ||
      (response.status === 429
        ? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."
        : response.status === 400
        ? "유효하지 않은 주소입니다."
        : "잔액 조회에 실패했습니다.");

    const err = new Error(message);
    err.status = response.status;

    // rate limit 응답에서 재시도 가능 시간을 추출
    if (response.status === 429 && data?.retryAfterSeconds) {
      err.retryAfterSeconds = data.retryAfterSeconds;
    }

    throw err;
  }

  return data;
}
