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
  const [rotating, setRotating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

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

  const syncBackend = async () => {
    setSyncing(true);
    setErr("");
    setOk("");
    try {
      const r = await api.post("/api/admin/openclaw/console/token/reset");
      setOk(
        r.data.changed
          ? `백엔드 토큰 동기화 완료 (${r.data.tokenPrefix})`
          : "백엔드는 이미 최신 토큰과 동기화됨",
      );
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const rotate = async () => {
    const confirm1 = window.confirm(
      "새 토큰을 발급합니다.\n\n" +
        "• 기존 토큰은 즉시 무효화됩니다.\n" +
        "• 아래 Consumer 목록의 모든 항목을 수동으로 새 토큰으로 교체해야 합니다.\n" +
        "• 교체 전까지 DeskRPG/외부 도구는 연결이 끊깁니다.\n\n" +
        "계속하시겠습니까?",
    );
    if (!confirm1) return;
    const confirm2 = window.confirm("정말로 새 토큰을 발급하시겠습니까? 되돌릴 수 없습니다.");
    if (!confirm2) return;

    setRotating(true);
    setErr("");
    setOk("");
    try {
      const r = await api.post("/api/admin/openclaw/console/gateway/token/rotate");
      setToken(r.data.token || "");
      setReveal(true);
      setOk("새 토큰이 발급되었습니다. 아래 Consumer 에 즉시 반영하세요.");
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "rotate failed");
    } finally {
      setRotating(false);
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
        <h3 className={styles.panelTitle}>게이트웨이 토큰</h3>
        <p style={{ fontSize: "0.82rem", color: "#a5b4fc", marginTop: 0, marginBottom: "1rem", lineHeight: 1.6 }}>
          OpenClaw 게이트웨이(<code className={styles.mono}>{GATEWAY_URL}</code>) 의 마스터 접속 토큰입니다.
          이 값은 <code className={styles.mono}>gateway.auth.token</code> 에 저장되며, 외부 도구(DeskRPG,
          TwinverseAI 백엔드 등) 가 WebSocket 연결 시 <code>auth.token</code> 으로 제시합니다.
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
                <span style={{ color: "#f87171" }}>● 불일치 — 아래 "백엔드 동기화" 버튼으로 갱신</span>
              )}
            </div>

            {ok && <div className={styles.okMsg} style={{ marginTop: "0.5rem" }}>{ok}</div>}
            {err && <div className={styles.errMsg} style={{ marginTop: "0.5rem" }}>{err}</div>}
          </>
        )}
      </div>

      <div className={styles.panel} style={{ marginTop: "1rem" }}>
        <h3 className={styles.panelTitle}>토큰 관리</h3>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className={styles.btn}
            onClick={syncBackend}
            disabled={syncing || backendSynced}
            title={backendSynced ? "이미 일치" : "게이트웨이 토큰을 읽어 백엔드 런타임 값만 갱신"}
          >
            {syncing ? "동기화 중…" : "백엔드 동기화 (읽기 전용)"}
          </button>
          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={rotate}
            disabled={rotating}
          >
            {rotating ? "발급 중…" : "🔄 새 토큰 발급 (회전)"}
          </button>
        </div>
        <p style={{ fontSize: "0.78rem", color: "#888", marginTop: "0.75rem", lineHeight: 1.6 }}>
          <strong style={{ color: "#ccc" }}>백엔드 동기화</strong>: 게이트웨이가 자체 재시작되어 토큰이
          바뀐 경우, 기존 토큰을 변경하지 않고 백엔드 프로세스의 in-memory 값만 새로 읽어옵니다.
          <br />
          <strong style={{ color: "#f87171" }}>회전</strong>: 완전히 새로운 토큰을 생성해{" "}
          <code>gateway.auth.token</code> 과 <code>gateway.remote.token</code> 을 교체합니다. 기존
          토큰은 즉시 무효화되므로 모든 Consumer 를 수동 갱신해야 합니다.
        </p>
      </div>

      <div className={styles.panel} style={{ marginTop: "1rem" }}>
        <h3 className={styles.panelTitle}>이 토큰을 사용하는 곳 (회전 시 모두 갱신 필요)</h3>
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
              <td>TwinverseAI 백엔드 (.env)</td>
              <td className={styles.mono}>OPENCLAW_TOKEN</td>
              <td>
                로컬 개발: <code>backend/.env</code> 수정 후 재시작 ·
                Orbitron 배포: env_vars 갱신 또는 위 "백엔드 동기화" 클릭
              </td>
            </tr>
            <tr>
              <td>DeskRPG "AI 연결" 다이얼로그</td>
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
