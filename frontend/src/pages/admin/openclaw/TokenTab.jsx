import { useEffect, useState, useCallback } from "react";
import api from "../../../services/api";
import styles from "../AdminOpenClawConsole.module.css";

const GATEWAY_URL = "wss://openclaw.twinverse.org";

export default function TokenTab() {
  const [token, setToken] = useState("");
  const [backendSynced, setBackendSynced] = useState(false);
  const [backendPrefix, setBackendPrefix] = useState("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await api.get("/api/admin/openclaw/console/gateway/token");
      setToken(r.data.token || "");
      setBackendSynced(!!r.data.backendSynced);
      setBackendPrefix(r.data.backendTokenPrefix || "");
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setErr("클립보드 복사 실패: " + (e.message || ""));
    }
  };

  const masked = token
    ? reveal
      ? token
      : `${token.slice(0, 8)}${"•".repeat(Math.max(0, token.length - 12))}${token.slice(-4)}`
    : "";

  return (
    <div>
      <div className={styles.panel}>
        <h3 className={styles.panelTitle}>게이트웨이 토큰 (고정)</h3>
        <p style={{ fontSize: "0.82rem", color: "#a5b4fc", marginTop: 0, marginBottom: "1rem", lineHeight: 1.6 }}>
          OpenClaw 게이트웨이(<code className={styles.mono}>{GATEWAY_URL}</code>) 의 마스터 접속 토큰입니다.
          이 값은 게이트웨이의 <code className={styles.mono}>gateway.auth.token</code> 에 저장되어 있고,
          TwinverseAI 백엔드와 DeskRPG 등 모든 외부 도구가 WebSocket 연결 시{" "}
          <code>auth.token</code> 으로 제시합니다.
          <br />
          <strong style={{ color: "#fbbf24" }}>이 토큰은 자동으로 변경되지 않습니다.</strong> 바꾸려면
          Orbitron 대시보드 env_vars 의 <code className={styles.mono}>OPENCLAW_TOKEN</code> 을 직접
          수정하고, 게이트웨이의 <code>gateway.auth.token</code> / <code>gateway.remote.token</code> 도
          같은 값으로 맞춘 뒤 컨테이너를 재배포하세요.
        </p>

        {loading && !token ? (
          <div className={styles.empty}>불러오는 중…</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", marginBottom: "0.75rem" }}>
              <input
                className={`${styles.input} ${styles.mono}`}
                style={{ flex: 1, fontSize: "0.85rem" }}
                value={masked}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button
                className={styles.btn}
                onClick={() => setReveal((v) => !v)}
                disabled={!token}
                title={reveal ? "숨기기" : "보이기"}
              >
                {reveal ? "🙈 숨기기" : "👁 보이기"}
              </button>
              <button className={styles.btn} onClick={copy} disabled={!token}>
                {copied ? "✓ 복사됨" : "📋 복사"}
              </button>
              <button className={styles.btn} onClick={load} disabled={loading}>
                {loading ? "…" : "🔄 새로고침"}
              </button>
            </div>

            <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: "0.25rem" }}>
              길이: <strong style={{ color: "#ccc" }}>{token.length}</strong> 자 ·
              백엔드 런타임 토큰: <code className={styles.mono}>{backendPrefix}</code> ·
              동기화:{" "}
              {backendSynced ? (
                <span style={{ color: "#4ade80" }}>● 일치</span>
              ) : (
                <span style={{ color: "#f87171" }}>
                  ● 불일치 — Orbitron env_vars 의 OPENCLAW_TOKEN 을 위 값으로 갱신 후 재배포 필요
                </span>
              )}
            </div>

            {err && <div className={styles.errMsg} style={{ marginTop: "0.5rem" }}>{err}</div>}
          </>
        )}
      </div>

      <div className={styles.panel} style={{ marginTop: "1rem" }}>
        <h3 className={styles.panelTitle}>이 토큰을 사용하는 곳</h3>
        <table className={styles.table} style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>위치</th>
              <th>경로 / 변수</th>
              <th>업데이트 방법</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>TwinverseAI 백엔드</td>
              <td className={styles.mono}>OPENCLAW_TOKEN</td>
              <td>
                로컬 개발: <code>backend/.env</code> 수정 후 재시작 ·
                Orbitron 배포: env_vars 갱신 후 재배포
              </td>
            </tr>
            <tr>
              <td>OpenClaw 게이트웨이 설정</td>
              <td className={styles.mono}>gateway.auth.token / gateway.remote.token</td>
              <td>
                twinverse-ai 호스트에서 <code>openclaw config set gateway.auth.token &quot;...&quot;</code>{" "}
                + <code>gateway.remote.token</code> 둘 다 같은 값으로
              </td>
            </tr>
            <tr>
              <td>DeskRPG &quot;AI 연결&quot; 다이얼로그</td>
              <td className={styles.mono}>채널 설정 → AI 연결 → 토큰</td>
              <td>위 토큰을 복사해 다이얼로그에 붙여넣고 저장</td>
            </tr>
            <tr>
              <td>기타 외부 도구</td>
              <td className={styles.mono}>auth.token (WS connect 메시지)</td>
              <td>OpenClaw gateway 에 연결하는 모든 커스텀 클라이언트</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
