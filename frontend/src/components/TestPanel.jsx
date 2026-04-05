// TestPanel.jsx — 보호 레이어 동작 확인 테스트 패널
// 입력값 검증, 캐싱, rate limiting이 실제로 작동하는지 API를 직접 호출해 확인한다.

import { useState } from "react";

const TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

// 개별 테스트 케이스 정의
const VALIDATION_TESTS = [
  { id: "empty",   label: "빈 값",        address: "",                          expectStatus: 400 },
  { id: "short",   label: "짧은 주소",    address: "0x1234",                    expectStatus: 400 },
  { id: "xss",     label: "XSS 시도",     address: "<script>alert(1)</script>", expectStatus: 400 },
  { id: "valid",   label: "정상 주소",    address: TEST_ADDRESS,                expectStatus: 200 },
];

async function callApi(address) {
  try {
    const res = await fetch(`/api/balance?address=${encodeURIComponent(address)}`);
    const data = await res.json();
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

function Badge({ result }) {
  if (!result) return null;
  const pass = result.pass;
  return (
    <span style={{
      padding: "2px 8px",
      borderRadius: "99px",
      fontSize: "0.72rem",
      fontWeight: 700,
      background: pass ? "#052e16" : "#2a1a1a",
      color: pass ? "#4ade80" : "#f87171",
      border: `1px solid ${pass ? "#166534" : "#7f1d1d"}`,
    }}>
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

function ResultRow({ label, result }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #2d3748" }}>
      <span style={{ fontSize: "0.82rem", color: "#d6d9dc" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {result && (
          <span style={{ fontSize: "0.75rem", color: "#848c96" }}>
            HTTP {result.status}
          </span>
        )}
        <Badge result={result} />
      </div>
    </div>
  );
}

export default function TestPanel() {
  const [validationResults, setValidationResults] = useState({});
  const [cacheResults, setCacheResults] = useState({});
  const [rateLimitResult, setRateLimitResult] = useState(null);
  const [running, setRunning] = useState("");

  async function runValidationTests() {
    setRunning("validation");
    setValidationResults({});
    for (const t of VALIDATION_TESTS) {
      const { status } = await callApi(t.address);
      setValidationResults(prev => ({
        ...prev,
        [t.id]: { status, pass: status === t.expectStatus },
      }));
      await new Promise(r => setTimeout(r, 200));
    }
    setRunning("");
  }

  async function runCacheTest() {
    setRunning("cache");
    setCacheResults({});

    const first = await callApi(TEST_ADDRESS);
    setCacheResults(prev => ({
      ...prev,
      first: {
        status: first.status,
        cached: first.data?.cached,
        pass: first.status === 200 && first.data?.cached === false,
      },
    }));

    await new Promise(r => setTimeout(r, 300));

    const second = await callApi(TEST_ADDRESS);
    setCacheResults(prev => ({
      ...prev,
      second: {
        status: second.status,
        cached: second.data?.cached,
        pass: second.status === 200 && second.data?.cached === true,
      },
    }));

    setRunning("");
  }

  async function runRateLimitTest() {
    setRunning("rateLimit");
    setRateLimitResult(null);

    let got429 = false;
    for (let i = 0; i < 15; i++) {
      const { status } = await callApi(TEST_ADDRESS);
      if (status === 429) {
        got429 = true;
        setRateLimitResult({ pass: true, attempts: i + 1 });
        break;
      }
    }
    if (!got429) {
      setRateLimitResult({ pass: false, attempts: 15 });
    }

    setRunning("");
  }

  return (
    <div style={{ padding: "20px", borderTop: "1px solid #3b4046" }}>
      <p style={{ fontSize: "0.78rem", color: "#848c96", marginBottom: 16 }}>
        보호 레이어 동작 테스트
      </p>

      {/* 입력값 검증 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#d6d9dc" }}>입력값 검증</span>
          <button onClick={runValidationTests} disabled={!!running} style={btnStyle}>
            {running === "validation" ? "테스트 중..." : "실행"}
          </button>
        </div>
        {VALIDATION_TESTS.map(t => (
          <ResultRow key={t.id} label={t.label} result={validationResults[t.id]} />
        ))}
      </div>

      {/* 캐싱 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#d6d9dc" }}>캐싱</span>
          <button onClick={runCacheTest} disabled={!!running} style={btnStyle}>
            {running === "cache" ? "테스트 중..." : "실행"}
          </button>
        </div>
        <ResultRow
          label="첫 번째 요청 → cached: false"
          result={cacheResults.first ? { ...cacheResults.first, status: cacheResults.first.status } : null}
        />
        <ResultRow
          label="두 번째 요청 → cached: true"
          result={cacheResults.second ? { ...cacheResults.second, status: cacheResults.second.status } : null}
        />
      </div>

      {/* Rate Limiting */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#d6d9dc" }}>Rate Limiting</span>
          <button onClick={runRateLimitTest} disabled={!!running} style={{ ...btnStyle, background: "#7f1d1d", borderColor: "#991b1b" }}>
            {running === "rateLimit" ? "테스트 중..." : "⚠️ 실행"}
          </button>
        </div>
        <p style={{ fontSize: "0.72rem", color: "#f97316", marginBottom: 8 }}>
          ⚠️ 실행 후 약 1분간 조회가 차단됩니다.
        </p>
        <ResultRow
          label="연속 요청 → 429 수신 확인"
          result={rateLimitResult ? { status: 429, pass: rateLimitResult.pass } : null}
        />
        {rateLimitResult && (
          <p style={{ fontSize: "0.72rem", color: "#848c96", marginTop: 4 }}>
            {rateLimitResult.pass
              ? `${rateLimitResult.attempts}번째 요청에서 429 수신`
              : "15번 요청했지만 429가 오지 않았습니다."}
          </p>
        )}
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "4px 12px",
  background: "#3b4046",
  color: "#d6d9dc",
  border: "1px solid #545861",
  borderRadius: 6,
  fontSize: "0.75rem",
  cursor: "pointer",
};
