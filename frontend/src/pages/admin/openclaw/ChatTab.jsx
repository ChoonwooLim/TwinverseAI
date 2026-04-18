import { useEffect, useRef, useState, useCallback } from "react";
import api from "../../../services/api";
import styles from "../AdminOpenClawConsole.module.css";

/**
 * ChatTab — browser <-> backend /api/admin/openclaw/console/chat <-> OpenClaw gateway
 *
 * Conversations are persisted per (user, agent) via REST:
 *   GET/POST/PATCH/DELETE /api/admin/openclaw/console/conversations
 * On `sessions.send` the frontend attaches `tvConversationId` + `tvRawUserText`
 * which the backend peels off to write user/assistant turns into the DB.
 *
 * History replay (option B): when resuming a past conversation we open a
 * fresh gateway session and, on the first send, prepend stored history as a
 * context block so the model has prior turns without gateway-side session
 * persistence. `tvRawUserText` keeps the DB copy clean (no prefix noise).
 */
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const DOC_MIMES = ["text/plain", "text/markdown", "application/json"];
const DOC_EXTS = [".txt", ".md", ".json", ".log", ".csv"];
const ATTACH_ACCEPT = [...IMAGE_MIMES, ...DOC_MIMES, ...DOC_EXTS].join(",");
const MAX_ATTACH_BYTES = 9 * 1024 * 1024;

const VISION_MODEL_HINTS = ["llava", "vision", "minicpm-v", "llama3.2-vision"];
const isVisionModel = (modelId) => {
  if (!modelId) return false;
  const s = String(modelId).toLowerCase();
  return VISION_MODEL_HINTS.some((h) => s.includes(h));
};

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => {
    const result = String(r.result || "");
    const comma = result.indexOf(",");
    resolve(comma >= 0 ? result.slice(comma + 1) : result);
  };
  r.onerror = () => reject(r.error || new Error("file read failed"));
  r.readAsDataURL(file);
});

const readFileAsText = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || ""));
  r.onerror = () => reject(r.error || new Error("file read failed"));
  r.readAsText(file, "utf-8");
});

const CONV_BASE = "/api/admin/openclaw/console/conversations";

export default function ChatTab() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);

  // Conversations per agent (sidebar column #2)
  const [convsByAgent, setConvsByAgent] = useState({}); // {agentId: Conv[]}
  const [activeConvByAgent, setActiveConvByAgent] = useState({}); // {agentId: convId}
  const [renamingConvId, setRenamingConvId] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");

  // Per-conversation state (keyed by convId so agent switches don't wipe)
  const [messagesByConv, setMessagesByConv] = useState({}); // {convId: Message[]}
  const [sessionKeyByConv, setSessionKeyByConv] = useState({}); // {convId: gatewayKey}
  const needsReplayByConv = useRef({}); // {convId: true} — first-send replay flag

  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [connState, setConnState] = useState("idle");
  const [err, setErr] = useState("");

  const wsRef = useRef(null);
  const rpcId = useRef(1);
  const pendingResolvers = useRef({});
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastErrorRef = useRef(0);
  // sessionKey → convId (reverse) so gateway events can be routed
  const convBySessionKey = useRef({});

  const activeConvId = selectedAgent ? activeConvByAgent[selectedAgent] || null : null;
  const sessionKey = activeConvId ? sessionKeyByConv[activeConvId] || null : null;
  const messages = activeConvId ? (messagesByConv[activeConvId] || []) : [];
  const conversations = selectedAgent ? (convsByAgent[selectedAgent] || []) : [];

  const appendMessage = (convId, msg) => {
    if (!convId) return;
    setMessagesByConv((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), msg],
    }));
  };

  const loadAgents = useCallback(async () => {
    try {
      const r = await api.get("/api/admin/openclaw/console/agents");
      setAgents(r.data.agents || []);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "failed");
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const loadConversations = useCallback(async (agentId) => {
    if (!agentId) return [];
    try {
      const r = await api.get(`${CONV_BASE}?agent_id=${encodeURIComponent(agentId)}`);
      const convs = r.data.conversations || [];
      setConvsByAgent((prev) => ({ ...prev, [agentId]: convs }));
      return convs;
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "대화 목록 로드 실패");
      return [];
    }
  }, []);

  const loadConversationMessages = useCallback(async (convId) => {
    try {
      const r = await api.get(`${CONV_BASE}/${convId}`);
      const msgs = (r.data.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      setMessagesByConv((prev) => ({ ...prev, [convId]: msgs }));
      // History exists → mark for replay on next send
      needsReplayByConv.current[convId] = msgs.length > 0;
      return r.data;
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "대화 내용 로드 실패");
      return null;
    }
  }, []);

  const createConversation = async (agentId, title = null) => {
    try {
      const r = await api.post(CONV_BASE, { agent_id: agentId, title });
      const conv = r.data;
      setConvsByAgent((prev) => ({
        ...prev,
        [agentId]: [conv, ...(prev[agentId] || [])],
      }));
      setActiveConvByAgent((prev) => ({ ...prev, [agentId]: conv.id }));
      setMessagesByConv((prev) => ({ ...prev, [conv.id]: [] }));
      needsReplayByConv.current[conv.id] = false;
      return conv;
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "대화 생성 실패");
      return null;
    }
  };

  const selectConversation = async (convId) => {
    if (!selectedAgent) return;
    setActiveConvByAgent((prev) => ({ ...prev, [selectedAgent]: convId }));
    // Always reload from DB so two browsers stay in sync
    await loadConversationMessages(convId);
    // Clear gateway session — a fresh one will be created on next send.
    setSessionKeyByConv((prev) => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });
  };

  const renameConversation = async (convId, newTitle) => {
    const title = (newTitle || "").trim();
    if (!title) { setRenamingConvId(null); return; }
    try {
      const r = await api.patch(`${CONV_BASE}/${convId}`, { title });
      const updated = r.data;
      setConvsByAgent((prev) => {
        const agentId = selectedAgent;
        if (!agentId) return prev;
        return {
          ...prev,
          [agentId]: (prev[agentId] || []).map((c) => (c.id === convId ? updated : c)),
        };
      });
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "이름 변경 실패");
    } finally {
      setRenamingConvId(null);
    }
  };

  const deleteConversation = async (convId) => {
    if (!window.confirm("이 대화를 삭제하시겠습니까? (복구 불가)")) return;
    try {
      await api.delete(`${CONV_BASE}/${convId}`);
      setConvsByAgent((prev) => {
        const agentId = selectedAgent;
        if (!agentId) return prev;
        return {
          ...prev,
          [agentId]: (prev[agentId] || []).filter((c) => c.id !== convId),
        };
      });
      if (activeConvByAgent[selectedAgent] === convId) {
        setActiveConvByAgent((prev) => {
          const next = { ...prev };
          delete next[selectedAgent];
          return next;
        });
      }
      setMessagesByConv((prev) => {
        const next = { ...prev };
        delete next[convId];
        return next;
      });
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "삭제 실패");
    }
  };

  // Agent switch: load conversations, auto-pick most recent or create a fresh one
  useEffect(() => {
    if (!selectedAgent) return;
    (async () => {
      const convs = await loadConversations(selectedAgent);
      if (activeConvByAgent[selectedAgent]) return;
      if (convs.length > 0) {
        const mostRecent = convs[0];
        setActiveConvByAgent((prev) => ({ ...prev, [selectedAgent]: mostRecent.id }));
        await loadConversationMessages(mostRecent.id);
      } else {
        await createConversation(selectedAgent);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent]);

  const wsUrl = () => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${proto}//${host}/api/admin/openclaw/console/chat`;
  };

  const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const id = String(rpcId.current++);
    const msg = { id, method, params };
    pendingResolvers.current[id] = { resolve, reject };
    try {
      wsRef.current?.send(JSON.stringify(msg));
    } catch (e) { reject(e); }
    setTimeout(() => {
      if (pendingResolvers.current[id]) {
        pendingResolvers.current[id].reject(new Error("rpc timeout"));
        delete pendingResolvers.current[id];
      }
    }, 30_000);
  });

  const connect = useCallback(() => {
    if (wsRef.current) return;
    setConnState("connecting"); setErr("");
    const ws = new WebSocket(wsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      const token = localStorage.getItem("token") || "";
      ws.send(JSON.stringify({ op: "auth", token }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.op === "ready") { setConnState("open"); return; }
      if (msg.op === "auth.error" || msg.op === "error") {
        setErr(msg.message || msg.code || "error");
        lastErrorRef.current = Date.now();
        return;
      }

      if (msg.id && pendingResolvers.current[msg.id]) {
        const resolver = pendingResolvers.current[msg.id];
        delete pendingResolvers.current[msg.id];
        if (msg.error) resolver.reject(msg.error);
        else resolver.resolve(msg.result);
        return;
      }

      if (msg.method) handleNotification(msg);
    };

    ws.onclose = () => { setConnState("closed"); wsRef.current = null; };
    ws.onerror = () => { setErr("WebSocket 오류"); };
  }, []);

  const handleNotification = (msg) => {
    const { method, params } = msg;
    if (method === "session.message") {
      const m = params?.message;
      if (!m || m.role !== "assistant") return;
      const text = extractAssistantText(m);
      if (!text) return;
      const targetConv = convBySessionKey.current[params?.sessionKey];
      if (!targetConv) return;
      appendMessage(targetConv, { role: "assistant", content: text });
    }
  };

  const extractAssistantText = (m) => {
    const content = m?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((c) => (typeof c === "string" ? c : c?.text || ""))
        .filter(Boolean)
        .join("\n");
    }
    return "";
  };

  useEffect(() => () => {
    try { wsRef.current?.close(); } catch {/* ignore */}
    wsRef.current = null;
  }, []);

  useEffect(() => {
    if (!selectedAgent) return;
    if (connState === "idle") {
      connect();
    } else if (connState === "closed") {
      const sinceErr = Date.now() - lastErrorRef.current;
      if (sinceErr < 5_000) return;
      connect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState, selectedAgent]);

  const waitForOpen = () => new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (connState === "open" && wsRef.current?.readyState === 1) return resolve();
      if (Date.now() - start > 8000) return reject(new Error("connection timeout"));
      setTimeout(tick, 150);
    };
    tick();
  });

  const ensureSession = async (agentId, convId) => {
    const existing = sessionKeyByConv[convId];
    if (existing) return existing;
    if (!agentId) throw new Error("에이전트를 먼저 선택하세요");
    if (!convId) throw new Error("대화를 먼저 선택하세요");
    if (!wsRef.current || (connState !== "open" && connState !== "connecting")) {
      connect();
    }
    await waitForOpen();
    const result = await rpc("sessions.create", { agentId });
    const key = result?.key || result?.sessionKey || `agent:${agentId}:conv:${convId}`;
    convBySessionKey.current[key] = convId;
    setSessionKeyByConv((prev) => ({ ...prev, [convId]: key }));
    try { await rpc("sessions.messages.subscribe", { key }); } catch {/* ignore */}
    return key;
  };

  const buildReplayPrefix = (priorMsgs) => {
    const slice = priorMsgs.slice(-20); // cap to last 20 turns
    if (slice.length === 0) return "";
    const lines = slice.map((m) => {
      const tag = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User";
      return `${tag}: ${m.content}`;
    });
    return `[이전 대화 맥락 — 아래 내용을 기억해서 이어받아 주세요]\n${lines.join("\n\n")}\n\n[현재 새 메시지]\n`;
  };

  const selectedAgentObj = agents.find((a) => a.id === selectedAgent) || null;
  const hasPendingImage = pendingAttachments.some((a) => a.kind === "image");
  const visionWarning = hasPendingImage && selectedAgentObj && !isVisionModel(selectedAgentObj.model);

  const addAttachments = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const next = [];
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_ATTACH_BYTES) {
        setErr(`${file.name}: 파일이 너무 큽니다 (최대 ${Math.floor(MAX_ATTACH_BYTES / 1024 / 1024)}MB)`);
        continue;
      }
      const mime = file.type || "application/octet-stream";
      const isImg = IMAGE_MIMES.includes(mime);
      const extIsDoc = DOC_EXTS.some((e) => file.name.toLowerCase().endsWith(e));
      const isDoc = DOC_MIMES.includes(mime) || extIsDoc;
      if (!isImg && !isDoc) {
        setErr(`${file.name}: 지원하지 않는 형식`);
        continue;
      }
      try {
        if (isImg) {
          const b64 = await readFileAsBase64(file);
          next.push({ kind: "image", mimeType: mime, fileName: file.name, content: b64, size: file.size });
        } else {
          const text = await readFileAsText(file);
          next.push({ kind: "document", mimeType: mime, fileName: file.name, text, size: file.size });
        }
      } catch (e) {
        setErr(`${file.name}: 읽기 실패 — ${e?.message || e}`);
      }
    }
    if (next.length) setPendingAttachments((prev) => [...prev, ...next]);
  };

  const removeAttachment = (idx) =>
    setPendingAttachments((prev) => prev.filter((_, i) => i !== idx));

  const openFilePicker = () => fileInputRef.current?.click();

  const send = async () => {
    if ((!draft.trim() && pendingAttachments.length === 0) || !selectedAgent) return;
    const agentId = selectedAgent;
    let convId = activeConvByAgent[agentId];
    if (!convId) {
      const conv = await createConversation(agentId);
      if (!conv) return;
      convId = conv.id;
    }

    const images = pendingAttachments.filter((a) => a.kind === "image");
    const docs = pendingAttachments.filter((a) => a.kind === "document");
    const docBlocks = docs.map(
      (d) => `--- 첨부 문서: ${d.fileName} ---\n\`\`\`\n${d.text}\n\`\`\``
    );
    const rawUserText = [draft.trim(), ...docBlocks].filter(Boolean).join("\n\n");

    // History replay on the first send of a resumed conversation
    let messageOut = rawUserText;
    if (needsReplayByConv.current[convId]) {
      const prior = messagesByConv[convId] || [];
      const prefix = buildReplayPrefix(prior);
      messageOut = prefix + rawUserText;
      needsReplayByConv.current[convId] = false;
    }

    const attachments = images.map((a) => ({
      type: "image",
      mimeType: a.mimeType,
      fileName: a.fileName,
      content: a.content,
    }));

    const chipSummary = pendingAttachments.length
      ? `📎 ${pendingAttachments.map((a) => a.fileName).join(", ")}`
      : "";
    const displayContent = [draft.trim(), chipSummary].filter(Boolean).join("\n\n");

    appendMessage(convId, { role: "user", content: displayContent || "(첨부 전송)" });
    setDraft("");
    setPendingAttachments([]);
    try {
      const key = await ensureSession(agentId, convId);
      const params = {
        key,
        message: messageOut,
        tvConversationId: convId,
        tvRawUserText: rawUserText,
      };
      if (attachments.length) params.attachments = attachments;
      await rpc("sessions.send", params);
      // Refresh the conversation list so last_message_at / title updates show
      loadConversations(agentId);
    } catch (e) {
      setErr(typeof e === "string" ? e : (e?.message || "send failed"));
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div>
      <div className={styles.toolbar}>
        {connState === "idle" || connState === "closed" ? (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={connect}>연결</button>
        ) : (
          <span className={styles.infoMsg}>● {connState === "open" ? "연결됨" : "연결 중…"}</span>
        )}
        {err && <span className={styles.errMsg}>{err}</span>}
      </div>

      <div className={styles.chatLayout}>
        {/* Column 1: Agents */}
        <div className={styles.chatSidebar}>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: "0.5rem" }}>
            에이전트
          </div>
          {agents.length === 0 ? (
            <div className={styles.empty}>에이전트 없음</div>
          ) : agents.map((a) => {
            const emoji = a.emoji || "";
            const initial = (a.displayName || a.id || "?").trim().charAt(0).toUpperCase();
            return (
              <div
                key={a.id}
                className={`${styles.agentListItem} ${selectedAgent === a.id ? styles.agentListItemActive : ""}`}
                onClick={() => setSelectedAgent(a.id)}
                title={a.role || a.id}
              >
                <div className={styles.agentThumb}>
                  {emoji ? emoji : <span className={styles.agentThumbFallback}>{initial}</span>}
                </div>
                <div className={styles.agentInfo}>
                  <div className={styles.agentName}>{a.displayName || a.id}</div>
                  {a.role ? <div className={styles.agentRole}>{a.role}</div> : null}
                  <div className={styles.agentMeta}>{a.id} · {a.model}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Column 2: Conversations for selected agent */}
        <div className={styles.convSidebar}>
          <div style={{ fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: "0.35rem" }}>
            대화 목록
          </div>
          <button
            className={styles.convNewBtn}
            onClick={() => selectedAgent && createConversation(selectedAgent)}
            disabled={!selectedAgent}
          >
            + 새 대화
          </button>
          {!selectedAgent ? (
            <div className={styles.convEmpty}>에이전트를 선택하세요</div>
          ) : conversations.length === 0 ? (
            <div className={styles.convEmpty}>대화 없음</div>
          ) : conversations.map((c) => {
            const isActive = activeConvId === c.id;
            const isRenaming = renamingConvId === c.id;
            return (
              <div
                key={c.id}
                className={`${styles.convItem} ${isActive ? styles.convItemActive : ""}`}
                onClick={() => !isRenaming && selectConversation(c.id)}
              >
                {isRenaming ? (
                  <input
                    className={styles.convInput}
                    value={renameDraft}
                    autoFocus
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={() => renameConversation(c.id, renameDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") renameConversation(c.id, renameDraft);
                      else if (e.key === "Escape") setRenamingConvId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <span className={styles.convTitle} title={c.title}>{c.title}</span>
                    <div className={styles.convActions}>
                      <button
                        className={styles.convIconBtn}
                        title="이름 변경"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingConvId(c.id);
                          setRenameDraft(c.title);
                        }}
                      >✎</button>
                      <button
                        className={styles.convIconBtn}
                        title="삭제"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(c.id);
                        }}
                      >🗑</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Column 3: Chat main */}
        <div className={styles.chatMain}>
          <div ref={scrollRef} className={styles.chatMessages}>
            {messages.length === 0 ? (
              <div className={styles.empty}>
                {selectedAgent ? "메시지를 입력해 대화를 시작하세요." : "좌측에서 에이전트를 선택하세요."}
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`${styles.msg} ${
                  m.role === "user" ? styles.msgUser : m.role === "system" ? styles.msgSystem : styles.msgAssistant
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
          {pendingAttachments.length > 0 && (
            <div className={styles.attachStrip}>
              {pendingAttachments.map((a, i) => (
                <div
                  key={i}
                  className={styles.attachChip}
                  title={`${a.fileName} · ${(a.size / 1024).toFixed(1)} KB`}
                >
                  <span className={styles.attachIcon}>{a.kind === "image" ? "🖼" : "📄"}</span>
                  <span className={styles.attachName}>{a.fileName}</span>
                  <button
                    className={styles.attachRemove}
                    onClick={() => removeAttachment(i)}
                    title="제거"
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {visionWarning && (
            <div className={styles.attachWarn}>
              ⚠ 선택된 모델({selectedAgentObj?.model})은 비전 미지원일 수 있습니다. 이미지는
              LLaVA(bench-llava-7b) 같은 비전 모델에서 정상 처리됩니다.
            </div>
          )}
          <div className={styles.chatInputRow}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ATTACH_ACCEPT}
              style={{ display: "none" }}
              onChange={(e) => {
                addAttachments(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              className={styles.btn}
              onClick={openFilePicker}
              disabled={!selectedAgent}
              title="이미지/문서 첨부"
            >
              📎
            </button>
            <textarea
              className={styles.chatInput}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                !selectedAgent ? "좌측에서 에이전트를 선택하세요"
                : !activeConvId ? "대화를 선택하거나 새로 만드세요"
                : "메시지를 입력하세요 (Enter=전송, Shift+Enter=줄바꿈)"
              }
              disabled={!selectedAgent}
            />
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={send}
              disabled={!selectedAgent || (!draft.trim() && pendingAttachments.length === 0)}
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
