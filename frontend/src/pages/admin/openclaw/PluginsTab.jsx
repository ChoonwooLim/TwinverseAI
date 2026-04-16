import { useEffect, useState, useCallback } from "react";
import api from "../../../services/api";
import styles from "../AdminOpenClawConsole.module.css";

export default function PluginsTab() {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const r = await api.get("/api/admin/openclaw/console/plugins");
      setPlugins(r.data.plugins || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "failed");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (p) => {
    setErr(""); setOk("");
    try {
      const url = `/api/admin/openclaw/console/plugins/${encodeURIComponent(p.id)}/${p.enabled ? "disable" : "enable"}`;
      await api.post(url);
      setOk(`${p.id} ${p.enabled ? "disabled" : "enabled"}`);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "toggle failed");
    }
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={load} disabled={loading}>
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
        {ok && <span className={styles.okMsg}>{ok}</span>}
        {err && <span className={styles.errMsg}>{err}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1rem" }}>
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>플러그인 ({plugins.length})</h3>
          {plugins.length === 0 ? (
            <div className={styles.empty}>{loading ? "" : "플러그인이 없습니다."}</div>
          ) : (
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {plugins.map((p) => (
                <div
                  key={p.id}
                  className={`${styles.agentListItem} ${selected === p.id ? styles.agentListItemActive : ""}`}
                  onClick={() => setSelected(p.id)}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  <label className={styles.switch} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!p.enabled} onChange={() => toggle(p)} />
                    <span className={styles.switchSlider}></span>
                  </label>
                  <span className={styles.mono} style={{ flex: 1, fontSize: "0.85rem" }}>{p.id}</span>
                  {p.version && <span style={{ fontSize: "0.7rem", color: "#888" }}>{p.version}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <PluginConfigEditor pluginId={selected} onMsg={(kind, m) => {
              if (kind === "ok") setOk(m); else setErr(m);
            }} />
          ) : (
            <div className={styles.panel}>
              <div className={styles.empty}>좌측에서 플러그인을 선택하세요.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PluginConfigEditor({ pluginId, onMsg }) {
  const [raw, setRaw] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [dryResult, setDryResult] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setRaw(""); setDryResult("");
    try {
      const r = await api.get(`/api/admin/openclaw/console/plugins/${encodeURIComponent(pluginId)}/config`);
      const json = JSON.stringify(r.data.config ?? {}, null, 2);
      setRaw(json); setOriginal(json);
    } catch (e) {
      onMsg("err", e?.response?.data?.detail || e.message || "load failed");
    } finally { setLoading(false); }
  }, [pluginId, onMsg]);

  useEffect(() => { load(); }, [load]);

  const parse = () => {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("루트는 JSON 객체여야 합니다");
      }
      return parsed?.config ?? parsed;
    } catch (e) {
      onMsg("err", `JSON 오류: ${e.message}`);
      return null;
    }
  };

  const dryRun = async () => {
    const cfg = parse(); if (!cfg) return;
    setDryRunning(true); setDryResult("");
    try {
      const r = await api.put(`/api/admin/openclaw/console/plugins/${encodeURIComponent(pluginId)}/config`, { config: cfg, dryRun: true });
      setDryResult(r.data.output || "dry-run OK");
      onMsg("ok", "dry-run 통과");
    } catch (e) {
      onMsg("err", e?.response?.data?.detail || e.message || "dry-run failed");
    } finally { setDryRunning(false); }
  };

  const apply = async () => {
    const cfg = parse(); if (!cfg) return;
    if (!window.confirm("이 config를 적용할까요?")) return;
    setSaving(true);
    try {
      await api.put(`/api/admin/openclaw/console/plugins/${encodeURIComponent(pluginId)}/config`, { config: cfg, dryRun: false });
      onMsg("ok", `${pluginId} config 저장됨`);
      await load();
    } catch (e) {
      onMsg("err", e?.response?.data?.detail || e.message || "save failed");
    } finally { setSaving(false); }
  };

  const dirty = raw !== original;

  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>
        <span className={styles.mono}>{pluginId}</span> config
        {dirty && <span className={styles.infoMsg} style={{ marginLeft: "0.5rem", fontSize: "0.75rem" }}>(변경됨)</span>}
      </h3>
      {loading ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : (
        <>
          <textarea
            className={`${styles.textarea} ${styles.configEditor}`}
            style={{ minHeight: "40vh", width: "100%" }}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div className={styles.toolbar} style={{ marginTop: "0.75rem" }}>
            <button className={styles.btn} onClick={load} disabled={loading}>원복</button>
            <button className={styles.btn} onClick={dryRun} disabled={dryRunning || saving || !dirty}>
              {dryRunning ? "검증 중…" : "Dry-run 검증"}
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={apply} disabled={saving || dryRunning || !dirty}>
              {saving ? "적용 중…" : "적용"}
            </button>
          </div>
          {dryResult && (
            <pre className={styles.configTree} style={{ marginTop: "0.75rem", maxHeight: "200px" }}>{dryResult}</pre>
          )}
          <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.5rem" }}>
            ⚠ 비밀 값은 서버에서 <code>***마지막4자</code>로 마스킹되어 표시됩니다. 마스킹된 값을 그대로 저장하면 실제 값도 손상되므로, 비밀 값을 바꿀 때만 실제 값을 입력하세요.
          </p>
        </>
      )}
    </div>
  );
}
