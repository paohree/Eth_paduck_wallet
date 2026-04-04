# 구현 기초 — Node.js, Express, React, ethers.js

이 파일은 코드를 이해하면서 짜기 위한 최소한의 기초를 다룬다.
각 기술이 "왜 이렇게 생겼는지"를 이해하면 외워서 치는 게 아니라 논리적으로 쓸 수 있다.

---

## 1. Node.js — 서버에서 실행되는 JavaScript

### JavaScript가 브라우저 밖에서 실행된다는 것

원래 JavaScript는 브라우저 전용 언어였다.
HTML을 조작하고 사용자 인터랙션을 처리하기 위해 만들어졌다.

Node.js는 2009년에 등장해서 JavaScript를 서버에서도 실행할 수 있게 만들었다.
브라우저 없이도 JavaScript 코드가 실행된다.

```javascript
// server.js — 브라우저 없이 터미널에서 실행
console.log("안녕하세요");

const http = require("http");
const server = http.createServer((req, res) => {
  res.end("Hello World");
});
server.listen(3000);
```

```bash
node server.js
# 브라우저에서 http://localhost:3000 접속하면 "Hello World" 보임
```

### 비동기(Async)가 핵심이다

Node.js의 가장 중요한 특징은 **비동기 처리**다.

Alchemy에 HTTP 요청을 보내면 응답이 올 때까지 기다려야 한다.
이 대기 시간 동안 다른 요청을 처리할 수 있다.

```javascript
// 동기적 사고 (Node.js에서 이렇게 하면 안 됨)
const balance = getBalance("0x...");  // 여기서 멈춤
console.log(balance);

// 비동기적 사고 (Node.js 방식)
const balance = await getBalance("0x...");  // 기다리는 동안 다른 일 가능
console.log(balance);
```

`async/await`는 비동기 코드를 동기처럼 읽기 좋게 만들어주는 문법이다.

```javascript
// async 함수 선언
async function fetchBalance(address) {
  try {
    const balance = await provider.getBalance(address);  // 기다림
    return ethers.formatEther(balance);
  } catch (error) {
    throw new Error("잔액 조회 실패");
  }
}
```

`await`는 `async` 함수 안에서만 쓸 수 있다.
`await` 앞의 함수는 Promise를 반환해야 한다.

### npm — Node.js 패키지 관리자

```bash
npm init -y           # package.json 생성 (프로젝트 초기화)
npm install express   # express 패키지 설치
npm install --save-dev nodemon  # 개발용 패키지 설치
```

`package.json`: 프로젝트 정보와 의존성 목록
`node_modules/`: 실제로 설치된 패키지 파일들 (git에 올리지 않음)
`package-lock.json`: 정확한 버전 고정 (git에 올림)

---

## 2. Express — Node.js 웹 서버 프레임워크

### Express가 없으면 어떻게 되나

순수 Node.js로 HTTP 서버를 만들면:

```javascript
const http = require("http");

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url.startsWith("/api/balance")) {
    // URL 파싱 직접 해야 함
    const url = new URL(req.url, "http://localhost");
    const address = url.searchParams.get("address");

    // 헤더 직접 설정해야 함
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify({ balance: "2.0" }));
  } else {
    res.statusCode = 404;
    res.end("Not Found");
  }
});
```

URL 파싱, 헤더 설정, 라우팅을 전부 직접 해야 한다.

### Express를 쓰면

```javascript
const express = require("express");
const app = express();

app.get("/api/balance", (req, res) => {
  const address = req.query.address;  // URL 파싱 자동
  res.json({ balance: "2.0" });       // 헤더 자동 설정
});

app.listen(5000);
```

훨씬 간결하다.

### Express의 핵심 개념: 미들웨어

Express에서 요청은 여러 미들웨어를 순서대로 통과한다.
각 미들웨어는 `(req, res, next)` 형태의 함수다.

```javascript
// 미들웨어 1: 로깅
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();  // 다음 미들웨어로 진행
});

// 미들웨어 2: Rate Limiting
app.use("/api/balance", rateLimiter);

// 미들웨어 3: 실제 라우트 핸들러
app.get("/api/balance", async (req, res) => {
  // 여기서 실제 처리
});
```

`next()`를 호출하면 다음 미들웨어로 넘어간다.
`res.json()`이나 `res.status().json()`으로 응답하면 체인이 끝난다.

이 프로젝트의 구조:

```
요청
  → CORS 미들웨어
  → Rate Limit 미들웨어
  → 라우트 핸들러 (입력 검증 → 캐시 확인 → Alchemy 호출)
  → 응답
```

### 환경변수 (.env)

```javascript
// .env 파일 (git에 올리지 않음)
ALCHEMY_URL=https://eth-sepolia.g.alchemy.com/v2/실제키
PORT=5000

// server.js
require("dotenv").config();  // .env 파일 로드

const port = process.env.PORT || 5000;
const alchemyUrl = process.env.ALCHEMY_URL;
```

`dotenv` 패키지가 `.env` 파일을 읽어서 `process.env`에 넣어준다.
코드에 직접 키를 적지 않아도 된다.

### 실제 백엔드 파일 구조 예시

```
backend/
├── server.js          # Express 앱 설정, 서버 시작
├── routes/
│   └── balance.js     # /api/balance 라우트
├── middleware/
│   └── rateLimit.js   # Rate limit 미들웨어
├── services/
│   └── alchemy.js     # Alchemy 호출 로직
├── cache.js           # 캐시 관리
├── .env               # 환경변수 (git 제외)
└── package.json
```

이렇게 역할별로 파일을 나누면 유지보수가 쉽다.

---

## 3. ethers.js — Ethereum과 통신하는 라이브러리

### Provider — 블록체인과 연결하는 객체

```javascript
const { ethers } = require("ethers");

// JsonRpcProvider: 특정 RPC URL로 연결
const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);
```

`provider`는 이제 Ethereum Sepolia 노드와 연결된 객체다.
이 객체를 통해 블록체인에 질문할 수 있다.

### 잔액 조회

```javascript
// 주소의 ETH 잔액 조회
const balanceWei = await provider.getBalance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");

// balanceWei는 BigInt 타입
// 예: 2000000000000000000n (2 ETH를 wei로)
console.log(typeof balanceWei);  // "bigint"

// ETH 단위로 변환
const balanceEth = ethers.formatEther(balanceWei);
console.log(balanceEth);  // "2.0"
```

### 주소 검증

```javascript
// 유효한 Ethereum 주소인지 확인
ethers.isAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");  // true
ethers.isAddress("0xinvalid");  // false
ethers.isAddress("hello");      // false

// 주소를 체크섬 형식으로 정규화
ethers.getAddress("0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
// "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" 반환
```

### BigInt 주의사항

JavaScript에서 일반 숫자(`Number`)는 정밀도 한계가 있다.
2^53 이상의 정수는 정확하게 표현할 수 없다.

1 ETH = 10^18 wei는 2^53을 훨씬 초과한다.
그래서 ethers.js는 `BigInt`를 사용한다.

```javascript
const balance = await provider.getBalance(address);
// balance는 BigInt

// JSON으로 직렬화할 때 주의
JSON.stringify({ balance });  // 에러! BigInt는 JSON으로 직렬화 안 됨

// 해결: 문자열로 변환
JSON.stringify({ balance: ethers.formatEther(balance) });  // OK
// 또는
JSON.stringify({ balance: balance.toString() });  // wei 단위 문자열
```

---

## 4. React — 프론트엔드 UI 라이브러리

### React의 핵심 개념: 컴포넌트와 상태

React는 UI를 컴포넌트 단위로 쪼갠다.
각 컴포넌트는 **상태(state)**를 가질 수 있고, 상태가 바뀌면 화면이 자동으로 업데이트된다.

```jsx
import { useState } from "react";

function BalanceChecker() {
  // 상태 선언: [현재값, 값을 바꾸는 함수]
  const [address, setAddress] = useState("");      // 입력된 주소
  const [balance, setBalance] = useState(null);    // 조회된 잔액
  const [loading, setLoading] = useState(false);   // 로딩 중 여부
  const [error, setError] = useState(null);        // 에러 메시지

  // 버튼 클릭 핸들러
  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/balance?address=${address}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "조회 실패");
      }

      setBalance(data.balance);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // JSX: HTML처럼 생긴 JavaScript
  return (
    <div>
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="0x..."
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? "조회 중..." : "잔액 조회"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {balance && <p>{balance} ETH</p>}
    </div>
  );
}
```

### fetch API — 백엔드에 HTTP 요청 보내기

```javascript
// GET 요청
const response = await fetch("/api/balance?address=0x...");
const data = await response.json();

// 응답 상태 확인
if (!response.ok) {
  // response.ok는 상태코드가 200-299일 때 true
  console.error("에러:", response.status);
}
```

`fetch`는 브라우저 내장 API다. axios 같은 외부 패키지 없이도 쓸 수 있다.

### 개발 환경에서 CORS 문제 해결

React 개발 서버는 3000 포트, Express 서버는 5000 포트.
다른 포트는 다른 Origin으로 취급되어 브라우저가 요청을 차단한다.

해결책 1: Express에 cors 미들웨어 추가 (백엔드)
```javascript
const cors = require("cors");
app.use(cors({ origin: "http://localhost:3000" }));
```

해결책 2: React에 프록시 설정 추가 (package.json)
```json
{
  "proxy": "http://localhost:5000"
}
```
이렇게 하면 React에서 `/api/balance`로 요청하면 자동으로 `http://localhost:5000/api/balance`로 전달된다.

### React 앱 구조 예시

```
frontend/
├── src/
│   ├── App.js              # 루트 컴포넌트
│   ├── components/
│   │   └── BalanceChecker.jsx  # 잔액 조회 컴포넌트
│   └── index.js            # React 진입점
├── public/
│   └── index.html
└── package.json
```

---

## 5. Alchemy — RPC 서비스 설정

### Alchemy 계정 및 API 키 발급 과정

1. https://www.alchemy.com 에서 계정 생성
2. 새 앱 생성 → Chain: Ethereum, Network: Sepolia
3. API 키 확인: Dashboard → 앱 선택 → "API Key"
4. HTTPS URL 복사: `https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY`

이 URL을 `.env` 파일의 `ALCHEMY_URL`에 넣는다.

### 무료 플랜 한도

- 월 3억 건의 Compute Units (CU)
- `eth_getBalance` 1회 = 약 26 CU
- 즉 월 약 1150만 번 잔액 조회 가능

개인 과제 수준에서는 한도를 걱정하지 않아도 된다.
(공격받지 않는다면)

### ethers.js와 연결

```javascript
require("dotenv").config();
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

async function getEthBalance(address) {
  const balanceWei = await provider.getBalance(address);
  return ethers.formatEther(balanceWei);
}

module.exports = { getEthBalance };
```

`provider`는 한 번 만들어두고 재사용하는 것이 좋다.
요청마다 새로 만들면 연결 설정 오버헤드가 생긴다.

---

## 6. 전체 프로젝트 구조 예시

```
Eth_paduck_wallet/
├── backend/
│   ├── server.js
│   ├── routes/
│   │   └── balance.js
│   ├── services/
│   │   └── blockchain.js    # ethers.js, Alchemy 연동
│   ├── cache.js
│   ├── .env                 # git 제외
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   └── components/
│   │       └── BalanceChecker.jsx
│   └── package.json
│
├── theory/                  # 학습 파일
├── secret/                  # git 제외
├── .gitignore
└── README.md
```

백엔드와 프론트엔드를 별도 디렉토리로 분리하는 것이 일반적이다.
각자 `package.json`을 가지고 독립적으로 실행된다.

---

## 7. 개발 시작 순서 (권장)

1. **백엔드 먼저**: 기능의 핵심이 백엔드에 있다
   1. Express 서버 기본 틀 만들기
   2. `/api/balance` 라우트 만들기 (일단 하드코딩 응답)
   3. ethers.js + Alchemy 연결해서 실제 잔액 조회
   4. 입력값 검증 추가
   5. Rate limiting 추가
   6. 캐싱 추가

2. **백엔드 동작 확인**: curl 또는 Postman으로 테스트
   ```bash
   curl "http://localhost:5000/api/balance?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
   ```

3. **프론트엔드**: 동작하는 백엔드에 붙이는 UI
   1. React 앱 생성 (`npx create-react-app frontend`)
   2. 주소 입력 + 조회 버튼 컴포넌트
   3. 백엔드 API 호출
   4. 결과 표시

이 순서로 하면 백엔드가 완성된 후 프론트를 붙이므로
"프론트는 되는데 백엔드가 안 된다"는 상황을 피할 수 있다.
