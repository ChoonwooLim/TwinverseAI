import { useEffect, useState, useCallback } from "react";
import api from "../../../services/api";
import styles from "../AdminOpenClawConsole.module.css";

// Minimal offline fallback only — real list comes from /api/.../models which
// includes Ollama + every provider registered in models.providers.
const DEFAULT_MODEL_ID = "openai-codex/gpt-6-astra";
const FALLBACK_MODELS = [
  { id: DEFAULT_MODEL_ID, name: "GPT-6 Astra", supportsTools: true },
];

export default function AgentsTab() {
  const [agents, setAgents] = useState([]);
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async (includeModels = false) => {
    setLoading(true); setErr("");
    const modelsRequest = includeModels
      ? api.get("/api/admin/openclaw/console/models").then((r) => {
        const list = r.data.models || [];
        if (list.length) setModels(list);
      }).catch(() => { /* keep the current list or offline fallback */ })
      : null;
    try {
      const r = await api.get("/api/admin/openclaw/console/agents");
      setAgents(r.data.agents || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "failed");
    } finally {
      await modelsRequest;
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm(`에이전트 "${id}"를 삭제할까요? 세션/파일도 함께 제거됩니다.`)) return;
    setDeleting(id); setErr(""); setOk("");
    try {
      await api.delete(`/api/admin/openclaw/console/agents/${encodeURIComponent(id)}`);
      window.dispatchEvent(new CustomEvent("openclaw:agents-changed", { detail: { agentId: id, resetSession: true, deleted: true } }));
      setOk(`deleted: ${id}`);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "delete failed");
    } finally { setDeleting(null); }
  };

  return (
    <div>
      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={() => load(true)} disabled={loading}>
          {loading ? "불러오는 중…" : "새로고침"}
        </button>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setCreating(true)}>
          + 에이전트 생성
        </button>
        {ok && <span className={styles.okMsg}>{ok}</span>}
        {err && <span className={styles.errMsg}>{err}</span>}
      </div>

      <div className={styles.panel}>
        {agents.length === 0 ? (
          <div className={styles.empty}>{loading ? "" : "에이전트가 없습니다."}</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th><th>이름</th><th>모델</th><th>테마</th><th></th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className={styles.mono}>{a.id}</td>
                  <td>{a.displayName || "—"}</td>
                  <td className={styles.mono}>{a.model || "—"}</td>
                  <td>{a.theme || "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className={styles.btn} onClick={() => setEditing(a)}>편집</button>
                    {" "}
                    <button
                      className={`${styles.btn} ${styles.btnDanger}`}
                      onClick={() => handleDelete(a.id)}
                      disabled={deleting === a.id}
                    >
                      {deleting === a.id ? "삭제 중…" : "삭제"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <AgentCreateModal
          models={models}
          onClose={() => setCreating(false)}
          onSaved={async () => { setCreating(false); setOk("생성됨"); await load(); }}
          onError={(m) => setErr(m)}
        />
      )}

      {editing && (
        <AgentEditModal
          agent={editing}
          models={models}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); setOk("저장됨"); await load(); }}
          onError={(m) => setErr(m)}
        />
      )}
    </div>
  );
}

// Claude-CLI 프로바이더는 게이트웨이 전역 config 스키마에서 거부되므로
// (auth:"cli" / baseUrl 없음) `/models` 응답에 포함되지 않는다.
// 드롭다운에서 바로 고를 수 있도록 프론트엔드에서 프리셋으로 하드코딩한다.
// GPT-6 계열도 게이트웨이(2026.4.12) 카탈로그·models.providers 에 없어
// `/models` 응답에 안 나오므로 같이 프리셋으로 둔다.
// 전부 2026-11-12 LAN 게이트웨이에서 실제 호출 확인된 ID.
const EXTRA_PRESET_MODELS = [
  { id: "openai-codex/gpt-6-astra",     label: "GPT-6 Astra (Codex·최상위)" },
  { id: "openai-codex/gpt-6.1-sol",     label: "GPT-6.1 Sol (Codex·최신 주력)" },
  { id: "claude-cli/claude-fable-5-2",  label: "Claude Fable 5.2 (CLI·구독·최상위)" },
  { id: "claude-cli/claude-opus-5-5",   label: "Claude Opus 5.5 (CLI·구독)" },
  { id: "claude-cli/claude-sonnet-5-5", label: "Claude Sonnet 5.5 (CLI·구독)" },
  { id: "claude-cli/claude-haiku-5-5",  label: "Claude Haiku 5.5 (CLI·구독)" },
];

function ModelSelect({ models, value, onChange }) {
  const serverIds = new Set(models.map((m) => m.id));
  const presets = EXTRA_PRESET_MODELS.filter((p) => !serverIds.has(p.id));
  const presetIds = new Set(presets.map((p) => p.id));
  const hasValueInList = serverIds.has(value) || presetIds.has(value);
  return (
    <select
      className={styles.input}
      value={hasValueInList ? value : "__custom__"}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "__custom__") {
          const input = window.prompt("커스텀 모델 id 입력 (예: ollama/llama3:8b)", value || "");
          if (input) onChange(input.trim());
        } else {
          onChange(v);
        }
      }}
    >
      {models.map((m) => {
        const badge = m.supportsTools ? "" : " ⚠no-tools";
        const size = m.parameterSize ? ` · ${m.parameterSize}` : "";
        const quant = m.quantization ? ` · ${m.quantization}` : "";
        return (
          <option key={m.id} value={m.id}>
            {m.id}{badge}{size}{quant}
          </option>
        );
      })}
      {presets.length > 0 && (
        <optgroup label="구독 프리셋 (Codex · Claude CLI)">
          {presets.map((p) => (
            <option key={p.id} value={p.id}>{p.id} — {p.label}</option>
          ))}
        </optgroup>
      )}
      {!hasValueInList && value ? (
        <option value={value}>{value} (현재값)</option>
      ) : null}
      <option value="__custom__">+ 커스텀 입력…</option>
    </select>
  );
}

function AgentCreateModal({ models, onClose, onSaved, onError }) {
  const [id, setId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [model, setModel] = useState((models && models[0]?.id) || DEFAULT_MODEL_ID);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(id)) {
      onError("ID는 소문자·숫자·하이픈만 (64자 이내)");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/admin/openclaw/console/agents", { id, displayName, model, systemPrompt });
      window.dispatchEvent(new CustomEvent("openclaw:agents-changed", { detail: { agentId: id } }));
      onSaved();
    } catch (e) {
      onError(e?.response?.data?.detail || e.message || "create failed");
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalBody} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>에이전트 생성</h3>
        <div className={styles.formRow}>
          <label>ID *</label>
          <input className={styles.input} value={id} onChange={(e) => setId(e.target.value)} placeholder="assistant-main" />
        </div>
        <div className={styles.formRow}>
          <label>표시 이름 *</label>
          <input className={styles.input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Main Assistant" />
        </div>
        <div className={styles.formRow}>
          <label>모델 *</label>
          <ModelSelect models={models} value={model} onChange={setModel} />
        </div>
        <div className={styles.formRow}>
          <label>시스템 프롬프트 (IDENTITY.md)</label>
          <textarea className={styles.textarea} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant…" />
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose} disabled={saving}>취소</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={saving || !id || !displayName}>
            {saving ? "생성 중…" : "생성"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentEditModal({ agent, models, onClose, onSaved, onError }) {
  const [displayName, setDisplayName] = useState(agent.displayName || "");
  const [model, setModel] = useState(agent.model || (models && models[0]?.id) || DEFAULT_MODEL_ID);
  const [theme, setTheme] = useState(agent.theme || "");
  const [emoji, setEmoji] = useState(agent.emoji || "");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.get(`/api/admin/openclaw/console/agents/${encodeURIComponent(agent.id)}/files/IDENTITY.md`);
        if (alive) setSystemPrompt(r.data.content || "");
      } catch { /* file may not exist */ }
      if (alive) setLoadingPrompt(false);
    })();
    return () => { alive = false; };
  }, [agent.id]);

  const save = async () => {
    setSaving(true);
    try {
      const body = {};
      if (displayName !== agent.displayName) body.displayName = displayName;
      if (theme !== agent.theme) body.theme = theme;
      if (emoji !== agent.emoji) body.emoji = emoji;
      const modelChanged = model !== agent.model;
      if (modelChanged) body.model = model;
      body.systemPrompt = systemPrompt;
      await api.patch(`/api/admin/openclaw/console/agents/${encodeURIComponent(agent.id)}`, body);
      window.dispatchEvent(new CustomEvent("openclaw:agents-changed", {
        detail: { agentId: agent.id, resetSession: modelChanged },
      }));
      onSaved();
    } catch (e) {
      onError(e?.response?.data?.detail || e.message || "save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalBody} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>에이전트 편집 · {agent.id}</h3>
        <div className={styles.formRow}>
          <label>표시 이름</label>
          <input className={styles.input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className={styles.formRow}>
          <label>모델</label>
          <ModelSelect models={models} value={model} onChange={setModel} listId="model-list-edit" />
        </div>
        <div className={styles.formRow}>
          <label>테마</label>
          <input className={styles.input} value={theme} onChange={(e) => setTheme(e.target.value)} />
        </div>
        <div className={styles.formRow}>
          <label>이모지</label>
          <input className={styles.input} value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        </div>
        <div className={styles.formRow}>
          <label>시스템 프롬프트 (IDENTITY.md)</label>
          {loadingPrompt ? (
            <div className={styles.infoMsg}>불러오는 중…</div>
          ) : (
            <textarea className={styles.textarea} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
          )}
        </div>
        <div className={styles.modalActions}>
          <button className={styles.btn} onClick={onClose} disabled={saving}>취소</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={saving || loadingPrompt}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
