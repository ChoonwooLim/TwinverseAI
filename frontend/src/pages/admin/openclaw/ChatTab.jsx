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
export default function ChatTab() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [sessionKey, setSessionKey] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [connState, setConnState] = useState("idle"); // idle | connecting | open | closed
  const [err, setErr] = useState("");
  const [pendingDelta, setPendingDelta] = useState("");

  const wsRef = useRef(null);
  const rpcId = useRef(1);
  const pendingResolvers = useRef({});
  const scrollRef = useRef(null);

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
    if (method === "sessions.messages" || method === "sessions.messages.delta") {
      const delta = params?.delta || params?.content || "";
      if (delta) setPendingDelta((prev) => prev + delta);
    }
    if (method === "sessions.messages.done" || method === "sessions.messages.final") {
      const final = params?.content || params?.final;
      setMessages((prev) => [...prev, { role: "assistant", content: final || "" }]);
      setPendingDelta("");
    }
    if (method === "sessions.changed") {
      // noop for now
    }
  };

  useEffect(() => () => {
    try { wsRef.current?.close(); } catch {/* ignore */}
    wsRef.current = null;
  }, []);

  const openSession = async (agentId) => {
    if (!wsRef.current || connState !== "open") { connect(); return; }
    try {
      const result = await rpc("sessions.create", { agentId });
      const key = result?.key || result?.sessionKey || `agent:${agentId}:main`;
      setSessionKey(key);
      setMessages([{ role: "system", content: `세션 시작: ${agentId}` }]);
      try { await rpc("sessions.messages.subscribe", { key }); } catch {/* ignore */}
    } catch (e) {
      setErr(typeof e === "string" ? e : (e?.message || "session create failed"));
    }
  };

  useEffect(() => {
    if (!selectedAgent) return;
    if (connState === "idle" || connState === "closed") {
      connect();
    } else if (connState === "open") {
      openSession(selectedAgent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState, selectedAgent]);

  const send = async () => {
    if (!draft.trim() || !sessionKey) return;
    const message = draft.trim();
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setDraft("");
    try {
      await rpc("sessions.send", { key: sessionKey, message });
    } catch (e) {
      setErr(typeof e === "string" ? e : (e?.message || "send failed"));
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pendingDelta]);

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
            {messages.length === 0 && !pendingDelta ? (
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
            {pendingDelta && (
              <div className={`${styles.msg} ${styles.msgAssistant}`}>{pendingDelta}<span style={{ opacity: 0.5 }}>▎</span></div>
            )}
          </div>
          <div className={styles.chatInputRow}>
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
              disabled={!sessionKey || !draft.trim()}
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
