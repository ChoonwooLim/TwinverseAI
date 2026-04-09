import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import ps2api from "../../services/ps2api";
import styles from "./DeskLaunch.module.css";

const TVDESK_PS2_URL =
  import.meta.env.VITE_TVDESK_URL || "http://localhost:8080";
const HEARTBEAT_INTERVAL = 30000; // 30s
const STATUS_POLL_INTERVAL = 3000; // 3s

const REQUIREMENTS = [
  { label: "브라우저", value: "Chrome 90+ / Edge 90+ / Firefox 100+" },
  { label: "네트워크", value: "최소 10Mbps (권장 50Mbps+)" },
  { label: "해상도", value: "1280×720 이상 (권장 1920×1080)" },
  { label: "오디오", value: "헤드셋 권장 (공간 음향 지원)" },
  { label: "GPU", value: "서버 렌더링 (클라이언트 GPU 불필요)" },
];

const FEATURES_PREVIEW = [
  {
    title: "3D 가상 오피스",
    desc: "Unreal Engine 5로 렌더링된 고품질 3D 오피스 공간에서 동료들과 함께 일하세요.",
    icon: "🏢",
  },
  {
    title: "MetaHuman 아바타",
    desc: "포토리얼리스틱 3D 캐릭터로 자신만의 아바타를 커스터마이징하세요.",
    icon: "👤",
  },
  {
    title: "공간 음성 채팅",
    desc: "3D 공간에서 거리에 따라 자연스럽게 변하는 음성으로 대화하세요.",
    icon: "🎧",
  },
  {
    title: "AI 어시스턴트",
    desc: "AI NPC에게 업무를 위임하고 회의실에서 AI와 브레인스토밍하세요.",
    icon: "🤖",
  },
];

export default function DeskLaunch() {
  const [status, setStatus] = useState("idle"); // idle | spawning | starting | running | error
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [session, setSession] = useState(null); // { session_id, player_url, status }
  const [spawnError, setSpawnError] = useState(null);
  const [health, setHealth] = useState(null); // { available, active_instances, max_instances }
  const streamRef = useRef(null);
  const heartbeatRef = useRef(null);
  const pollRef = useRef(null);
  const isLoggedIn = !!localStorage.getItem("token");

  // Check spawner health on mount (calls GPU server directly)
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await ps2api.get("/api/ps2/health");
        setHealth(res.data);
      } catch { /* spawner unavailable */ }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check if user already has an active session
  useEffect(() => {
    if (!isLoggedIn) return;
    const checkExisting = async () => {
      try {
        const res = await ps2api.get("/api/ps2/sessions");
        if (res.data.length > 0) {
          const s = res.data[0];
          setSession(s);
          setStatus(s.status === "running" ? "running" : "starting");
          if (s.status === "starting") startPolling(s.session_id);
          if (s.status === "running") startHeartbeat(s.session_id);
        }
      } catch { /* not logged in or no sessions */ }
    };
    checkExisting();
  }, [isLoggedIn]);

  const startPolling = useCallback((sessionId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await ps2api.get(`/api/ps2/status/${sessionId}`);
        setSession(res.data);
        if (res.data.status === "running") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStatus("running");
          startHeartbeat(sessionId);
        } else if (res.data.status === "error" || res.data.status === "stopped") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setStatus("error");
          setSpawnError(res.data.error_message || "Session ended");
        }
      } catch {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, STATUS_POLL_INTERVAL);
  }, []);

  const startHeartbeat = useCallback((sessionId) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      try {
        await ps2api.post(`/api/ps2/heartbeat/${sessionId}`);
      } catch { /* session may have been terminated */ }
    }, HEARTBEAT_INTERVAL);
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleSpawn = async () => {
    setStatus("spawning");
    setSpawnError(null);
    try {
      const res = await ps2api.post("/api/ps2/spawn");
      setSession(res.data);
      setStatus("starting");
      startPolling(res.data.session_id);
    } catch (err) {
      setStatus("error");
      setSpawnError(err.response?.data?.detail || "Failed to start session");
    }
  };

  const handleTerminate = async () => {
    if (!session) return;
    try {
      await ps2api.post(`/api/ps2/terminate/${session.session_id}`);
    } catch { /* ignore */ }
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    setSession(null);
    setStatus("idle");
    setSpawnError(null);
  };

  const toggleFullscreen = () => {
    if (!streamRef.current) return;
    if (!document.fullscreenElement) {
      streamRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>
            {status === "running" ? "Live" : "Pixel Streaming 2"}
          </span>
          <h1 className={styles.title}>TwinverseDesk</h1>
          <p className={styles.tagline}>
            차세대 3D 가상 오피스 플랫폼
          </p>
          <p className={styles.heroDesc}>
            Unreal Engine 5 Pixel Streaming 기반의 AAA급 3D 가상 오피스.<br/>
            웹 브라우저만으로 몰입감 있는 업무 환경을 경험하세요.
          </p>
          <div className={styles.heroCta}>
            {isLoggedIn && status === "idle" && (
              <button onClick={handleSpawn} className={styles.spawnBtn}>
                Start My Session
              </button>
            )}
            {status === "spawning" && (
              <button className={styles.spawnBtn} disabled>
                Starting...
              </button>
            )}
            {status === "starting" && (
              <div className={styles.statusBadge}>
                <span className={`${styles.statusDot} ${styles.statusChecking}`} />
                UE5 인스턴스 시작 중...
              </div>
            )}
            {status === "running" && (
              <button onClick={handleTerminate} className={styles.terminateBtn}>
                End Session
              </button>
            )}
            {status === "error" && (
              <button onClick={handleSpawn} className={styles.spawnBtn}>
                Retry
              </button>
            )}
            {!isLoggedIn && (
              <Link to="/login" className={styles.spawnBtn}>
                로그인 후 시작
              </Link>
            )}
            <Link to="/twinversedesk/plan" className={styles.planLink}>
              개발계획 보기 →
            </Link>
          </div>
          {spawnError && (
            <p className={styles.spawnError}>{spawnError}</p>
          )}
          {health && (
            <p className={styles.healthInfo}>
              인스턴스: {health.active_instances}/{health.max_instances}
              {!health.available && " (최대 용량)"}
            </p>
          )}
        </div>
      </header>

      {/* PS2 Stream Viewer */}
      <section className={styles.streamSection} ref={streamRef}>
        <div className={styles.streamContainer}>
          {status === "running" && session ? (
            <iframe
              src={session.player_url}
              className={styles.streamFrame}
              allow="autoplay; fullscreen; microphone; gamepad"
              title="TwinverseDesk Pixel Streaming"
            />
          ) : (
            <div className={styles.streamPlaceholder}>
              <div className={styles.placeholderIcon}>
                {(status === "spawning" || status === "starting") ? (
                  <div className={styles.spinner} />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                )}
              </div>
              <p className={styles.placeholderText}>
                {status === "spawning"
                  ? "세션 생성 중..."
                  : status === "starting"
                    ? "UE5 인스턴스 시작 중... (최대 30초)"
                    : status === "error"
                      ? "세션 오류 발생"
                      : isLoggedIn
                        ? "Start My Session 버튼으로 독립 세션을 시작하세요"
                        : "로그인 후 독립 세션을 시작할 수 있습니다"}
              </p>
              {status === "idle" && (
                <p className={styles.placeholderHint}>
                  각 유저별 독립된 UE5 인스턴스가 생성됩니다.
                  <br />
                  Wilbur 시그널링 서버가 실행 중이어야 합니다.
                </p>
              )}
            </div>
          )}
        </div>
        <div className={styles.streamControls}>
          <div className={styles.streamInfo}>
            <span className={styles.streamInfoLabel}>Player</span>
            <span className={styles.streamInfoValue}>{session?.player_url || TVDESK_PS2_URL}</span>
            <span className={styles.streamInfoDivider} />
            <span className={styles.streamInfoLabel}>Session</span>
            <span className={styles.streamInfoValue}>{session?.session_id || "none"}</span>
          </div>
          <div className={styles.controlBtns}>
            {status === "running" && session && (
              <>
                <button onClick={toggleFullscreen} className={styles.controlBtn} title={isFullscreen ? "전체화면 종료" : "전체화면"}>
                  {isFullscreen ? "Exit FS" : "Fullscreen"}
                </button>
                <button onClick={() => window.open(session.player_url, "_blank", "noopener")} className={styles.controlBtn} title="새 탭에서 열기">
                  New Tab
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* 기능 프리뷰 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>주요 기능</h2>
        <div className={styles.featureGrid}>
          {FEATURES_PREVIEW.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3 className={styles.featureName}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 시스템 요구사항 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>시스템 요구사항</h2>
        <p className={styles.sectionDesc}>
          TwinverseDesk는 Pixel Streaming 기술로 서버에서 렌더링하므로 고사양 PC가 필요하지 않습니다.
        </p>
        <div className={styles.reqGrid}>
          {REQUIREMENTS.map((r) => (
            <div key={r.label} className={styles.reqRow}>
              <span className={styles.reqLabel}>{r.label}</span>
              <span className={styles.reqValue}>{r.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 개발 진행 현황 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>개발 진행 현황</h2>
        <div className={styles.progressGrid}>
          <div className={styles.progressItem}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "5%" }} />
            </div>
            <div className={styles.progressMeta}>
              <span>Phase 1: 코어 엔진</span>
              <span>5%</span>
            </div>
          </div>
          <div className={styles.progressItem}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "0%" }} />
            </div>
            <div className={styles.progressMeta}>
              <span>Phase 2: 캐릭터 시스템</span>
              <span>0%</span>
            </div>
          </div>
          <div className={styles.progressItem}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "0%" }} />
            </div>
            <div className={styles.progressMeta}>
              <span>Phase 3: 멀티플레이어</span>
              <span>0%</span>
            </div>
          </div>
          <div className={styles.progressItem}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "0%" }} />
            </div>
            <div className={styles.progressMeta}>
              <span>Phase 4: AI 에이전트</span>
              <span>0%</span>
            </div>
          </div>
          <div className={styles.progressItem}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: "0%" }} />
            </div>
            <div className={styles.progressMeta}>
              <span>Phase 5: 맵 에디터</span>
              <span>0%</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>TwinverseDesk에 관심이 있으신가요?</h2>
        <p className={styles.ctaDesc}>
          개발 진행 상황과 기술 아키텍처를 분석 보고서와 개발계획에서 확인하세요.
        </p>
        <div className={styles.ctaLinks}>
          <Link to="/twinversedesk/analysis" className={styles.ctaBtn}>분석 보고서</Link>
          <Link to="/twinversedesk/plan" className={styles.ctaBtnOutline}>개발계획</Link>
        </div>
      </section>
    </div>
  );
}
