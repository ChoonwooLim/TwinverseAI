import { useEffect, useRef, useState, useCallback } from "react";
import api from "../../../services/api";
import styles from "../AdminOpenClawConsole.module.css";

/**
 * ChatTab — browser <-> backend /api/admin/openclaw/console/chat <-> OpenClaw gateway
 *
 * Protocol:
 *   client → server first frame: {op:"auth", token:"<jwt>"}
 *   then JSON-RPC envelopes: {id, method, params}
 *   server → client: RPC responses + sessions.messages.subscribe deltas
 *
 * Sensitive fields (token/apiKey/secret/...) are stripped server-side.
 */
// Gateway `sessions.send` accepts `attachments: [{type, mimeType, fileName, content}]`
// where `content` is base64 of the raw file bytes. See openclaw-gateway
// attachment-normalize.ts (`normalizeRpcAttachmentsToChatAttachments`).
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const DOC_MIMES = ["text/plain", "text/markdown", "application/json"];
const DOC_EXTS = [".txt", ".md", ".json", ".log", ".csv"];
const ATTACH_ACCEPT = [...IMAGE_MIMES, ...DOC_MIMES, ...DOC_EXTS].join(",");
const MAX_ATTACH_BYTES = 9 * 1024 * 1024; // ~12MB base64 — fits inside 16MB WS frame

// Models known to support vision input. Keep in sync with backend model catalog.
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

export default function ChatTab() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  // Per-agent maps so switching agents never wipes another agent's transcript.
  const [sessionKeyByAgent, setSessionKeyByAgent] = useState({});
  const [messagesByAgent, setMessagesByAgent] = useState({});
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState([]); // [{kind,type,mimeType,fileName,content,size}]
  const [connState, setConnState] = useState("idle"); // idle | connecting | open | closed
  const [err, setErr] = useState("");

  const wsRef = useRef(null);
  const rpcId = useRef(1);
  const pendingResolvers = useRef({});
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastErrorRef = useRef(0); // timestamp of last fatal error — used to pause auto-reconnect
  // Reverse index: sessionKey → agentId. Gateway's `session.message` event
  // only carries sessionKey, so we need this to route deltas to the right
  // agent's buffer even when another agent is currently selected.
  const agentBySessionKey = useRef({});

  const sessionKey = sessionKeyByAgent[selectedAgent] || null;
  const messages = selectedAgent ? (messagesByAgent[selectedAgent] || []) : [];

  const appendMessage = (agentId, msg) => {
    if (!agentId) return;
    setMessagesByAgent((prev) => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), msg],
    }));
  };

  const loadAgents = useCallback(async () => {
    try {
      const r = await api.get("/api/admin/openclaw/console/agents");
      const list = r.data.agents || [];
      setAgents(list);
      const enriched = await Promise.all(list.map(async (a) => {
        try {
          const f = await api.get(`/api/admin/openclaw/console/agents/${encodeURIComponent(a.id)}/files/IDENTITY.md`);
          return { ...a, role: extractRole(f.data?.content || "") };
        } catch {
          return { ...a, role: "" };
        }
      }));
      setAgents(enriched);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "failed");
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  function extractRole(md) {
    const lines = (md || "").split(/\r?\n/);
    const out = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("#")) continue;
      if (line.startsWith("---") || line.startsWith("```")) continue;
      out.push(line.replace(/^[-*]\s+/, "").replace(/\*\*/g, ""));
      if (out.length >= 2) break;
    }
    return out.join(" ").slice(0, 140);
  }

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

      // RPC response
      if (msg.id && pendingResolvers.current[msg.id]) {
        const resolver = pendingResolvers.current[msg.id];
        delete pendingResolvers.current[msg.id];
        if (msg.error) resolver.reject(msg.error);
        else resolver.resolve(msg.result);
        return;
      }

      // Streaming notification / subscription events
      if (msg.method) handleNotification(msg);
    };

    ws.onclose = () => { setConnState("closed"); wsRef.current = null; };
    ws.onerror = () => { setErr("WebSocket 오류"); };
  }, []);

  const handleNotification = (msg) => {
    const { method, params } = msg;
    // Gateway emits `session.message` (singular) with full message object
    // whenever the transcript gains a new row (user echo, assistant reply,
    // tool call, etc). No per-token streaming events.
    if (method === "session.message") {
      const m = params?.message;
      if (!m || m.role !== "assistant") return;
      const text = extractAssistantText(m);
      if (!text) return;
      // Route delta to the agent that owns this sessionKey, not the currently
      // selected one — user may have switched agents while this reply was in flight.
      const targetAgent = agentBySessionKey.current[params?.sessionKey];
      if (!targetAgent) return;
      appendMessage(targetAgent, { role: "assistant", content: text });
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

  const openSession = async (agentId) => {
    if (!wsRef.current || connState !== "open") { connect(); return; }
    // Reuse existing session for this agent — preserves transcript on re-select.
    if (sessionKeyByAgent[agentId]) return;
    try {
      const result = await rpc("sessions.create", { agentId });
      const key = result?.key || result?.sessionKey || `agent:${agentId}:main`;
      agentBySessionKey.current[key] = agentId;
      setSessionKeyByAgent((prev) => ({ ...prev, [agentId]: key }));
      setMessagesByAgent((prev) =>
        prev[agentId] ? prev : { ...prev, [agentId]: [{ role: "system", content: `세션 시작: ${agentId}` }] }
      );
      try { await rpc("sessions.messages.subscribe", { key }); } catch {/* ignore */}
    } catch (e) {
      setErr(typeof e === "string" ? e : (e?.message || "session create failed"));
    }
  };

  useEffect(() => {
    if (!selectedAgent) return;
    if (connState === "idle") {
      connect();
    } else if (connState === "closed") {
      // Don't hammer the server if we just got an error — wait 5s before retrying
      const sinceErr = Date.now() - lastErrorRef.current;
      if (sinceErr < 5_000) return;
      connect();
    } else if (connState === "open") {
      openSession(selectedAgent);
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

  const ensureSession = async (agentId) => {
    const existing = sessionKeyByAgent[agentId];
    if (existing) return existing;
    if (!agentId) throw new Error("에이전트를 먼저 선택하세요");
    if (!wsRef.current || (connState !== "open" && connState !== "connecting")) {
      connect();
    }
    await waitForOpen();
    const result = await rpc("sessions.create", { agentId });
    const key = result?.key || result?.sessionKey || `agent:${agentId}:main`;
    agentBySessionKey.current[key] = agentId;
    setSessionKeyByAgent((prev) => ({ ...prev, [agentId]: key }));
    setMessagesByAgent((prev) =>
      prev[agentId] ? prev : { ...prev, [agentId]: [{ role: "system", content: `세션 시작: ${agentId}` }] }
    );
    try { await rpc("sessions.messages.subscribe", { key }); } catch {/* ignore */}
    return key;
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
          next.push({
            kind: "image",
            mimeType: mime,
            fileName: file.name,
            content: b64,      // base64 — passed to gateway as attachment
            size: file.size,
          });
        } else {
          const text = await readFileAsText(file);
          next.push({
            kind: "document",
            mimeType: mime,
            fileName: file.name,
            text,               // plain text — inlined into message body
            size: file.size,
          });
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
    const images = pendingAttachments.filter((a) => a.kind === "image");
    const docs = pendingAttachments.filter((a) => a.kind === "document");

    // Inline document contents into the message body as fenced blocks.
    const docBlocks = docs.map(
      (d) => `--- 첨부 문서: ${d.fileName} ---\n\`\`\`\n${d.text}\n\`\`\``
    );
    const message = [draft.trim(), ...docBlocks].filter(Boolean).join("\n\n");

    const attachments = images.map((a) => ({
      type: "image",
      mimeType: a.mimeType,
      fileName: a.fileName,
      content: a.content,  // base64
    }));

    const chipSummary = pendingAttachments.length
      ? `📎 ${pendingAttachments.map((a) => a.fileName).join(", ")}`
      : "";
    const displayContent = [draft.trim(), chipSummary].filter(Boolean).join("\n\n");

    appendMessage(agentId, { role: "user", content: displayContent || "(첨부 전송)" });
    setDraft("");
    setPendingAttachments([]);
    try {
      const key = await ensureSession(agentId);
      const params = { key, message };
      if (attachments.length) params.attachments = attachments;
      await rpc("sessions.send", params);
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
                : !sessionKey ? (connState === "open" ? "세션 준비 중…" : "연결 중…")
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
