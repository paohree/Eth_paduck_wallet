# 요청 흐름 — 잔액 조회할 때 정확히 무슨 일이 일어나는가

설계를 하려면 "누가, 언제, 무엇을 호출하는가"를 정확히 알아야 한다.
추상적으로 "백엔드가 RPC 호출한다" 정도로만 알면 설계 결정을 내릴 수 없다.
여기서는 요청이 시작되는 순간부터 잔액이 화면에 뜨는 순간까지 모든 단계를 뜯어본다.

---

## 1. 두 가지 구조의 비교

### 구조 A: 클라이언트 직접 호출 (문제 있는 구조)

```
┌─────────────────────────────────┐
│  사용자 브라우저                  │
│                                 │
│  ┌──────────────────────────┐   │
│  │  React 앱                │   │
│  │                          │   │
│  │  ethers.JsonRpcProvider  │   │
│  │  ↓                       │   │
│  │  eth_getBalance 호출     │   │
│  └──────────────────────────┘   │
│             ↓                   │
│  Alchemy URL + API 키가          │
│  네트워크 요청에 노출됨            │
└─────────────────────────────────┘
              ↓
┌──────────────────────────────────┐
│  Alchemy RPC 노드                │
│  https://eth-sepolia.../v2/API키 │
└──────────────────────────────────┘
```

브라우저에서 Alchemy로 직접 요청이 나간다.
API 키가 포함된 URL이 네트워크 요청에 그대로 노출된다.

### 구조 B: 백엔드 중계 (이 프로젝트의 구조)

```
┌─────────────────────────────────┐
│  사용자 브라우저                  │
│                                 │
│  ┌──────────────────────────┐   │
│  │  React 앱                │   │
│  │                          │   │
│  │  fetch("/api/balance     │   │
│  │    ?address=0x...")      │   │
│  └──────────────────────────┘   │
└──────────────────┬──────────────┘
                   │ (API 키 없음)
                   ↓
┌──────────────────────────────────┐
│  Node.js 백엔드 서버              │
│                                 │
│  1. 입력값 검증                   │
│  2. Rate limit 확인              │
│  3. 캐시 확인                    │
│  4. Alchemy 호출 (여기서만)       │
│  5. 캐시 저장                    │
│  6. JSON 응답 반환               │
└──────────────────┬───────────────┘
                   │ (서버 내부에서만)
                   ↓
┌──────────────────────────────────┐
│  Alchemy RPC 노드                │
│  API 키는 서버 환경변수에만 있음   │
└──────────────────────────────────┘
```

---

## 2. 구조 B의 단계별 흐름 (상세)

### Step 1: 사용자가 주소를 입력하고 버튼을 클릭한다

React 컴포넌트에서 이벤트가 발생한다.

```jsx
// 사용자가 "조회" 버튼을 누르면
const handleSearch = async () => {
  const response = await fetch(`/api/balance?address=${inputAddress}`);
  const data = await response.json();
  setBalance(data.balance);
};
```

이 시점에서 네트워크 요청이 시작된다.
요청 대상은 **우리 백엔드** (`/api/balance`)이고, Alchemy가 아니다.
브라우저 개발자 도구 Network 탭에는 우리 서버로 나가는 요청만 보인다.

### Step 2: 요청이 백엔드 서버에 도달한다

Express 서버의 라우터가 요청을 받는다.

```javascript
// GET /api/balance?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
app.get("/api/balance", async (req, res) => {
  const { address } = req.query;
  // 이제 여기서 처리한다
});
```

요청에는:
- HTTP 메서드: GET
- 경로: `/api/balance`
- 쿼리 파라미터: `address=0x...`
- 헤더: 브라우저가 자동으로 붙인 것들 (User-Agent, Accept 등)
- 클라이언트 IP: rate limiting에서 사용할 정보

### Step 3: 입력값 검증

받은 `address`가 올바른 Ethereum 주소 형식인지 확인한다.

Ethereum 주소의 규칙:
- `0x`로 시작한다
- 이후 40자리의 16진수 문자 (0-9, a-f)
- 총 42자리

```
올바른 예: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
틀린 예:   0xABCD (너무 짧음)
틀린 예:   hello (형식 자체가 다름)
틀린 예:   (비어있음)
```

검증을 통과하지 못하면 Alchemy 호출 없이 즉시 400 Bad Request를 반환한다.
이 단계가 없으면 잘못된 주소로 Alchemy를 계속 호출하게 된다.

### Step 4: Rate Limit 확인

이 클라이언트가 너무 많은 요청을 보내고 있는지 확인한다.

예를 들어 "같은 IP에서 1분에 10번" 제한을 걸었다면,
11번째 요청에서는 Alchemy 호출 없이 429 Too Many Requests를 반환한다.

Rate limiting의 핵심은 **순서**다.
입력값 검증이 rate limit보다 먼저 와야 한다.
왜냐면, 잘못된 입력값은 rate limit 카운트에 포함시키지 않는 게 맞기 때문이다.
(아니면 틀린 주소만 계속 보내서 정상 요청을 막을 수 있다)

### Step 5: 캐시 확인

같은 주소에 대한 최근 결과가 캐시에 있는지 확인한다.

```
캐시에 { "0xd8dA...": { balance: "2.0", cachedAt: 1234567890 } } 가 있다면:
  현재 시간 - cachedAt < TTL(예: 30초) → 캐시 반환 (Alchemy 호출 없음)
  현재 시간 - cachedAt ≥ TTL → 캐시 만료, Alchemy 호출로 진행
```

캐시 히트 시 요청 처리가 여기서 끝난다.
빠른 응답 속도 + Alchemy 호출 횟수 절약.

### Step 6: Alchemy 호출 (핵심)

캐시에 없거나 만료됐을 때만 여기까지 온다.

```javascript
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);
const balanceWei = await provider.getBalance(address);
const balanceEth = ethers.formatEther(balanceWei);
```

내부적으로 일어나는 일:
1. ethers.js가 JSON-RPC 요청을 만든다
2. `process.env.ALCHEMY_URL` (서버 환경변수)로 HTTPS POST 요청을 보낸다
3. Alchemy 서버가 Ethereum 노드에서 잔액을 조회한다
4. wei 단위의 16진수 값이 반환된다
5. `ethers.formatEther()`가 "2.0" 같은 읽기 좋은 문자열로 변환한다

이 과정에서 클라이언트는 Alchemy URL을 전혀 볼 수 없다.
서버 내부에서 일어나는 일이기 때문이다.

### Step 7: 캐시에 저장

Alchemy에서 받은 결과를 캐시에 저장한다.

```javascript
cache.set(address, {
  balance: balanceEth,
  cachedAt: Date.now()
});
```

같은 주소에 대한 다음 요청은 TTL 이내라면 Step 5에서 바로 반환된다.

### Step 8: 클라이언트에 응답

```javascript
res.json({
  address: address,
  balance: balanceEth,
  unit: "ETH",
  cached: false  // 또는 true (캐시에서 왔으면)
});
```

응답에 `cached` 여부를 포함하면, 프론트에서 "캐시된 데이터입니다"를 표시할 수 있다.
이건 설계 결정이다. 넣을 것인가 말 것인가?

### Step 9: React가 화면에 표시

```jsx
// fetch 응답을 받아서 상태 업데이트
const data = await response.json();
setBalance(data.balance);  // "2.0"

// JSX에서 표시
<p>{balance} ETH</p>
```

---

## 3. 비용이 발생하는 지점

전체 흐름에서 어디에 "비용"이 발생하는지 정확히 짚어보자.

```
사용자 클릭
    │
    ↓
React → 백엔드 HTTP 요청          비용: 거의 없음 (내부 네트워크)
    │
    ↓
입력값 검증                        비용: 없음 (CPU 마이크로초)
    │
    ↓
Rate limit 확인                    비용: 없음 (메모리 조회)
    │
    ↓
캐시 확인
 ├─ 히트 → 즉시 반환               비용: 없음 (메모리 조회)
 └─ 미스 → 아래로 진행
    │
    ↓
Alchemy HTTP 요청                  ★ 비용 발생 (API 요청 1건 카운트)
    │
    ↓
응답 처리 → 캐시 저장 → 반환       비용: 없음
```

**비용이 발생하는 지점은 딱 하나: Alchemy를 호출하는 순간.**

설계의 목표는 이 지점에 도달하는 요청 수를 통제하는 것이다.
입력값 검증, rate limiting, 캐싱은 모두 이 지점 앞에 세우는 방어선이다.

---

## 4. 오류가 발생할 수 있는 지점과 처리

### Alchemy가 오류를 반환하는 경우

- 네트워크 장애
- API 한도 초과
- Alchemy 서버 장애

이 경우 백엔드가 클라이언트에게 적절한 에러 응답을 줘야 한다.

```javascript
try {
  const balance = await provider.getBalance(address);
  res.json({ balance: ethers.formatEther(balance) });
} catch (error) {
  res.status(503).json({ error: "블록체인 노드 조회 실패. 잠시 후 다시 시도해주세요." });
}
```

### 클라이언트에게 내부 오류 상세를 노출하면 안 된다

나쁜 예:
```json
{ "error": "Error: could not detect network (event=\"noNetwork\", code=NETWORK_ERROR, version=6.9.0)" }
```

Alchemy URL, 사용 중인 라이브러리 버전 등 공격자에게 유용한 정보가 노출된다.

좋은 예:
```json
{ "error": "잔액 조회에 실패했습니다. 잠시 후 다시 시도해주세요." }
```

---

## 5. HTTP 상태 코드 정리

이 프로젝트에서 사용할 상태 코드:

| 상황 | 상태 코드 | 의미 |
|------|-----------|------|
| 정상 | 200 OK | 잔액 반환 성공 |
| 주소 형식 오류 | 400 Bad Request | 클라이언트 잘못 |
| Rate limit 초과 | 429 Too Many Requests | 너무 많은 요청 |
| Alchemy 오류 | 503 Service Unavailable | 외부 서비스 장애 |
| 서버 내부 오류 | 500 Internal Server Error | 예상치 못한 오류 |

상태 코드를 정확하게 반환하면:
- 클라이언트가 상황에 맞게 대응할 수 있다 (재시도 여부 판단 등)
- API를 사용하는 개발자가 디버깅하기 쉽다

---

## 6. CORS 문제

React (포트 3000)와 Express (포트 5000)가 다른 출처(Origin)에서 실행된다.
브라우저는 보안상 다른 출처의 API를 기본적으로 차단한다. 이를 **CORS**라고 한다.

개발 환경에서 이를 허용하려면 백엔드에 cors 미들웨어가 필요하다.

```javascript
const cors = require("cors");
app.use(cors({ origin: "http://localhost:3000" }));
```

배포 환경에서는 실제 프론트엔드 도메인으로 제한해야 한다.
`origin: "*"` (모든 출처 허용)은 개발 편의용이지 운영에서는 피해야 한다.

---

## 요약: 흐름의 핵심만

```
[클라이언트]  →  [백엔드]  →  [Alchemy]
                   ↑
              여기서 통제:
              - 입력값 검증 (400)
              - Rate limiting (429)
              - 캐싱 (Alchemy 호출 생략)
```

Alchemy에 도달하는 요청을 얼마나 잘 통제하는가.
이것이 이 프로젝트 설계의 전부다.
