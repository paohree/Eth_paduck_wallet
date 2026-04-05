# Eth Paduck Wallet

Ethereum Sepolia 테스트넷 지갑 잔액 조회 서비스.
백엔드가 Alchemy API 키를 숨기고 중계하는 구조로, RPC 자원 남용을 막는 것이 핵심이다.

---

## 실행 방법

### 사전 준비

1. [Alchemy](https://alchemy.com) 계정 생성 → Sepolia 앱 생성 → HTTPS URL 복사
2. 환경변수 설정:
   ```bash
   cd backend
   cp .env.example .env
   # .env 파일을 열고 ALCHEMY_URL에 실제 URL 입력
   ```
3. 의존성 설치:
   ```bash
   cd backend && npm install
   cd frontend && npm install
   ```

### 실행

루트 디렉토리에서:
```bash
./start.sh   # 백엔드(5001) + 프론트엔드(5173) 동시 실행
./stop.sh    # 서버 종료
```

브라우저에서 `http://localhost:5173` 접속.

### API 직접 테스트 (curl)

```bash
# 잔액 조회
curl "http://localhost:5001/api/balance?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"

# 잘못된 주소
curl "http://localhost:5001/api/balance?address=hello"

# 헬스체크
curl "http://localhost:5001/health"
```

---

## 전체 요청 흐름

```
사용자 (브라우저)
    │
    │  주소 입력
    ▼
[AddressInput.jsx]
    │  0x + 40자리 형식 검증 (UX용, 보안은 백엔드가 담당)
    ▼
[api.js]
    │  GET /api/balance?address=0x...
    ▼
[Vite 프록시] ── localhost:5173 → localhost:5001 로 전달
    ▼
[validate.js]
    │  ethers.isAddress()로 주소 형식 + 체크섬 검증
    │  통과 시 정규화된 주소를 req.normalizedAddress에 저장
    ▼
[rateLimit.js]
    │  IP 기반, 1분에 10회 제한
    │  초과 시 429 + Retry-After 반환
    ▼
[balance.js]
    │  캐시 확인 → 히트 시 즉시 반환 (Alchemy 호출 없음)
    │  미스 시 Alchemy 호출
    ▼
[blockchain.js]
    │  ethers.js → Alchemy → 이더리움 노드
    │  잔액(wei) 조회 후 ETH로 변환
    ▼
[cache.js]
    │  결과를 30초간 캐시 저장
    ▼
[balance.js]
    │  { address, balance, unit, cached, cachedAt } 반환
    ▼
[BalanceDisplay.jsx]
    │  잔액 화면에 표시
    ▼
사용자 (결과 확인)
```

---

## 파일 구조

```
Eth_paduck_wallet/
├── backend/
│   ├── src/
│   │   ├── server.js              # 진입점. app.js를 포트에 올린다.
│   │   ├── app.js                 # Express 설정. 미들웨어, 라우터 등록.
│   │   ├── config.js              # 환경변수 로드·검증.
│   │   ├── middleware/
│   │   │   ├── validate.js        # 입력값 검증 (ethers.isAddress)
│   │   │   └── rateLimit.js       # IP 기반 rate limiting (직접 구현)
│   │   ├── services/
│   │   │   ├── cache.js           # 인메모리 캐시 (TTL 30초)
│   │   │   └── blockchain.js      # Alchemy RPC 호출 (ethers.js)
│   │   └── routes/
│   │       └── balance.js         # GET /api/balance 라우트
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.jsx               # React 진입점
│   │   ├── App.jsx                # 루트 컴포넌트. 상태 관리.
│   │   ├── App.css                # 스타일
│   │   ├── services/
│   │   │   └── api.js             # 백엔드 fetch 호출
│   │   └── components/
│   │       ├── AddressInput.jsx   # 주소 입력 + 클라이언트 검증
│   │       └── BalanceDisplay.jsx # 결과 표시 (성공/에러)
│   └── vite.config.js             # Vite 설정. /api 요청을 백엔드로 프록시.
├── start.sh                       # 서버 실행 스크립트
├── stop.sh                        # 서버 종료 스크립트
└── DESIGN.md                      # 설계 결정 상세 문서
```

---

## 설계 판단

### 왜 백엔드가 중계하는가

클라이언트가 Alchemy에 직접 요청하면 브라우저 개발자 도구로 API 키를 즉시 확인할 수 있다.
탈취된 키로 공격자가 RPC 자원을 무제한 소모할 수 있으므로, 백엔드가 키를 숨기고 중계한다.

### 보호 레이어와 선택 이유

| 레이어 | 구현 | 선택 이유 |
|--------|------|---------|
| 입력값 검증 | ethers.isAddress() | 형식 + EIP-55 체크섬까지 검증. ethers.js는 이미 사용 중이라 추가 의존성 없음. |
| Rate Limiting | 직접 구현 (고정 윈도우, IP 기반, 1분 10회) | express-rate-limit 없이 의존성 최소화. 동작 원리 직접 제어. |
| 캐싱 | 인메모리 Map (TTL 30초) | Redis 없이 단일 서버에서 충분. Sepolia 블록 주기(12초) 고려한 TTL. |
| 주소 정규화 | ethers.getAddress() | 대소문자 변형이 동일 캐시 키를 참조하게 해 중복 호출 방지. |

### 대응한 위협 시나리오

| 시나리오 | 대응 |
|---------|------|
| API 키 탈취 | 백엔드 중계 — 키는 서버 환경변수에만 존재 |
| 무차별 반복 호출 | Rate limiting — 1분 10회 초과 시 429 |
| 잘못된 주소 도배 | 입력값 검증 — Alchemy 호출 전 차단 |
| 동일 주소 반복 조회 | 캐싱 — TTL 30초간 Alchemy 미호출 |
| 캐시 오염 (대소문자 변형) | 주소 정규화 — 동일 캐시 키로 수렴 |
| 내부 정보 노출 | 에러 포장 — 상세는 서버 로그, 클라이언트엔 일반 메시지 |

### 의식적으로 선택한 한계

- **IP rate limiting**: VPN으로 우회 가능. 로그인 없이는 더 정밀한 식별 불가.
- **인메모리 캐시**: 서버 재시작 시 초기화. 다중 서버 환경에서는 동작 안 함.
- **고정 윈도우**: 윈도우 경계에서 최대 20회 허용될 수 있음.

---

## 기술 스택

| 역할 | 기술 |
|------|------|
| 백엔드 | Node.js + Express |
| Ethereum 통신 | ethers.js v6 |
| 환경변수 | dotenv |
| 프론트엔드 | React + Vite |
| RPC 제공자 | Alchemy (Sepolia) |

**의도적으로 추가하지 않은 것:**
- `express-rate-limit` — 직접 구현으로 의존성 최소화
- `Redis` — 단일 서버에서 인메모리 캐시로 충분
- CSS 프레임워크 — 불필요한 의존성
