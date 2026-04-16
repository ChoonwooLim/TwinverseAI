import { useEffect, useState, useCallback } from "react";
import api from "../../../services/api";
import styles from "../AdminOpenClawConsole.module.css";

export default function ConfigTab() {
  const [key, setKey] = useState("");
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [pairsText, setPairsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState([]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await api.get("/api/admin/openclaw/console/config", { params: key ? { key } : {} });
      setValue(r.data.value);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "failed");
    } finally { setLoading(false); }
  }, [key]);

  useEffect(() => { load(); }, [load]);

  const loadAudit = async () => {
    try {
      const r = await api.get("/api/admin/openclaw/console/config/audit", { params: { lines: 50 } });
      setAudit(r.data.entries || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "audit failed");
    }
  };

  useEffect(() => { loadAudit(); }, []);

  const parsePairs = () => {
    const pairs = {};
    for (const line of pairsText.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) throw new Error(`형식 오류: ${trimmed}`);
      const k = trimmed.slice(0, eq).trim();
      const vStr = trimmed.slice(eq + 1).trim();
      try { pairs[k] = JSON.parse(vStr); } catch { pairs[k] = vStr; }
    }
    return pairs;
  };

  const apply = async (dryRun) => {
    setErr(""); setOk("");
    let pairs;
    try { pairs = parsePairs(); }
    catch (e) { setErr(e.message); return; }
    if (Object.keys(pairs).length === 0) { setErr("변경할 항목이 없습니다."); return; }
    setSaving(true);
    try {
      const r = await api.put("/api/admin/openclaw/console/config", { pairs, dryRun });
      setOk(dryRun ? `dry-run OK (${r.data.applied}건)` : `적용됨 (${r.data.applied}건)`);
      if (!dryRun) { setPairsText(""); await load(); await loadAudit(); }
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "failed");
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          className={styles.input}
          style={{ flex: 1, maxWidth: "500px" }}
          placeholder="경로 (예: plugins.entries.ollama) — 비우면 전체 트리"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
        />
        <button className={styles.btn} onClick={load} disabled={loading}>
          {loading ? "조회 중…" : "조회"}
        </button>
        {ok && <span className={styles.okMsg}>{ok}</span>}
        {err && <span className={styles.errMsg}>{err}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>현재 값 (비밀 마스킹됨)</h3>
          <pre className={styles.configTree}>
{value === null || value === undefined ? "(없음)" : JSON.stringify(value, null, 2)}
          </pre>
        </div>

        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>배치 변경</h3>
          <p style={{ fontSize: "0.78rem", color: "#888", marginBottom: "0.5rem" }}>
            한 줄당 <code>key=value</code>. value는 JSON. 예: <br />
            <code>plugins.entries.ollama.config.models=["qwen2.5:7b","qwen2.5:14b"]</code><br />
            <code>gateway.controlUi.allowedOrigins=["https://tvdesk.twinverse.org"]</code>
          </p>
          <textarea
            className={`${styles.textarea} ${styles.configEditor}`}
            style={{ minHeight: "28vh", width: "100%" }}
            value={pairsText}
            onChange={(e) => setPairsText(e.target.value)}
            placeholder="plugins.entries.ollama.enabled=true"
          />
          <div className={styles.toolbar} style={{ marginTop: "0.75rem" }}>
            <button className={styles.btn} onClick={() => apply(true)} disabled={saving || !pairsText.trim()}>
              Dry-run
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => apply(false)} disabled={saving || !pairsText.trim()}>
              {saving ? "적용 중…" : "적용"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.panel} style={{ marginTop: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 className={styles.panelTitle} style={{ margin: 0 }}>Audit Log (최근 50건)</h3>
          <button className={styles.btn} onClick={loadAudit}>새로고침</button>
        </div>
        {audit.length === 0 ? (
          <div className={styles.empty}>항목 없음</div>
        ) : (
          <pre className={styles.configTree} style={{ maxHeight: "250px", fontSize: "0.76rem" }}>
{audit.slice().reverse().map((e) => JSON.stringify(e)).join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
