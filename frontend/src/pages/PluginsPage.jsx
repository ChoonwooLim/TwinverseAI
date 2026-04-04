import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import s from "./PluginsPage.module.css";

export default function PluginsPage() {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editEnv, setEditEnv] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newPlugin, setNewPlugin] = useState({ key: "", command: "npx", args: "", env_key: "", env_value: "" });
  const [message, setMessage] = useState("");

  const loadPlugins = () => {
    api.get("/api/plugins/list").then(({ data }) => {
      setPlugins(data);
      setLoading(false);
    });
  };

  useEffect(() => { loadPlugins(); }, []);

  const handleEdit = (plugin) => {
    if (editingKey === plugin.key) {
      setEditingKey(null);
      return;
    }
    setEditingKey(plugin.key);
    api.get(`/api/plugins/${plugin.key}`).then(({ data }) => {
      setEditEnv(data.env || {});
    });
  };

  const handleSave = async (pluginKey) => {
    await api.put(`/api/plugins/${pluginKey}`, { env: editEnv });
    setEditingKey(null);
    setMessage(`${pluginKey} 설정이 저장되었습니다.`);
    setTimeout(() => setMessage(""), 3000);
    loadPlugins();
  };

  const handleAdd = async () => {
    const args = newPlugin.args.split(" ").filter(Boolean);
    const env = newPlugin.env_key ? { [newPlugin.env_key]: newPlugin.env_value } : undefined;
    try {
      await api.post("/api/plugins/add", { key: newPlugin.key, command: newPlugin.command, args, env });
      setShowAdd(false);
      setNewPlugin({ key: "", command: "npx", args: "", env_key: "", env_value: "" });
      setMessage(`${newPlugin.key} 플러그인이 추가되었습니다.`);
      setTimeout(() => setMessage(""), 3000);
      loadPlugins();
    } catch (err) {
      setMessage(err.response?.data?.detail || "추가 실패");
    }
  };

  const handleRemove = async (pluginKey) => {
    if (!confirm(`${pluginKey} 플러그인을 삭제하시겠습니까?`)) return;
    await api.delete(`/api/plugins/${pluginKey}`);
    setMessage(`${pluginKey} 플러그인이 삭제되었습니다.`);
    setTimeout(() => setMessage(""), 3000);
    loadPlugins();
  };

  return (
    <div className={s.page}>
      <Link to="/" className={s.breadcrumb}>
        <span>Home</span>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span>Plugins</span>
      </Link>

      <div className={s.headerRow}>
        <h1 className={s.title}>Plugins (MCP)</h1>
        <button
          className={s.ghostBtn}
          onClick={() => setShowAdd(!showAdd)}
          type="button"
        >
          <span className={s.ghostBtnIcon}>+</span>
          새 플러그인
        </button>
      </div>
      <p className={s.subtitle}>
        Claude Code에 연결된 MCP 플러그인입니다. 환경변수 수정, 새 플러그인 추가/삭제가 가능합니다.
      </p>

      {/* Toast notification */}
      {message && (
        <div className={s.toast}>
          <span className={s.toastDot} />
          {message}
        </div>
      )}

      {/* Add plugin form — smooth expand */}
      <div className={`${s.addForm} ${showAdd ? s.addFormOpen : ""}`}>
        <div className={s.addFormInner}>
          <div className={s.addFormContent}>
            <h3 className={s.addFormTitle}>새 MCP 플러그인 추가</h3>

            <div className={s.fieldGroup}>
              <label className={s.fieldLabel}>키</label>
              <input
                className={s.input}
                placeholder="예: my-server"
                value={newPlugin.key}
                onChange={(e) => setNewPlugin({ ...newPlugin, key: e.target.value })}
              />
            </div>

            <div className={s.fieldGroup}>
              <label className={s.fieldLabel}>명령어</label>
              <input
                className={s.input}
                placeholder="예: npx"
                value={newPlugin.command}
                onChange={(e) => setNewPlugin({ ...newPlugin, command: e.target.value })}
              />
            </div>

            <div className={s.fieldGroup}>
              <label className={s.fieldLabel}>인자</label>
              <input
                className={s.input}
                placeholder="공백 구분, 예: -y @org/server"
                value={newPlugin.args}
                onChange={(e) => setNewPlugin({ ...newPlugin, args: e.target.value })}
              />
            </div>

            <div className={s.fieldGroup}>
              <label className={s.fieldLabel}>환경변수 키 (선택)</label>
              <input
                className={s.input}
                placeholder="예: API_KEY"
                value={newPlugin.env_key}
                onChange={(e) => setNewPlugin({ ...newPlugin, env_key: e.target.value })}
              />
            </div>

            {newPlugin.env_key && (
              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>환경변수 값</label>
                <input
                  className={s.input}
                  placeholder="값을 입력하세요"
                  value={newPlugin.env_value}
                  onChange={(e) => setNewPlugin({ ...newPlugin, env_value: e.target.value })}
                />
              </div>
            )}

            <div className={s.formActions}>
              <button className={s.btnPrimary} onClick={handleAdd} type="button">
                추가
              </button>
              <button className={s.btnSecondary} onClick={() => setShowAdd(false)} type="button">
                취소
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Plugin list */}
      {loading ? (
        <div className={s.loading}>
          <span className={s.spinner} />
          로딩중...
        </div>
      ) : (
        <div className={s.list}>
          {plugins.map((p, i) => {
            const isEditing = editingKey === p.key;
            return (
              <div key={p.key}>
                {/* Plugin row */}
                <div
                  className={s.row}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className={s.rowLeft}>
                    <div className={s.rowNameLine}>
                      <span className={s.pluginName}>
                        {p.display_name || p.key}
                      </span>
                      {p.is_configured ? (
                        <span className={s.badgeGreen}>활성</span>
                      ) : (
                        <span className={s.badgeAmber}>설정 필요</span>
                      )}
                    </div>
                    <p className={s.pluginDesc}>{p.description}</p>
                    {p.usage && (
                      <p className={s.pluginUsage}>사용법: {p.usage}</p>
                    )}
                    <code className={s.pluginCmd}>
                      {p.command} {p.args.join(" ")}
                    </code>
                  </div>

                  <div className={s.actions}>
                    <button
                      className={s.iconBtn}
                      onClick={() => handleEdit(p)}
                      type="button"
                      title={isEditing ? "닫기" : "설정"}
                    >
                      {/* Gear icon */}
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="8" cy="8" r="2.5" />
                        <path d="M13.3 10a1.1 1.1 0 00.2 1.2l.04.04a1.33 1.33 0 11-1.88 1.88l-.04-.04a1.1 1.1 0 00-1.2-.2 1.1 1.1 0 00-.67 1.01v.12a1.33 1.33 0 01-2.67 0v-.06a1.1 1.1 0 00-.72-1.01 1.1 1.1 0 00-1.2.2l-.04.04a1.33 1.33 0 11-1.88-1.88l.04-.04a1.1 1.1 0 00.2-1.2 1.1 1.1 0 00-1.01-.67h-.12a1.33 1.33 0 010-2.67h.06a1.1 1.1 0 001.01-.72 1.1 1.1 0 00-.2-1.2l-.04-.04a1.33 1.33 0 111.88-1.88l.04.04a1.1 1.1 0 001.2.2h.05a1.1 1.1 0 00.67-1.01v-.12a1.33 1.33 0 012.67 0v.06a1.1 1.1 0 00.67 1.01 1.1 1.1 0 001.2-.2l.04-.04a1.33 1.33 0 111.88 1.88l-.04.04a1.1 1.1 0 00-.2 1.2v.05a1.1 1.1 0 001.01.67h.12a1.33 1.33 0 010 2.67h-.06a1.1 1.1 0 00-1.01.67z" />
                      </svg>
                    </button>
                    <button
                      className={s.iconBtnDanger}
                      onClick={() => handleRemove(p.key)}
                      type="button"
                      title="삭제"
                    >
                      {/* Trash icon */}
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2.5 4.5h11M5.5 4.5V3a1 1 0 011-1h3a1 1 0 011 1v1.5M12 4.5l-.5 8.5a1.5 1.5 0 01-1.5 1.5H6a1.5 1.5 0 01-1.5-1.5L4 4.5" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Settings panel — smooth expand */}
                <div className={`${s.settingsPanel} ${isEditing ? s.settingsPanelOpen : ""}`}>
                  <div className={s.settingsInner}>
                    <div className={s.settingsContent}>
                      <h4 className={s.settingsTitle}>환경변수</h4>
                      {Object.keys(editEnv).length === 0 ? (
                        <p className={s.noEnv}>환경변수 없음</p>
                      ) : (
                        Object.entries(editEnv).map(([k, v]) => (
                          <div key={k} className={s.envField}>
                            <label className={s.envLabel}>{k}</label>
                            <input
                              className={s.envInput}
                              value={v}
                              onChange={(e) => setEditEnv({ ...editEnv, [k]: e.target.value })}
                              placeholder={`${k} 값 입력`}
                            />
                          </div>
                        ))
                      )}
                      <div className={s.settingsActions}>
                        <button
                          className={s.btnPrimary}
                          onClick={() => handleSave(p.key)}
                          type="button"
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
