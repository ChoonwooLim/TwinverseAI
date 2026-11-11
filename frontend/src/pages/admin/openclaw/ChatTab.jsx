import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import api from "../../../services/api";
import styles from "../AdminOpenClawConsole.module.css";
import {
  IMAGE_MIMES,
  DOC_MIMES,
  DOC_EXTS,
  buildUserText,
  extractClipboardImages,
  isDuplicateImage,
  pastedImageName,
  planAttachments,
} from "../../../utils/chatAttachments";
import {
  apiErrorText,
  isAlreadyGone,
  resolveActiveConversation,
  sessionKeysForConversation,
  withoutDeleted,
} from "../../../utils/chatConversations";

const OPENCLAW_PUBLIC_BASE = "https://openclaw.twinverse.org";

// Rewrite hrefs that point at OpenClaw-internal canvas/workspace paths to the
// public Cloudflare-tunneled origin so links the agent emits actually resolve
// from the browser. Internal: /__openclaw__/* and /data/.openclaw/*. Anything
// else is left alone.
function resolveOpenClawHref(raw) {
  if (typeof raw !== "string" || raw.length === 0) return raw;
  if (raw.startsWith("/__openclaw__/")) return `${OPENCLAW_PUBLIC_BASE}${raw}`;
  if (raw.startsWith("/data/.openclaw/")) {
    // Best-effort: workspace files live behind canvas/documents/<basename>
    // when the agent stages them; if not staged the raw path won't work
    // anyway, so this stays a no-op fallback.
    return raw;
  }
  return raw;
}

const MARKDOWN_COMPONENTS = {
  a: ({ node: _node, href, children, ...props }) => (
    <a {...props} href={resolveOpenClawHref(href)} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

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
const ATTACH_ACCEPT = [...IMAGE_MIMES, ...DOC_MIMES, ...DOC_EXTS].join(",");
const REPLAY_TURN_LIMIT = 8;
const REPLAY_MSG_CHAR_LIMIT = 1200;
const REPLAY_TOTAL_CHAR_LIMIT = 7000;
const IMAGE_PATH_RE = /(?:^|[\s([`'"])(\/data\/\.openclaw\/[^\s`'"<>]+\.(?:png|jpe?g|gif|webp|svg)|(?:\.{0,2}\/)?[A-Za-z0-9._/-]+\.(?:png|jpe?g|gif|webp|svg))(?=$|[\s)`'".,;:!?<>])/gi;
const IMAGE_MD_RE = /!\[[^\]]*]\(([^)\s]+?\.(?:png|jpe?g|gif|webp|svg))\)/gi;

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

const releasePreviews = (items) => {
  for (const a of items) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
};

const CONV_BASE ="/api/admin/openclaw/console/conversations";
const SIDEBAR_STORAGE_KEY = "openclaw:chat-sidebars";
const EMPTY_MESSAGES = [];

function readSidebarPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(SIDEBAR_STORAGE_KEY));
    return { agents: saved?.agents === true, conversations: saved?.conversations === true };
  } catch {
    return { agents: false, conversations: false };
  }
}

function ChatSidebar({ id, title, collapsed, onToggle, className, children }) {
  const action = `${title} ${collapsed ? "펼치기" : "접기"}`;
  return (
    <aside className={`${className} ${collapsed ? styles.sidebarCollapsed : ""}`} aria-label={title}>
      <button
        type="button"
        className={styles.sidebarToggle}
        onClick={onToggle}
        aria-label={action}
        aria-expanded={!collapsed}
        aria-controls={id}
        title={action}
      >
        <span className={styles.sidebarTitle}>{title}</span>
        <svg className={styles.sidebarChevron} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>
      <div id={id} className={styles.sidebarContent} hidden={collapsed}>
        {children}
      </div>
    </aside>
  );
}

const truncateReplayText = (value, limit = REPLAY_MSG_CHAR_LIMIT) => {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit)}\n[...truncated...]` : text;
};

const cleanImagePath = (value) => (
  String(value || "")
    .trim()
    .replace(/^`+|`+$/g, "")
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/[.,;:!?]+$/g, "")
);

const imageName = (path) => {
  const clean = cleanImagePath(path);
  const parts = clean.split(/[\\/]/);
  return parts[parts.length - 1] || clean;
};

const extractImageRefs = (content) => {
  const text = String(content || "");
  const seen = new Set();
  const refs = [];
  const add = (raw) => {
    const path = cleanImagePath(raw);
    if (!path || path.includes("://") || seen.has(path)) return;
    seen.add(path);
    refs.push(path);
  };

  for (const match of text.matchAll(IMAGE_MD_RE)) add(match[1]);
  for (const match of text.matchAll(IMAGE_PATH_RE)) add(match[1]);
  return refs.slice(0, 6);
};

const MessageImages = memo(function MessageImages({ agentId, refs }) {
  const [items, setItems] = useState([]);
  const refKey = refs.join("\n");

  useEffect(() => {
    if (!agentId || !refKey) {
      setItems([]);
      return undefined;
    }

    let cancelled = false;
    const urls = [];
    const paths = refKey.split("\n").filter(Boolean);
    setItems(paths.map((path) => ({ path, status: "loading" })));

    Promise.all(paths.map(async (path) => {
      try {
        const r = await api.get(
          `/api/admin/openclaw/console/agents/${encodeURIComponent(agentId)}/workspace-image`,
          { params: { path }, responseType: "blob" }
        );
        if (cancelled) return { path, status: "cancelled" };
        const url = URL.createObjectURL(r.data);
        urls.push(url);
        return { path, status: "ready", url };
      } catch (e) {
        return {
          path,
          status: "error",
          error: e?.response?.data?.detail || e?.message || "로드 실패",
        };
      }
    })).then((next) => {
      if (!cancelled) setItems(next.filter((item) => item.status !== "cancelled"));
    });

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [agentId, refKey]);

  if (!items.length) return null;

  return (
    <div className={styles.msgImages}>
      {items.map((item) => (
        <div key={item.path} className={styles.msgImageCard}>
          {item.status === "ready" ? (
            <img
              className={styles.msgImage}
              src={item.url}
              alt={imageName(item.path)}
              loading="lazy"
            />
          ) : (
            <div className={styles.msgImagePlaceholder}>
              {item.status === "loading" ? "불러오는 중" : "이미지 로드 실패"}
            </div>
          )}
          <div className={styles.msgImageMeta}>
            <span className={styles.msgImageName} title={item.path}>{imageName(item.path)}</span>
            {item.status === "ready" && (
              <a className={styles.msgImageLink} href={item.url} target="_blank" rel="noreferrer">
                보기
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({ message, agentId }) {
  const refs = useMemo(() => extractImageRefs(message.content), [message.content]);
  return (
    <div
      className={`${styles.msg} ${
        message.role === "user" ? styles.msgUser : message.role === "system" ? styles.msgSystem : styles.msgAssistant
      }`}
    >
      <div className={styles.msgText}>
        {message.role === "user" ? (
          message.content
        ) : (
          <ReactMarkdown components={MARKDOWN_COMPONENTS}>{message.content}</ReactMarkdown>
        )}
      </div>
      <MessageImages agentId={agentId} refs={refs} />
    </div>
  );
});

export default function ChatTab({ active = true }) {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [collapsedSidebars, setCollapsedSidebars] = useState(readSidebarPreferences);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(collapsedSidebars));
    } catch {
      // Panel controls still work when browser storage is unavailable.
    }
  }, [collapsedSidebars]);

  const toggleSidebar = (panel) => {
    setCollapsedSidebars((previous) => ({ ...previous, [panel]: !previous[panel] }));
  };

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
  const [attachErrors, setAttachErrors] = useState([]);
  const [pendingByConv, setPendingByConv] = useState({});
  const [connState, setConnState] = useState("idle");
  const [err, setErr] = useState("");

  const wsRef = useRef(null);
  const rpcId = useRef(1);
  const pendingResolvers = useRef({});
  const scrollRef = useRef(null);
  const visibleScroll = useRef({ messages: null, pending: false, convId: null, top: 0 });
  const fileInputRef = useRef(null);
  // Mirror of pendingAttachments that is current between renders, so limits
  // hold when several pastes land before React re-renders.
  const pendingAttachmentsRef = useRef([]);
  const attachQueue = useRef(Promise.resolve());
  const lastErrorRef = useRef(0);
  // sessionKey → convId (reverse) so gateway events can be routed
  const convBySessionKey = useRef({});
  // Conversations deleted in this tab. A list request that was already in
  // flight, or a late gateway reply, must not bring them back.
  const deletedConvIds = useRef(new Set());
  const deletingConvRef = useRef(new Set());
  const [deletingConvIds, setDeletingConvIds] = useState(() => new Set());
  // Newest list request per agent wins; older responses are discarded.
  const convListSeq = useRef({});
  // Seq of the list request still in flight per agent (unset when idle).
  const convListPending = useRef({});
  // Current values for async handlers that outlive the render they started in.
  const latest = useRef({ convsByAgent: {}, activeConvByAgent: {} });
  useEffect(() => { latest.current = { convsByAgent, activeConvByAgent }; });

  const activeConvId = selectedAgent ? activeConvByAgent[selectedAgent] || null : null;
  const messages = (activeConvId && messagesByConv[activeConvId]) || EMPTY_MESSAGES;
  const conversations = selectedAgent ? (convsByAgent[selectedAgent] || []) : [];
  const isAwaitingAssistant = activeConvId ? Boolean(pendingByConv[activeConvId]) : false;

  const appendMessage = (convId, msg) => {
    if (!convId || deletedConvIds.current.has(convId)) return;
    setMessagesByConv((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), msg],
    }));
  };

  const loadAgents = useCallback(async () => {
    try {
      const r = await api.get("/api/admin/openclaw/console/agents");
      const nextAgents = r.data.agents || [];
      setAgents(nextAgents);
      setSelectedAgent((current) => nextAgents.some((agent) => agent.id === current) ? current : null);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "failed");
    }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // The retained sidebar refreshes only after an explicit agent mutation.
  // Model changes/deletion invalidate sessions bound to the old agent config.
  useEffect(() => {
    const handler = (e) => {
      const agentId = e?.detail?.agentId;
      if (!agentId) return;
      const convs = convsByAgent[agentId] || [];
      if (e.detail.resetSession && convs.length) {
        const idsToClear = new Set(convs.map((c) => c.id));
        for (const id of idsToClear) needsReplayByConv.current[id] = true;
        setSessionKeyByConv((prev) => {
          const next = { ...prev };
          for (const id of idsToClear) delete next[id];
          return next;
        });
        // A model edit affects the next send, but an in-flight reply from the
        // previous session must still reach its conversation while we're away.
        if (e.detail.deleted) {
          for (const k of Object.keys(convBySessionKey.current)) {
            if (idsToClear.has(convBySessionKey.current[k])) {
              delete convBySessionKey.current[k];
            }
          }
        }
      }
      loadAgents();
    };
    window.addEventListener("openclaw:agents-changed", handler);
    return () => window.removeEventListener("openclaw:agents-changed", handler);
  }, [convsByAgent, loadAgents]);

  const loadConversations = useCallback(async (agentId) => {
    if (!agentId) return null;
    const seq = (convListSeq.current[agentId] || 0) + 1;
    convListSeq.current[agentId] = seq;
    convListPending.current[agentId] = seq;
    try {
      const r = await api.get(`${CONV_BASE}?agent_id=${encodeURIComponent(agentId)}`);
      // Superseded by a newer request (e.g. one issued after a delete).
      if (convListSeq.current[agentId] !== seq) return null;
      const convs = withoutDeleted(r.data.conversations, deletedConvIds.current);
      setConvsByAgent((prev) => ({ ...prev, [agentId]: convs }));
      return convs;
    } catch (e) {
      setErr(apiErrorText(e, "대화 목록 로드 실패"));
      return null;
    } finally {
      if (convListPending.current[agentId] === seq) delete convListPending.current[agentId];
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
      // A list request issued before this create does not know the new
      // conversation; applying it would drop it from the sidebar and deselect
      // it. Supersede it with a fresh request.
      if (convListPending.current[agentId]) loadConversations(agentId);
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

  const dropKey = (convId) => (prev) => {
    if (!(convId in prev)) return prev;
    const next = { ...prev };
    delete next[convId];
    return next;
  };

  // Remove every local trace of a conversation the server no longer has.
  const forgetConversation = (agentId, convId) => {
    // From here on, stale list responses and late replies skip this id.
    deletedConvIds.current.add(convId);

    // Best effort: drop the gateway session too so a running reply stops. The
    // relay only accepts keys this connection created; the DB row is already
    // gone, so a failure here must not surface as a failed delete.
    for (const key of sessionKeysForConversation(convBySessionKey.current, convId)) {
      delete convBySessionKey.current[key];
      if (wsRef.current?.readyState === 1) rpc("sessions.delete", { key }).catch(() => {});
    }
    delete needsReplayByConv.current[convId];
    setSessionKeyByConv(dropKey(convId));
    setPendingByConv(dropKey(convId));
    setMessagesByConv(dropKey(convId));

    const remaining = (latest.current.convsByAgent[agentId] || []).filter((c) => c.id !== convId);
    setConvsByAgent((prev) => ({
      ...prev,
      [agentId]: (prev[agentId] || []).filter((c) => c.id !== convId),
    }));
    if (latest.current.activeConvByAgent[agentId] !== convId) return;
    // The open conversation was deleted: fall back to the most recent one
    // rather than leaving a dead selection behind.
    const nextId = resolveActiveConversation(remaining, null);
    setActiveConvByAgent((prev) => {
      if (prev[agentId] !== convId) return prev;
      const next = { ...prev };
      if (nextId) next[agentId] = nextId;
      else delete next[agentId];
      return next;
    });
    if (nextId) loadConversationMessages(nextId);
  };

  const deleteConversation = async (convId) => {
    const agentId = selectedAgent; // the user may switch agents while we wait
    if (!agentId || deletingConvRef.current.has(convId)) return;
    if (!window.confirm("이 대화를 삭제하시겠습니까? (복구 불가)")) return;
    deletingConvRef.current.add(convId);
    setDeletingConvIds(new Set(deletingConvRef.current));
    try {
      try {
        await api.delete(`${CONV_BASE}/${convId}`);
      } catch (e) {
        // Already deleted elsewhere - the goal is reached, just drop it here.
        if (!isAlreadyGone(e)) throw e;
      }
      forgetConversation(agentId, convId);
      setErr("");
    } catch (e) {
      setErr(apiErrorText(e, "대화 삭제 실패"));
    } finally {
      deletingConvRef.current.delete(convId);
      setDeletingConvIds(new Set(deletingConvRef.current));
    }
  };

  // Agent switch: load conversations and open the most recent one. An empty
  // list stays empty - the first send creates the conversation. (Creating one
  // here made a deleted last conversation "come back" on every refresh, and
  // a failed list request spawned a stray one.)
  useEffect(() => {
    if (!selectedAgent) return;
    const agentId = selectedAgent;
    (async () => {
      const convs = await loadConversations(agentId);
      if (!convs) return;
      const current = latest.current.activeConvByAgent[agentId] || null;
      const nextId = resolveActiveConversation(convs, current);
      if (nextId === current) return;
      setActiveConvByAgent((prev) => {
        const next = { ...prev };
        if (nextId) next[agentId] = nextId;
        else delete next[agentId];
        return next;
      });
      if (nextId) await loadConversationMessages(nextId);
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
      setPendingByConv((prev) => ({ ...prev, [targetConv]: false }));
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
    const slice = priorMsgs.slice(-REPLAY_TURN_LIMIT);
    if (slice.length === 0) return "";
    const lines = [];
    let used = 0;
    for (const m of slice) {
      const tag = m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User";
      const body = truncateReplayText(m.content);
      const line = `${tag}: ${body}`;
      if (used + line.length > REPLAY_TOTAL_CHAR_LIMIT) break;
      used += line.length;
      lines.push(line);
    }
    return `[이전 대화 맥락 — 아래 내용을 기억해서 이어받아 주세요]\n${lines.join("\n\n")}\n\n[현재 새 메시지]\n`;
  };

  const selectedAgentObj = agents.find((a) => a.id === selectedAgent) || null;
  const hasPendingImage = pendingAttachments.some((a) => a.kind === "image");
  const visionWarning = hasPendingImage && selectedAgentObj && !isVisionModel(selectedAgentObj.model);

  const commitAttachments = (next) => {
    pendingAttachmentsRef.current = next;
    setPendingAttachments(next);
  };

  // On unmount, free whatever is pending at that moment (not at mount time).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => releasePreviews(pendingAttachmentsRef.current), []);

  const readAttachments = async (files, { pasted }) => {
    const now = new Date();
    const incoming = files.map((file, index) => ({
      file,
      name: pasted ? pastedImageName(file, now, index) : file.name,
    }));
    const { accepted, errors } = planAttachments(pendingAttachmentsRef.current, incoming);
    const next = [];
    for (const { file, name, kind } of accepted) {
      try {
        if (kind === "image") {
          const item = { kind, mimeType: file.type, fileName: name, content: await readFileAsBase64(file), size: file.size };
          if (isDuplicateImage([...pendingAttachmentsRef.current, ...next], item)) {
            errors.push(`${name}: 이미 첨부된 이미지입니다.`);
            continue;
          }
          next.push({ ...item, previewUrl: URL.createObjectURL(file) });
        } else {
          const text = await readFileAsText(file);
          next.push({ kind, mimeType: file.type || "text/plain", fileName: name, text, size: file.size });
        }
      } catch (e) {
        errors.push(`${name}: 파일을 읽지 못했습니다 — ${e?.message || e}`);
      }
    }
    if (next.length) commitAttachments([...pendingAttachmentsRef.current, ...next]);
    setAttachErrors(errors);
  };

  // Batches run one after another, so each validates against what the
  // previous one actually attached.
  const addAttachments = (fileList, options = { pasted: false }) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return attachQueue.current;
    attachQueue.current = attachQueue.current
      .then(() => readAttachments(files, options))
      .catch((e) => setAttachErrors([`첨부 처리 중 오류가 발생했습니다 — ${e?.message || e}`]));
    return attachQueue.current;
  };

  const handlePaste = (e) => {
    const images = extractClipboardImages(e.clipboardData);
    if (images.length === 0) return; // ordinary text paste
    e.preventDefault();
    addAttachments(images, { pasted: true });
  };

  const removeAttachment = (idx) => {
    const current = pendingAttachmentsRef.current;
    releasePreviews(current.filter((_, i) => i === idx));
    commitAttachments(current.filter((_, i) => i !== idx));
    setAttachErrors([]);
  };

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
    // Image-only sends get a default instruction so the message is never empty.
    const { prompt, rawUserText } = buildUserText(draft, pendingAttachments);

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
    const displayContent = [prompt, chipSummary].filter(Boolean).join("\n\n");

    appendMessage(convId, { role: "user", content: displayContent || "(첨부 전송)" });
    setPendingByConv((prev) => ({ ...prev, [convId]: true }));
    setDraft("");
    releasePreviews(pendingAttachmentsRef.current);
    commitAttachments([]);
    setAttachErrors([]);
    try {
      const key = await ensureSession(agentId, convId);
      if (deletedConvIds.current.has(convId)) {
        // Deleted while the session was being opened: don't send into it.
        delete convBySessionKey.current[key];
        setSessionKeyByConv(dropKey(convId));
        rpc("sessions.delete", { key }).catch(() => {});
        return;
      }
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
      setPendingByConv((prev) => ({ ...prev, [convId]: false }));
      setErr(typeof e === "string" ? e : (e?.message || "send failed"));
    }
  };

  useLayoutEffect(() => {
    if (!active || !scrollRef.current) return;
    const node = scrollRef.current;
    const previous = visibleScroll.current;
    const changed = previous.messages !== messages || previous.pending !== isAwaitingAssistant || previous.convId !== activeConvId;
    node.scrollTop = changed ? node.scrollHeight : previous.top;
    visibleScroll.current = { messages, pending: isAwaitingAssistant, convId: activeConvId, top: node.scrollTop };
  }, [active, messages, isAwaitingAssistant, activeConvId]);

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className={styles.chatWorkspace}>
      <div className={styles.toolbar}>
        {connState === "idle" || connState === "closed" ? (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={connect}>연결</button>
        ) : (
          <span className={styles.infoMsg}>● {connState === "open" ? "연결됨" : "연결 중…"}</span>
        )}
        {err && <span className={styles.errMsg}>{err}</span>}
      </div>

      <div className={`${styles.chatLayout} ${collapsedSidebars.agents ? styles.agentsCollapsed : ""} ${collapsedSidebars.conversations ? styles.conversationsCollapsed : ""}`}>
        {/* Column 1: Agents */}
        <ChatSidebar
          id="openclaw-chat-agents"
          title="에이전트"
          className={styles.chatSidebar}
          collapsed={collapsedSidebars.agents}
          onToggle={() => toggleSidebar("agents")}
        >
          {agents.length === 0 ? (
            <div className={styles.empty}>에이전트 없음</div>
          ) : agents.map((a) => {
            const emoji = a.emoji || "";
            const initial = (a.displayName || a.id || "?").trim().charAt(0).toUpperCase();
            const role = (a.role || "").trim();
            return (
              <div
                key={a.id}
                className={`${styles.agentListItem} ${selectedAgent === a.id ? styles.agentListItemActive : ""}`}
                onClick={() => setSelectedAgent(a.id)}
                title={role || a.id}
              >
                <div className={styles.agentThumb}>
                  {emoji ? emoji : <span className={styles.agentThumbFallback}>{initial}</span>}
                </div>
                <div className={styles.agentInfo}>
                  <div className={styles.agentName}>{a.displayName || a.id}</div>
                  {role ? (
                    <div className={styles.agentRole}>{role}</div>
                  ) : (
                    <div className={styles.agentRoleEmpty}>설명 없음</div>
                  )}
                  <div className={styles.agentMeta}>
                    <span className={styles.agentMetaId}>{a.id}</span>
                    <span className={styles.agentMetaModel} title={a.model}>{a.model}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </ChatSidebar>

        {/* Column 2: Conversations for selected agent */}
        <ChatSidebar
          id="openclaw-chat-conversations"
          title="대화 목록"
          className={styles.convSidebar}
          collapsed={collapsedSidebars.conversations}
          onToggle={() => toggleSidebar("conversations")}
        >
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
                        title={deletingConvIds.has(c.id) ? "삭제 중…" : "삭제"}
                        aria-label="대화 삭제"
                        disabled={deletingConvIds.has(c.id)}
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
        </ChatSidebar>

        {/* Column 3: Chat main */}
        <div className={styles.chatMain}>
          <div
            ref={scrollRef}
            className={styles.chatMessages}
            onScroll={(event) => {
              if (active && event.currentTarget.clientHeight > 0) visibleScroll.current.top = event.currentTarget.scrollTop;
            }}
          >
            {messages.length === 0 ? (
              <div className={styles.empty}>
                {selectedAgent ? "메시지를 입력해 대화를 시작하세요." : "좌측에서 에이전트를 선택하세요."}
              </div>
            ) : null}
            {messages.map((m, i) => (
              <MessageBubble key={i} message={m} agentId={selectedAgent} />
            ))}
            {isAwaitingAssistant && (
              <div className={`${styles.msg} ${styles.msgAssistant} ${styles.msgPending}`}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </div>
            )}
          </div>
          {pendingAttachments.length > 0 && (
            <div className={styles.attachStrip}>
              {pendingAttachments.map((a, i) => (
                <div
                  key={a.previewUrl || `${a.fileName}:${i}`}
                  className={`${styles.attachChip} ${a.previewUrl ? styles.attachChipImage : ""}`}
                  title={`${a.fileName} · ${(a.size / 1024).toFixed(1)} KB`}
                >
                  {a.previewUrl ? (
                    <img className={styles.attachThumb} src={a.previewUrl} alt={`${a.fileName} 미리보기`} />
                  ) : (
                    <span className={styles.attachIcon}>{a.kind === "image" ? "🖼" : "📄"}</span>
                  )}
                  <span className={styles.attachName}>{a.fileName}</span>
                  <button
                    type="button"
                    className={styles.attachRemove}
                    onClick={() => removeAttachment(i)}
                    title="제거"
                    aria-label={`${a.fileName} 첨부 제거`}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {attachErrors.length > 0 && (
            <div className={styles.attachError} role="alert">
              <ul className={styles.attachErrorList}>
                {attachErrors.map((message) => <li key={message}>{message}</li>)}
              </ul>
              <button
                type="button"
                className={styles.attachRemove}
                onClick={() => setAttachErrors([])}
                title="닫기"
                aria-label="첨부 오류 닫기"
              >×</button>
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
              onPaste={handlePaste}
              placeholder={
                !selectedAgent ? "좌측에서 에이전트를 선택하세요"
                : !activeConvId ? "대화를 선택하거나 새로 만드세요"
                : "메시지를 입력하세요 (Enter=전송, Shift+Enter=줄바꿈, Ctrl+V=이미지 붙여넣기)"
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
