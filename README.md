# Eth Paduck Wallet

Ethereum Sepolia 테스트넷 지갑 잔액 조회 서비스.
백엔드 RPC 자원을 외부에 노출하지 않고 안전하게 감싼 API 설계에 초점을 맞춘다.

---

## 실행 방법

### 사전 준비

1. [Alchemy](https://alchemy.com) 계정 생성 → Sepolia 앱 생성 → HTTPS URL 복사

2. 백엔드 환경변수 설정:
   ```bash
   cd backend
   cp .env.example .env
   # .env 파일을 열고 ALCHEMY_URL에 실제 URL 입력
   ```

3. 의존성 설치:
   ```bash
   # 백엔드
   cd backend && npm install

   # 프론트엔드
   cd frontend && npm install
   ```

### 실행

터미널을 두 개 열고:

```bash
# 터미널 1 — 백엔드
cd backend
npm start
# → http://localhost:5000

# 터미널 2 — 프론트엔드
cd frontend
npm run dev
# → http://localhost:5173
```

브라우저에서 `http://localhost:5173` 접속.

### API 직접 테스트 (curl)

```bash
# 정상 요청
curl "http://localhost:5000/api/balance?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

# 잘못된 주소
curl "http://localhost:5000/api/balance?address=hello"

# 헬스체크
curl "http://localhost:5000/health"
```

---

## 프로젝트 구조

```
Eth_paduck_wallet/
├── backend/
│   ├── src/
│   │   ├── config.js              # 환경변수 로드·검증
│   │   ├── app.js                 # Express 앱 설정 (미들웨어, 라우터)
│   │   ├── server.js              # 서버 시작 진입점
│   │   ├── middleware/
│   │   │   ├── validate.js        # 입력값 검증 (ethers.isAddress)
│   │   │   └── rateLimit.js       # IP 기반 rate limiting (직접 구현)
│   │   ├── services/
│   │   │   ├── cache.js           # 인메모리 캐시 (TTL 30초)
│   │   │   └── blockchain.js      # Alchemy RPC 호출 (ethers.js)
│   │   └── routes/
│   │       └── balance.js         # GET /api/balance 라우트
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # React 진입점
│   │   ├── App.jsx                # 루트 컴포넌트 (상태 관리)
│   │   ├── App.css                # 스타일
│   │   ├── services/
│   │   │   └── api.js             # 백엔드 API 호출
│   │   └── components/
│   │       ├── AddressInput.jsx   # 주소 입력 + 클라이언트 검증
│   │       └── BalanceDisplay.jsx # 결과 표시 (성공/에러)
│   ├── vite.config.js             # Vite 설정 + API 프록시
│   └── package.json
├── DESIGN.md                      # 설계 결정 상세 문서
└── README.md                      # 이 파일
```

---

## 설계 개요

> 자세한 내용은 **[DESIGN.md](./DESIGN.md)** 참고.

### 핵심 문제: RPC API 키 노출

클라이언트가 Alchemy에 직접 접속하는 구조에서는 브라우저 개발자 도구로 API 키를 **30초 이내**에 추출할 수 있다. 추출된 키로 공격자는 우리 인프라 자원을 무제한 소모할 수 있다.

### 해결: 백엔드 중계 구조

```
클라이언트 → 우리 서버 → Alchemy
              ↑
         여기서 통제
```

API 키는 서버 환경변수에만 존재한다. 클라이언트는 Alchemy를 전혀 볼 수 없다.

### 보호 레이어 (요청 처리 순서)

```
요청 수신
    ↓
① 입력값 검증  — ethers.isAddress()로 주소 형식 + 체크섬 검증
                 실패 시 400 반환, Alchemy 호출 없음
    ↓
② Rate Limiting — IP 기반, 1분에 10회 (직접 구현)
                  초과 시 429 + Retry-After 헤더
    ↓
③ 캐싱 확인   — 인메모리 Map, TTL 30초
                 히트 시 Alchemy 호출 없이 즉시 반환
    ↓
④ Alchemy 호출 ← 여기에 도달하는 요청만 실제 비용 발생
    ↓
캐시 저장 + 응답 반환
```

### 대응한 위협 시나리오

| 시나리오 | 대응 |
|---------|------|
| API 키 탈취 | 백엔드 중계 (키를 서버에만 보관) |
| 무차별 반복 호출 | Rate limiting (1분 10회) |
| 잘못된 주소 도배 | 입력값 검증 (Alchemy 호출 전 차단) |
| 동일 주소 반복 조회 | 캐싱 (TTL 30초) |
| 캐시 오염 (대소문자 변형) | 주소 정규화 (ethers.getAddress) |
| 내부 정보 노출 | 에러 포장 (서버 로그 vs 클라이언트 응답 분리) |

### 한계 (의식적으로 선택한 트레이드오프)

- **IP rate limiting**: VPN으로 우회 가능. 사용자 인증 없이는 더 정밀한 제어 불가.
- **인메모리 캐시**: 서버 재시작 시 초기화. 단일 서버에서만 동작.
- **고정 윈도우**: 윈도우 경계에서 일시적으로 2배 허용될 수 있음.

각 한계의 이유와 개선 방법은 [DESIGN.md](./DESIGN.md) 참고.

---

## 기술 스택

| 역할 | 기술 | 선택 이유 |
|------|------|---------|
| 백엔드 런타임 | Node.js | 과제 기술 범위 |
| 백엔드 프레임워크 | Express | 경량, 미들웨어 체인이 요청 흐름 표현에 적합 |
| Ethereum 통신 | ethers.js v6 | 검증된 라이브러리, wei→ETH 변환, 주소 유효성 검증 내장 |
| 환경변수 관리 | dotenv | API 키를 코드와 분리 |
| CORS | cors | 허용 출처 제한 |
| 프론트엔드 | React + Vite | 과제 기술 범위, Vite proxy로 개발 환경 CORS 해결 |
| RPC 제공자 | Alchemy (Sepolia) | 과제 기술 범위 |

**의도적으로 추가하지 않은 것:**
- `express-rate-limit`: 직접 구현으로 동작 원리를 이해하고 의존성 최소화
- `Redis`: 이 규모에서 인메모리 캐시로 충분
- CSS 프레임워크: 불필요한 의존성, 디자인은 평가 대상 아님
