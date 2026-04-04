# 보호 패턴 — 선택지와 트레이드오프

`abuse_scenarios.md`에서 확인한 위협들에 대응하기 위한 패턴들을 다룬다.
각 패턴마다 "어떻게 동작하는가", "어떤 선택지가 있는가", "트레이드오프는 무엇인가"를 정리한다.

**이 문서는 설계 결정을 대신 내려주지 않는다.**
각 섹션 끝에 있는 "생각해볼 것"이 네가 직접 결정해야 할 지점이다.
결정하고 그 이유를 설명할 수 있으면, 그게 좋은 설계다.

---

## 패턴 1: 입력값 검증 (Input Validation)

### 왜 하는가

Alchemy를 호출하기 전에 요청이 처리할 가치가 있는지 확인한다.
잘못된 입력값은 즉시 거절해서 불필요한 처리를 막는다.

### Ethereum 주소의 규칙

```
유효한 Ethereum 주소:
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

규칙:
- 반드시 "0x"로 시작
- 이후 정확히 40자리의 16진수 (0-9, a-f, A-F)
- 총 길이: 42자
```

추가로, EIP-55라는 체크섬 표준이 있다.
같은 주소를 대소문자를 섞어서 표현하는 방식으로, 오타를 감지하는 역할을 한다.
`0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`에서 대소문자 패턴이 체크섬이다.

### 선택지 A: 정규식으로 직접 검증

```javascript
function isValidEthAddress(address) {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
```

- 장점: 외부 의존성 없음. 코드가 단순하고 이해하기 쉽다.
- 단점: 형식은 맞지만 체크섬이 틀린 주소도 통과시킨다.

### 선택지 B: ethers.isAddress() 사용

```javascript
const { ethers } = require("ethers");

function isValidEthAddress(address) {
  return ethers.isAddress(address);
}
```

- 장점: 체크섬까지 검증. ethers는 어차피 RPC 호출에도 쓰므로 추가 의존성 없음.
- 단점: 체크섬이 없는 소문자 주소(`0x...` 전부 소문자)는 false를 반환할 수 있다.
  → 이 경우 `ethers.isAddress(address.toLowerCase())`로 해결 가능하지만 UX 판단이 필요.

### 검증 실패 시 응답

```javascript
if (!isValidEthAddress(address)) {
  return res.status(400).json({
    error: "유효하지 않은 Ethereum 주소입니다.",
    input: address  // 이걸 포함할 것인가? 보안상 고민 포인트
  });
}
```

### 생각해볼 것
- 프론트엔드에서도 검증을 할 것인가, 백엔드에서만 할 것인가?
  - 프론트: 사용자 경험 향상 (즉각 피드백), 하지만 우회 가능
  - 백엔드: 실제 방어선, 필수
  - 둘 다 하는 것이 일반적이지만, 백엔드는 반드시 해야 한다
- 빈 주소, null, undefined가 들어오는 경우도 처리해야 한다

---

## 패턴 2: Rate Limiting (요청 횟수 제한)

### 왜 하는가

특정 클라이언트가 단시간에 과도한 요청을 보내는 것을 막는다.
정상적인 사용 패턴과 남용을 구분하는 첫 번째 방어선이다.

### Rate Limiting의 핵심 개념: 슬라이딩 윈도우 vs 고정 윈도우

**고정 윈도우(Fixed Window)**

"1분에 10번"이라는 규칙을 적용할 때, 1분을 딱 잘라서 본다.

```
0:00 ~ 1:00  요청 10번 → 한도 소진
1:00 ~ 2:00  새로운 1분 시작 → 다시 10번 허용
```

문제: 0:55에 10번, 1:05에 10번 → 10초 사이에 20번이 가능하다.

**슬라이딩 윈도우(Sliding Window)**

"최근 1분 동안" 요청 수를 계속 추적한다.
어느 시점에서 보더라도 직전 1분 동안의 요청이 10번을 넘지 않게 한다.

더 정밀하지만 구현이 약간 복잡하다.

### 누구를 기준으로 제한할 것인가

| 기준 | 구현 난이도 | 정확도 | 우회 가능성 |
|------|-----------|--------|-----------|
| IP 주소 | 낮음 | 중간 | VPN/프록시로 우회 가능 |
| 사용자 계정 | 높음 (로그인 필요) | 높음 | 계정 여러 개 생성으로 우회 가능 |
| API 키 | 중간 (발급 시스템 필요) | 높음 | 어려움 |

이 과제에서는 로그인 시스템을 만들지 않으므로 **IP 기반**이 현실적이다.

### IP 기반 Rate Limiting의 한계 (알고 선택해야 한다)

1. **VPN/프록시**: IP를 쉽게 바꿀 수 있다. 결심한 공격자는 우회 가능.
2. **NAT 환경**: 학교나 회사 같은 곳에서는 여러 사람이 같은 외부 IP를 공유한다.
   한 사람이 한도를 채우면 같은 IP의 다른 정상 사용자도 차단된다.
3. **IPv6**: IPv6는 주소 범위가 너무 넓어서 IP 기반 제한이 효과가 덜하다.

이 한계를 알고 선택했다면 README에 "IP 기반 rate limiting을 선택했으며, VPN 우회의 한계를 인식하고 있다"고 쓸 수 있다. 이게 좋은 설계 문서다.

### 선택지 A: express-rate-limit 라이브러리

```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1분
  max: 10,              // 최대 10번
  message: { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
  standardHeaders: true,  // Rate limit 정보를 응답 헤더에 포함
  legacyHeaders: false,
});

app.use("/api/balance", limiter);
```

응답 헤더에 자동으로 포함되는 정보:
```
RateLimit-Limit: 10
RateLimit-Remaining: 7
RateLimit-Reset: 2024-01-01T00:01:00Z
```

- 장점: 구현이 매우 간단. 검증된 라이브러리. 슬라이딩 윈도우 지원.
- 단점: 패키지 의존성 추가. 인메모리 저장이라 서버 재시작 시 카운트 초기화.

### 선택지 B: 직접 구현

```javascript
const requestCounts = new Map();
// 구조: { "1.2.3.4": { count: 5, resetAt: 타임스탬프 } }

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 10;

  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    // 새 윈도우 시작
    requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    return res.status(429).json({
      error: "요청이 너무 많습니다.",
      retryAfter: Math.ceil((record.resetAt - now) / 1000)
    });
  }

  record.count++;
  next();
}
```

- 장점: 의존성 없음. 내부 동작을 완전히 이해하고 제어 가능.
- 단점: 직접 엣지케이스를 처리해야 함. Map이 무한정 커질 수 있음 (오래된 엔트리 정리 필요).

### Rate Limit 숫자는 어떻게 정할까

정답은 없다. 기준이 되는 질문:
- 정상 사용자는 1분에 몇 번 조회하는가?
  → 지갑 잔액을 수동으로 확인하는 경우 1분에 1~2번이 자연스럽다
- 너무 엄격하면 정상 사용자가 차단된다
- 너무 느슨하면 남용 방지 효과가 없다

이 과제에서는 "1분에 10번" 정도가 합리적이다.
README에서 이 숫자를 선택한 이유를 설명하면 된다.

### 생각해볼 것
- Rate limit에 걸렸을 때 클라이언트에게 언제 재시도할 수 있는지 알려줄 것인가?
  (`Retry-After` 헤더 또는 응답 바디에 포함)
- 라이브러리를 쓰는 것과 직접 구현하는 것 중 어떤 선택을 할 것인가?
  이 과제에서는 어떤 선택이 네 역량을 더 잘 보여줄 수 있는가?

---

## 패턴 3: 캐싱 (Caching)

### 왜 하는가

동일한 주소에 대한 반복 요청 시 Alchemy를 다시 호출하지 않는다.
같은 결과를 일정 시간 동안 저장해두고 재사용한다.

이점:
- Alchemy API 호출 횟수 절약
- 응답 속도 향상 (Alchemy 왕복 없이 메모리에서 바로 반환)
- 동일한 공격적 반복 요청의 영향 최소화

### TTL (Time To Live) 결정

TTL은 캐시된 데이터를 얼마나 오래 유지할 것인가를 결정한다.

Ethereum Sepolia 블록 생성 주기: 약 12초
→ 잔액은 최소 12초에 한 번씩만 바뀔 수 있다

TTL 선택의 트레이드오프:

| TTL | 장점 | 단점 |
|-----|------|------|
| 5초 | 거의 실시간 데이터 | Alchemy 호출 많음 |
| 30초 | 호출 30배 절약 | 최대 30초 오래된 데이터 가능 |
| 60초 | 호출 60배 절약 | 최대 1분 오래된 데이터 가능 |
| 5분 | 호출 매우 적음 | 잔액 변화가 한참 뒤에 반영됨 |

잔액 조회 서비스의 특성상 30초 정도가 합리적이다.
블록 2~3개 분량을 기다리는 셈이다.

### 캐시 어디에 저장할 것인가

**선택지 A: 메모리 (Node.js Map/Object)**

```javascript
const cache = new Map();
// 구조: { "0x주소소문자": { balance: "2.0", cachedAt: 1234567890 } }

function getFromCache(address) {
  const entry = cache.get(address.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(address.toLowerCase()); // 만료된 엔트리 삭제
    return null;
  }
  return entry.balance;
}

function setCache(address, balance) {
  cache.set(address.toLowerCase(), {
    balance,
    cachedAt: Date.now()
  });
}
```

- 장점: 추가 의존성 없음. 매우 빠름. 설정 불필요.
- 단점: 서버 재시작 시 캐시 초기화. 서버가 여러 대라면 각각 별도 캐시를 가짐.

**선택지 B: Redis**

Redis는 인메모리 데이터 저장소로, 캐시 전용으로 많이 쓴다.
TTL 설정이 내장되어 있고, 서버 재시작 후에도 데이터가 유지된다.

- 장점: TTL 관리 내장. 서버 재시작 후에도 유지. 여러 서버 공유 가능.
- 단점: Redis 서버를 별도로 실행해야 함. 설정 복잡. 이 과제 규모에서는 과함.

이 과제에서는 메모리 캐시가 충분하다.

### 캐시 크기 관리

캐시가 무한정 커지면 메모리 문제가 생긴다.
서비스에 1만 명이 각자 다른 주소를 조회하면 캐시에 1만 개 엔트리가 쌓인다.

간단한 대응:
- 만료된 엔트리를 주기적으로 정리한다
- 최대 캐시 크기를 설정하고, 넘으면 가장 오래된 것부터 제거한다 (LRU)

이 과제 규모에서는 크게 걱정하지 않아도 되지만, 인식하고 있다는 것을 README에 언급하면 좋다.

### 캐시 히트 여부를 응답에 포함할 것인가

```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "balance": "2.0",
  "unit": "ETH",
  "cached": true,
  "cachedAt": "2024-01-01T00:00:00Z"
}
```

- 장점: 사용자가 "왜 잔액이 안 바뀌지?"를 이해할 수 있다. 투명성.
- 단점: 응답이 복잡해진다.

이건 UX 결정이다. 너가 선택해야 한다.

### 생각해볼 것
- TTL을 얼마로 설정할 것인가? 이유는?
- 캐시 히트 여부를 응답에 포함할 것인가?
- 만료된 캐시 엔트리를 어떻게 정리할 것인가?

---

## 패턴 4: 에러 처리 및 정보 노출 방지

### 왜 하는가

에러 응답에 내부 구현 정보가 노출되면 공격자에게 유용한 정보가 된다.
사용자에게는 친절한 메시지를, 로그에는 상세 정보를 남긴다.

### 에러 처리 레이어

```javascript
app.get("/api/balance", async (req, res) => {
  const { address } = req.query;

  // 1. 입력값 검증
  if (!ethers.isAddress(address)) {
    return res.status(400).json({ error: "유효하지 않은 Ethereum 주소입니다." });
  }

  try {
    const balance = await getBalance(address);
    res.json({ address, balance, unit: "ETH" });
  } catch (error) {
    // 2. 서버 로그에는 상세 기록
    console.error(`[Balance Error] address=${address}`, error);

    // 3. 클라이언트에는 일반적인 메시지만
    res.status(503).json({ error: "잔액 조회에 실패했습니다. 잠시 후 다시 시도해주세요." });
  }
});
```

### HTTP 상태 코드를 정확하게 써야 하는 이유

| 상태 코드 | 의미 | 클라이언트 동작 |
|---------|------|---------------|
| 200 | 성공 | 결과 표시 |
| 400 | 클라이언트 잘못 | 재시도해도 소용없음 (입력 수정 필요) |
| 429 | 요청 너무 많음 | 잠시 후 재시도 |
| 503 | 서비스 일시적 불가 | 잠시 후 재시도 가능 |
| 500 | 서버 내부 오류 | 개발자가 확인해야 함 |

400인데 500을 반환하거나, 503인데 400을 반환하면
클라이언트가 잘못된 판단을 하게 된다.

---

## 전체 구조: 요청 처리 흐름

모든 패턴을 적용하면 백엔드 요청 처리가 이런 구조가 된다:

```
GET /api/balance?address=0x...
          │
          ▼
┌─────────────────────┐
│   입력값 검증        │  실패 → 400 Bad Request
│   (address 형식)    │
└─────────────────────┘
          │ 통과
          ▼
┌─────────────────────┐
│   Rate Limiting     │  초과 → 429 Too Many Requests
│   (IP 기반)         │
└─────────────────────┘
          │ 통과
          ▼
┌─────────────────────┐
│   캐시 확인          │  히트 → 200 (캐시 데이터)
│   (주소 기준)       │
└─────────────────────┘
          │ 미스
          ▼
┌─────────────────────┐
│   Alchemy 호출      │  실패 → 503 Service Unavailable
│   eth_getBalance    │
└─────────────────────┘
          │ 성공
          ▼
┌─────────────────────┐
│   캐시 저장          │
│   결과 반환          │  → 200 OK
└─────────────────────┘
```

이 흐름이 설계 문서의 핵심이 되고, 코드 구조와도 일치하게 된다.

---

## 설계 문서에 써야 할 것

README에 설계 설명을 쓸 때 이 구조로 쓰면 된다:

1. **왜 백엔드 중계 구조를 선택했는가**
   - 어떤 문제를 해결하기 위해
   - 어떤 대안이 있었고 왜 이걸 선택했는가

2. **어떤 보호 메커니즘을 구현했는가**
   - 입력값 검증: 무엇을, 왜, 어떻게
   - Rate limiting: 어떤 기준으로, 숫자는 왜, 한계는 무엇인가
   - 캐싱: TTL은 얼마로, 왜, 어디에 저장했는가

3. **어떤 남용 시나리오를 가정했는가**
   - 시나리오 설명 + 각각 어떻게 대응했는가

4. **한계와 개선 가능한 점**
   - IP 기반 rate limiting의 VPN 우회 한계
   - 인메모리 캐시의 서버 재시작 시 초기화 문제
   - 더 발전시키려면 무엇이 필요한가 (Redis, 사용자 인증 등)

"한계를 솔직하게 쓰는 것"이 약점을 드러내는 게 아니라,
**내가 트레이드오프를 이해하고 선택했다는 것을 보여주는 것이다.**
이게 이 과제에서 평가하는 것이다.
