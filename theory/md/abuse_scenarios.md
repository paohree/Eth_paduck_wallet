# 남용 시나리오 — 어디가 뚫릴 수 있는가

설계 결정을 내리기 전에 "무엇으로부터 보호할 것인가"를 먼저 정의해야 한다.
이것을 **위협 모델링(Threat Modeling)** 이라고 한다.

위협 모델링의 핵심 질문은 3가지다:
1. 공격자가 무엇을 원하는가?
2. 공격자가 어떻게 그것을 얻으려고 하는가?
3. 나는 어디서 그것을 막을 수 있는가?

이 문서에서는 이 서비스에서 발생할 수 있는 구체적인 남용 시나리오를 하나씩 뜯어본다.

---

## 시나리오 1: API 키 탈취 후 무제한 사용

### 상황
구조 A (클라이언트가 Alchemy에 직접 호출)를 사용하는 경우.

### 공격자가 하는 것

1. 우리 서비스에 접속한다
2. 브라우저 개발자 도구 → Network 탭을 열고 잔액 조회를 한 번 한다
3. Alchemy로 나가는 요청을 찾는다
4. 요청 URL: `https://eth-sepolia.g.alchemy.com/v2/abcd1234efgh5678ijkl9012`
5. API 키(`abcd1234efgh5678ijkl9012`) 추출 완료

이 과정에 걸리는 시간: **30초 이내**.

이후 공격자는 자기 프로젝트에 이 API 키를 사용하거나, 스크립트로 대량 요청을 보낸다.

### 영향
- 우리 Alchemy 계정의 API 요청 한도 소진
- 무료 플랜이라면 서비스 중단
- 유료 플랜이라면 예상치 못한 과금 발생

### 방어
구조 A에서는 **근본적으로 방어 불가능**하다.
API 키를 난독화해도 의미없다. 요청이 나갈 때 실제 URL이 노출된다.
구조 B(백엔드 중계)로 전환하는 것이 이 시나리오의 유일한 해법이다.

---

## 시나리오 2: 백엔드 API 무차별 반복 호출 (DDoS/Resource Exhaustion)

### 상황
구조 B로 전환했지만 Rate limiting이 없는 경우.

### 공격자가 하는 것

우리 서비스를 사용하다가 API 엔드포인트를 알게 된다.

```
GET http://우리서버/api/balance?address=0x...
```

이걸 반복 호출하는 스크립트를 작성한다:

```python
import requests
import threading

url = "http://우리서버/api/balance"
address = "0x0000000000000000000000000000000000000000"

def spam():
    while True:
        requests.get(url, params={"address": address})

# 스레드 50개로 동시 요청
threads = [threading.Thread(target=spam) for _ in range(50)]
for t in threads:
    t.start()
```

### 공격자 입장에서 이게 얼마나 쉬운가

브라우저 개발자 도구 → Network 탭 → 요청 우클릭 → "Copy as cURL" 또는 "Copy as Python requests"
이미 복사 가능한 스크립트가 만들어진다.

### 영향

- 초당 수천 건의 요청이 백엔드 서버에 도달
- 각 요청마다 Alchemy 호출 (캐싱이 없다면)
- Alchemy API 한도 빠르게 소진 (시나리오 1과 같은 결과, 경로만 다름)
- 백엔드 서버 자체도 CPU/메모리 과부하로 느려지거나 다운

### 방어
Rate limiting: 특정 클라이언트(IP 기준)의 요청 횟수를 제한한다.
캐싱: 같은 주소에 대한 반복 요청 시 Alchemy를 다시 호출하지 않는다.

---

## 시나리오 3: 유효하지 않은 주소로 리소스 낭비

### 상황
입력값 검증이 없는 경우.

### 공격자가 하는 것

자동화 스크립트로 랜덤한 값들을 address 파라미터로 보낸다:

```
GET /api/balance?address=aaaaaaa
GET /api/balance?address=1
GET /api/balance?address=<script>alert(1)</script>
GET /api/balance?address=SELECT * FROM users
GET /api/balance?address=
```

### 영향

캐싱이 있다 해도, 매번 다른 잘못된 주소가 들어오므로 캐시 히트가 없다.
백엔드가 각 요청마다 Alchemy를 호출한다.
Alchemy는 "invalid address" 에러를 반환하지만, 요청 자체는 카운트된다.

또한 `<script>` 태그 같은 입력은 XSS(Cross-Site Scripting) 공격 시도다.
검증 없이 이 값을 HTML에 그대로 출력하면 브라우저에서 스크립트가 실행될 수 있다.

### 방어
Alchemy를 호출하기 전에 주소 형식을 검증한다.
- Ethereum 주소 형식 체크: `0x` + 40자리 16진수
- `ethers.isAddress()` 사용 시 체크섬까지 검증 가능
- 검증 실패 시 즉시 400 반환, Alchemy 호출 없음

---

## 시나리오 4: 동일 주소 반복 조회 (캐싱 없는 경우)

### 상황
악의적이지 않더라도 발생할 수 있는 시나리오.

### 어떻게 발생하는가

경우 1: 사용자가 새로고침을 반복한다
경우 2: 다른 개발자가 우리 API를 자신의 서비스에 붙여서 사용한다
경우 3: 모니터링 목적으로 1초마다 잔액을 체크하는 서비스

모두 악의가 없다. 하지만 결과는 동일하다:
동일한 주소에 대해 매번 Alchemy를 호출한다.

### 왜 이게 낭비인가

Ethereum Sepolia 블록 생성 주기: 약 12초

즉, 잔액 데이터는 최소 12초에 한 번씩만 바뀔 수 있다.
그런데 1초마다 조회하면 12번 중 11번은 의미없는 Alchemy 호출이다.

### 방어
캐싱: 최근 조회 결과를 N초(예: 30초) 동안 저장해둔다.
같은 주소에 대한 TTL 이내 재요청은 저장된 결과를 반환한다.

---

## 시나리오 5: 캐시 오염 (Cache Poisoning)

### 상황
캐싱 로직이 있지만 캐시 키 설계가 잘못된 경우.

### 어떻게 발생하는가

캐시 키를 주소 문자열 그대로 쓴다고 가정하자.

Ethereum 주소는 대소문자를 구분하지 않는다 (EIP-55 체크섬 제외).
즉, 아래 세 주소는 모두 동일한 주소다:
```
0xd8da6bf26964af9d7eed9e03e53415d37aa96045  (소문자)
0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045  (대문자)
0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045  (체크섬)
```

대소문자 정규화 없이 각각 캐시 키로 사용하면:
- 3개의 다른 캐시 엔트리가 생긴다
- 같은 데이터를 3번 조회한다
- 캐시 효율이 떨어진다

### 더 심각한 경우

URL 인코딩이나 특수문자가 포함된 입력이 캐시 키로 그대로 쓰이면
예상치 못한 키 충돌이 발생할 수 있다.

### 방어
캐시 키 생성 전 입력값을 정규화한다.
```javascript
const normalizedAddress = address.toLowerCase();
// 또는
const normalizedAddress = ethers.getAddress(address); // 체크섬 형식으로 정규화
```

---

## 시나리오 6: 정보 노출 (Information Disclosure)

### 상황
에러 응답에 내부 정보가 포함되는 경우.

### 어떻게 발생하는가

```javascript
// 나쁜 예
try {
  const balance = await provider.getBalance(address);
} catch (error) {
  res.status(500).json({ error: error.message }); // ← 위험
}
```

`error.message`에는 이런 것들이 포함될 수 있다:
- `"could not detect network (event=\"noNetwork\", version=6.9.0)"`
  → 사용 중인 라이브러리와 버전 노출
- `"invalid API key"`
  → API 키 관련 정보
- `"ECONNREFUSED 127.0.0.1:5000"`
  → 내부 네트워크 구조 노출

공격자는 이런 정보로 공격 전략을 세운다.
어떤 라이브러리를 쓰는지 알면 해당 버전의 알려진 취약점을 노릴 수 있다.

### 방어
에러 응답을 사용자 친화적으로 포장하고, 내부 상세를 숨긴다:

```javascript
catch (error) {
  console.error(error); // 서버 로그에만 남김
  res.status(503).json({ error: "잔액 조회에 실패했습니다. 잠시 후 다시 시도해주세요." });
}
```

---

## 전체 위협 지도

```
[클라이언트]  →  [백엔드 API]  →  [Alchemy]

  ↑                  ↑                ↑
  │                  │                │
시나리오 1         시나리오 2,3      시나리오 4
API 키 노출       무차별 호출       반복 호출
(구조 A)         입력값 오류       낭비

              시나리오 5
              캐시 오염

              시나리오 6
              정보 노출
```

---

## 각 시나리오와 대응 요약

| 시나리오 | 전제 조건 | 영향 | 대응 |
|---------|---------|------|------|
| 1. API 키 탈취 | 구조 A 사용 | API 한도 소진, 과금 | 구조 B (백엔드 중계) |
| 2. 무차별 반복 호출 | Rate limiting 없음 | 서버/API 과부하 | Rate limiting |
| 3. 잘못된 입력값 | 입력 검증 없음 | 불필요한 Alchemy 호출 | 입력값 검증 |
| 4. 같은 주소 반복 조회 | 캐싱 없음 | Alchemy 낭비 | 캐싱 (TTL) |
| 5. 캐시 오염 | 주소 정규화 없음 | 캐시 효율 저하 | 주소 정규화 |
| 6. 정보 노출 | 에러 그대로 반환 | 공격 정보 제공 | 에러 포장 |

---

## 이 서비스에서 현실적인 위협 우선순위

모든 위협을 동등하게 대응하지 않아도 된다.
현실적으로 일어날 가능성과 영향을 기준으로 우선순위를 정하자.

**높은 우선순위 (반드시 대응)**
1. 구조 B 채택 (시나리오 1 해결): 전제 조건
2. 입력값 검증 (시나리오 3): 구현 비용 낮음, 효과 높음
3. Rate limiting (시나리오 2): 비교적 구현 간단, 핵심 방어선

**중간 우선순위 (구현하면 좋음)**
4. 캐싱 (시나리오 4): Alchemy 호출 절약 + 성능 향상
5. 에러 포장 (시나리오 6): 구현 비용 낮음

**낮은 우선순위 (인식하고 있으면 충분)**
6. 주소 정규화 (시나리오 5): 동작에 큰 문제는 없음
