# RPC — 이 프로젝트에서 왜 필요한가

---

## 1. RPC란 무엇인가

RPC는 Remote Procedure Call의 약자다.
말 그대로 "원격에 있는 함수를 호출하는 것"이다.

쉽게 비유하면 이렇다.

> 나는 서울에 있고, 내 친구는 부산에 있다.
> 내가 친구에게 전화해서 "지금 부산 날씨 알려줘"라고 하면,
> 친구가 창문 밖을 보고 "맑아"라고 답해준다.
> 나는 부산에 가지 않았지만, 부산의 정보를 얻었다.

이게 RPC다. 내 컴퓨터에서 다른 컴퓨터의 함수를 실행하는 것.

평소에 우리가 쓰는 REST API랑 개념적으로 크게 다르지 않다.
`GET /users/123` 이라는 HTTP 요청도 결국 "서버에 있는 '유저 조회' 기능을 호출하는 것"이니까.

Ethereum에서는 RPC를 통해 블록체인 노드와 대화한다.
"이 지갑 주소의 잔액이 얼마야?", "이 트랜잭션은 성공했어?" 같은 질문을 노드에 던지는 것이다.

---

## 2. 블록체인 노드란 무엇인가

블록체인을 이해하려면 먼저 그것이 어떻게 존재하는지 알아야 한다.

블록체인은 어딘가의 서버에 중앙 저장되는 데이터베이스가 아니다.
전 세계에 흩어진 수천 개의 컴퓨터(노드)가 **동일한 데이터를 각자 들고 있는** 분산 네트워크다.

각 노드는:
- 모든 트랜잭션 기록 (창세기 블록부터 지금까지)
- 모든 지갑 주소의 현재 잔액
- 스마트 컨트랙트 코드와 상태

이 모든 것을 자기 컴퓨터에 저장하고 있다.
Ethereum 전체 데이터는 현재 수백 GB에 달한다.

누군가의 지갑 잔액을 알고 싶다면, 이 노드 중 하나에 물어봐야 한다.
노드가 장부를 들고 있기 때문이다.

### 직접 노드를 운영한다는 것

노드를 직접 운영하려면:
- 수백 GB 디스크 공간
- 동기화에 며칠이 걸리는 초기 세팅
- 24시간 돌아가는 서버
- 네트워크 트래픽 비용

이건 현실적으로 개인 개발자나 소규모 서비스에게 부담이 크다.

### Alchemy, Infura가 하는 일

그래서 Alchemy 같은 서비스가 등장했다.
이들은 노드를 직접 운영하면서, 우리 같은 개발자에게 API 형태로 노드 접근권을 판다.

```
우리 앱 → Alchemy 서버 → Ethereum 노드 → 블록체인 데이터
```

Alchemy는 API 키를 발급해주고, 요청 수에 따라 과금한다.
무료 플랜은 월 3억 건의 요청이 가능하지만, 대량 남용이 일어나면 금방 소진된다.

---

## 3. Ethereum JSON-RPC 프로토콜

Ethereum 노드와 대화하는 방식은 표준화되어 있다.
이것이 Ethereum JSON-RPC다.

### 요청 형식

HTTP POST 요청으로 JSON 데이터를 보낸다:

```
POST https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "eth_getBalance",
  "params": ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "latest"],
  "id": 1
}
```

각 필드의 의미:
- `jsonrpc`: 프로토콜 버전. 항상 "2.0"
- `method`: 호출할 함수 이름. `eth_getBalance`, `eth_call`, `eth_getTransactionReceipt` 등
- `params`: 함수에 넘길 인자. 첫 번째는 지갑 주소, 두 번째는 블록 시점 ("latest"는 현재)
- `id`: 요청 식별자. 응답과 매칭하기 위해 씀

### 응답 형식

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x1BC16D674EC80000"
}
```

`result` 값이 잔액인데, 두 가지 특징이 있다:
1. **16진수**다 (0x로 시작)
2. **wei** 단위다

### wei가 뭔가

ETH의 최소 단위다. 1 ETH = 10^18 wei.

왜 이렇게 작은 단위를 쓰냐면, 컴퓨터에서 소수점 계산은 오차가 생기기 때문이다.
블록체인에서는 돈을 다루므로 오차가 있으면 안 된다.
그래서 정수로만 계산한다. 대신 단위를 아주 작게 만들어서 소수점이 필요 없게 한다.

`0x1BC16D674EC80000`를 10진수로 변환하면 `2000000000000000000`
이걸 10^18로 나누면 `2.0` ETH.

ethers.js가 이 변환을 자동으로 해준다.

### 주요 RPC 메서드

| 메서드 | 하는 일 |
|--------|---------|
| `eth_getBalance` | 주소의 ETH 잔액 조회 |
| `eth_getTransactionCount` | 주소의 트랜잭션 수 조회 (nonce) |
| `eth_getTransactionReceipt` | 트랜잭션 결과 조회 |
| `eth_blockNumber` | 현재 블록 번호 조회 |
| `eth_call` | 스마트 컨트랙트 읽기 전용 호출 |
| `eth_sendRawTransaction` | 서명된 트랜잭션 전송 |

이 과제에서는 `eth_getBalance` 하나만 쓰면 된다.

---

## 4. 왜 클라이언트에 노출될 수밖에 없는가

이게 이 과제의 핵심 문제다. 구조를 천천히 뜯어보자.

### 일반적인 웹 서비스 구조

보통의 웹 서비스는 이렇게 생겼다:

```
사용자 브라우저  →  우리 백엔드 서버  →  외부 API (예: 날씨 API)
```

날씨 API 키는 백엔드 서버의 환경변수에 들어있다.
사용자는 우리 백엔드만 보고, 날씨 API 키는 절대 볼 수 없다.

### 클라이언트 사이드 지갑의 구조

그런데 블록체인 지갑 앱은 다르게 동작하는 경우가 많다.

MetaMask 같은 지갑을 생각해보자.
MetaMask는 브라우저 확장 프로그램으로, **브라우저 안에서** 직접 블록체인과 통신한다.
중간에 우리 서버가 없다.

왜 이런 구조가 생겼냐면:
- 지갑의 **개인키**는 절대 서버에 올라가면 안 된다
- 트랜잭션 서명도 클라이언트에서 이루어져야 한다
- 탈중앙화의 철학 상 중간 서버에 의존하지 않으려는 경향이 있다

이런 환경에서 RPC 엔드포인트를 클라이언트 코드에 넣으면:

```javascript
// React 코드 (브라우저에서 실행됨)
const provider = new ethers.JsonRpcProvider(
  "https://eth-sepolia.g.alchemy.com/v2/abcd1234efgh5678"  // ← 이게 문제
);
```

이 코드는 브라우저에서 실행된다.
브라우저에서 실행되는 코드는 누구나 볼 수 있다.

### 어떻게 보이는가

개발자 도구를 열고 (F12) → Sources 탭을 보면 JavaScript 번들 파일이 보인다.
`Ctrl+F`로 "alchemy"를 검색하면 API 키가 포함된 URL이 그대로 나온다.

또는 Network 탭을 열고 잔액 조회를 한 번 해보면,
Alchemy로 나가는 요청이 그대로 보이고, URL에 API 키가 포함되어 있다.

`.env` 파일을 쓴다고 해도 마찬가지다.
React에서 `REACT_APP_ALCHEMY_URL`로 환경변수를 쓰면,
빌드 시 이 값이 JavaScript 번들 파일에 그대로 박힌다.
빌드된 파일이 배포되면 누구나 볼 수 있다.

**브라우저에서 실행되는 것은 비밀이 없다.**

---

## 5. 노출되면 어떻게 자원이 소모되는가

API 키가 노출되면 일어날 수 있는 일을 구체적으로 상상해보자.

### 시나리오: 악의적인 사용자의 스크립트

```python
import requests
import threading

url = "https://eth-sepolia.g.alchemy.com/v2/훔친API키"

def spam_request():
    while True:
        requests.post(url, json={
            "jsonrpc": "2.0",
            "method": "eth_getBalance",
            "params": ["0x0000000000000000000000000000000000000000", "latest"],
            "id": 1
        })

# 스레드 100개로 동시에 요청
for _ in range(100):
    threading.Thread(target=spam_request).start()
```

이 스크립트를 실행하면 초당 수천 건의 요청이 Alchemy로 날아간다.
Alchemy는 이 요청들이 "훔친 API 키"를 쓰고 있으므로, 우리 계정의 한도에서 차감한다.

### 결과

- Alchemy 무료 플랜: 월 3억 건 요청 한도
- 이 스크립트로 초당 1000건이면 하루에 8640만 건
- 3~4일이면 월 한도 소진
- 이후 서비스 중단 또는 유료 플랜 강제 전환

안암145의 경우처럼 자체 노드를 운영한다면:
- 노드 서버의 CPU, 메모리, 네트워크 대역폭이 소모됨
- 실제 사용자들의 요청이 느려지거나 처리 안 됨
- 서버 다운 가능성

### 왜 이게 쉬운가

공격자 입장에서는:
1. 브라우저 개발자 도구 → API 키 추출 (30초)
2. 스크립트 작성 (10분)
3. 실행 (버튼 하나)

진입 장벽이 거의 없다.

---

## 6. 이 프로젝트의 해법

클라이언트가 Alchemy에 직접 접근하지 못하게 막고,
백엔드 서버가 중간에서 대신 호출하는 구조를 만든다.

```
[구조 A - 문제 있는 구조]
사용자 브라우저 (React)
    ↓ Alchemy URL 포함된 요청
Alchemy RPC 노드
```

```
[구조 B - 이 프로젝트의 구조]
사용자 브라우저 (React)
    ↓ 우리 백엔드 API 호출 (Alchemy URL 없음)
우리 Node.js 백엔드
    ↓ 서버에서 Alchemy 호출 (API 키는 서버 환경변수에만)
Alchemy RPC 노드
```

이렇게 하면:
- Alchemy API 키는 서버 환경변수에만 존재 → 외부 노출 없음
- 클라이언트는 우리 백엔드 주소만 알고 있음
- 백엔드에서 rate limiting, 캐싱, 입력 검증 등 보호 로직 추가 가능

단, 이제 우리 백엔드 자체가 공격 대상이 될 수 있다.
이에 대한 대응은 `abuse_scenarios.md`와 `protection_patterns.md`에서 다룬다.

---

## 7. ethers.js가 하는 역할

위에서 JSON-RPC 요청을 직접 만드는 법을 봤는데,
실제로는 이걸 직접 하지 않는다.

ethers.js가 이 모든 것을 추상화해준다.

```javascript
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

const balance = await provider.getBalance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
// balance는 BigInt 타입의 wei 값

const balanceInEth = ethers.formatEther(balance);
// "2.0" 같은 문자열로 변환
```

내부적으로 ethers.js가:
1. `eth_getBalance` JSON-RPC 요청을 만들어서
2. Alchemy URL로 POST 요청을 보내고
3. 응답의 16진수 wei 값을 받아서
4. BigInt로 변환해서 반환해준다

우리는 `provider.getBalance(주소)` 한 줄로 끝낼 수 있다.

---

## 요약

| 개념 | 한 줄 정리 |
|------|-----------|
| RPC | 다른 컴퓨터의 함수를 호출하는 것 |
| 블록체인 노드 | 블록체인 데이터 전체를 들고 있는 컴퓨터 |
| Alchemy | 노드를 대신 운영해주는 서비스. API 키로 접근 |
| JSON-RPC | Ethereum 노드와 대화하는 표준 방식 |
| wei | ETH의 최소 단위. 1 ETH = 10^18 wei |
| 구조 A의 문제 | 클라이언트 코드에 API 키가 노출됨 |
| 구조 B의 해법 | 백엔드가 중계하여 API 키를 서버에만 보관 |
| ethers.js | JSON-RPC를 추상화해주는 라이브러리 |
