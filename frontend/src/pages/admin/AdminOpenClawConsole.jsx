import { useEffect, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import styles from "./AdminOpenClawConsole.module.css";

const AgentsTab = lazy(() => import("./openclaw/AgentsTab"));
const PluginsTab = lazy(() => import("./openclaw/PluginsTab"));
const ConfigTab = lazy(() => import("./openclaw/ConfigTab"));
const ChatTab = lazy(() => import("./openclaw/ChatTab"));
const LogsTab = lazy(() => import("./openclaw/LogsTab"));
const TokenTab = lazy(() => import("./openclaw/TokenTab"));

const TABS = [
  { key: "agents", label: "에이전트", Comp: AgentsTab },
  { key: "plugins", label: "플러그인", Comp: PluginsTab },
  { key: "config", label: "설정", Comp: ConfigTab },
  { key: "token", label: "토큰", Comp: TokenTab },
  { key: "chat", label: "채팅", Comp: ChatTab },
  { key: "logs", label: "로그", Comp: LogsTab },
];

function ConsoleTab({ tab, active }) {
  const [opened, setOpened] = useState(active);
  if (active && !opened) setOpened(true);
  if (!opened) return null;

  const Component = tab.Comp;
  return (
    <section role="tabpanel" aria-label={tab.label} hidden={!active}>
      <Suspense fallback={<div className={styles.loading}>로딩 중…</div>}>
        <Component active={active} />
      </Suspense>
    </section>
  );
}

export default function AdminOpenClawConsole({ tab, active = true }) {
  const navigate = useNavigate();
  const activeKey = TABS.find((t) => t.key === tab)?.key || "agents";

  const [health, setHealth] = useState(null);
  const [healthErr, setHealthErr] = useState("");

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await api.get("/api/admin/openclaw/console/health");
        if (alive) { setHealth(r.data); setHealthErr(""); }
      } catch (e) {
        if (alive) setHealthErr(e?.response?.data?.detail || e.message || "health check failed");
      }
    };
    poll();
    const t = setInterval(poll, 10_000);
    return () => { alive = false; clearInterval(t); };
  }, [active]);

  return (
    <div className={`${styles.page} ${activeKey === "chat" ? styles.chatPage : ""}`}>
      <div className={styles.pageHeader}>
        <span className={styles.overline}>OpenClaw Console</span>
        <h1 className={styles.title}>OpenClaw 관리 콘솔</h1>
        <p className={styles.desc}>
          twinverse-ai (192.168.219.117) LAN OpenClaw 인스턴스를 관리합니다. 에이전트 CRUD · 플러그인 · 설정 · 채팅 · 로그.
          게이트웨이: <code>wss://openclaw.twinverse.org</code> · 컨테이너: <code>openclaw</code>.
        </p>
        <div className={styles.healthRow}>
          {healthErr ? (
            <span className={styles.healthDown}>● Gateway 응답 없음: {healthErr.slice(0, 120)}</span>
          ) : health ? (
            <>
              <span className={health.ok ? styles.healthUp : styles.healthDown}>
                ● Gateway {health.ok ? "OK" : health.status === "unreachable" ? "서버 연결 불가" : "down"}
                {health.version ? ` · v${health.version}` : ""}
                {!health.ok && health.error ? ` — ${health.error}` : ""}
              </span>
              {!health.ok && health.hint && <p className={styles.healthHint}>{health.hint}</p>}
            </>
          ) : (
            <span className={styles.healthPending}>● 상태 확인 중…</span>
          )}
        </div>
      </div>

      <div className={styles.warningBar}>
        ⚠ 에이전트 생성·일부 플러그인 변경은 게이트웨이 재시작을 유발할 수 있습니다. 재시작 시 페어링된 기기의 토큰이 로테이트됩니다.
      </div>

      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tab} ${t.key === activeKey ? styles.tabActive : ""}`}
            onClick={() => navigate(t.key === "agents" ? "/admin/openclaw-console" : `/admin/openclaw-console/${t.key}`)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={styles.tabBody}>
        {TABS.map((tab) => (
          <ConsoleTab key={tab.key} tab={tab} active={active && activeKey === tab.key} />
        ))}
      </div>
    </div>
  );
}
