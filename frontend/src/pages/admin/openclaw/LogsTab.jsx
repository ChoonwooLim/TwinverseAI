import { useEffect, useRef, useState, useCallback } from "react";
import styles from "../AdminOpenClawConsole.module.css";

export default function LogsTab() {
  const [lines, setLines] = useState([]);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const [connState, setConnState] = useState("idle");
  const [err, setErr] = useState("");
  const wsRef = useRef(null);
  const bufferRef = useRef([]);
  const scrollRef = useRef(null);
  const autoScrollRef = useRef(true);

  const wsUrl = () => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/admin/openclaw/console/logs`;
  };

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
      if (msg.op === "log.ready") { setConnState("open"); return; }
      if (msg.op === "auth.error" || msg.op === "error") { setErr(msg.message || msg.code); return; }
      if (msg.op === "log.line") {
        bufferRef.current.push({ ts: Date.now(), stream: msg.stream || "stdout", line: msg.line || "" });
        if (bufferRef.current.length > 2000) bufferRef.current = bufferRef.current.slice(-2000);
      }
    };

    ws.onclose = () => { setConnState("closed"); wsRef.current = null; };
    ws.onerror = () => { setErr("WebSocket 오류"); };
  }, []);

  // flush buffered lines periodically (30fps-ish)
  useEffect(() => {
    const t = setInterval(() => {
      if (paused || bufferRef.current.length === 0) return;
      setLines((prev) => {
        const merged = [...prev, ...bufferRef.current];
        bufferRef.current = [];
        return merged.length > 2000 ? merged.slice(-2000) : merged;
      });
    }, 250);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    const id = setTimeout(() => connect(), 0);
    return () => {
      clearTimeout(id);
      try { wsRef.current?.close(); } catch {/* ignore */}
      wsRef.current = null;
    };
  }, [connect]);

  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const onScroll = () => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    autoScrollRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 50;
  };

  const clear = () => { setLines([]); bufferRef.current = []; };

  const download = () => {
    const text = lines.map((l) => `[${new Date(l.ts).toISOString()}] ${l.stream === "stderr" ? "ERR " : ""}${l.line}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openclaw-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const filtered = filter
    ? lines.filter((l) => l.line.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  return (
    <div>
      <div className={styles.toolbar}>
        <span className={connState === "open" ? styles.okMsg : connState === "closed" ? styles.errMsg : styles.infoMsg}>
          ● {connState === "open" ? "연결됨" : connState === "connecting" ? "연결 중…" : connState === "closed" ? "연결 끊김" : "대기"}
        </span>
        <input
          className={styles.input}
          placeholder="필터 (대소문자 무시)"
          style={{ flex: 1, maxWidth: "320px" }}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className={styles.btn} onClick={() => setPaused((p) => !p)}>
          {paused ? "재개" : "일시정지"}
        </button>
        <button className={styles.btn} onClick={clear}>지우기</button>
        <button className={styles.btn} onClick={download} disabled={lines.length === 0}>다운로드</button>
        {connState === "closed" && (
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={connect}>재연결</button>
        )}
        {err && <span className={styles.errMsg}>{err}</span>}
        <span style={{ color: "#888", fontSize: "0.78rem", marginLeft: "auto" }}>
          {filtered.length} / {lines.length} 줄 (최대 2000)
        </span>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className={styles.logContainer}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>로그 대기 중…</div>
        ) : filtered.map((l, i) => (
          <div
            key={i}
            className={`${styles.logLine} ${l.stream === "stderr" ? styles.logStderr : styles.logStdout}`}
          >
            {l.line}
          </div>
        ))}
      </div>
    </div>
  );
}
