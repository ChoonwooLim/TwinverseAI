import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import ps2api, { officeApi } from "../../services/ps2api";
import styles from "./DeskLaunch.module.css";

const TVDESK_PS2_URL =
  import.meta.env.VITE_TVDESK_URL || "http://localhost:8080";
const HEARTBEAT_INTERVAL = 30000; // 30s
const STATUS_POLL_INTERVAL = 3000; // 3s

const LEVELS = [
  {
    id: "office_main",
    name: "3D Virtual Office",
    map: "/Game/Maps/Office/OfficeMain",
    desc: "여러 사람과 AI가 함께하는 공유 오피스를 개발하고 있습니다.",
    gradient: "linear-gradient(135deg, #00d2ff 0%, #3a47d5 100%)",
    icon: "🏢",
    isOffice: true,
    officeId: "main_office",
    // Track A: UE5 5.7.4 Listen Server + PixelStreaming2 멀티 스트리머 템플릿 제작 중
    disabled: true,
    statusLabel: "개발중",
    statusNote: "멀티유저·AI NPC·공간 음성 통합은 아직 공개되지 않았습니다.",
  },
  {
    id: "pcg_modern",
    name: "Modern Office (Solo)",
    map: "/Game/PCG/PCG_Study_Modern",
    desc: "모던 오피스 장면을 살펴보는 개인 세션 · 스트리밍 서버 준비 필요",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    icon: "🔬",
  },
  {
    id: "newyork",
    name: "New York City (Solo)",
    map: "/Game/Maps/NewYork",
    desc: "도시 장면을 살펴보는 개인 세션 · 스트리밍 서버 준비 필요",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    icon: "🌆",
  },
];

const REQUIREMENTS = [
  { label: "계정", value: "TwinverseAI 로그인 필요 · 만료 시 다시 로그인" },
  { label: "브라우저", value: "WebRTC를 지원하는 최신 브라우저 · 키보드·마우스 사용 환경 권장" },
  { label: "네트워크", value: "안정적인 연결 필요 · 회사망·모바일망에서 영상 연결이 제한될 수 있음" },
  { label: "플레이어", value: "별도 창/탭으로 열림 · 팝업이 차단되면 이 사이트에 허용" },
  { label: "영상 처리", value: "3D 렌더링은 서버에서 수행 · 기기에는 영상 재생 능력이 필요" },
  { label: "서버 조건", value: "UE5 실행 환경·스트리밍 연결·여유 인스턴스가 모두 필요" },
];

const FEATURES_PREVIEW = [
  {
    title: "현재 · Solo 환경 선택",
    desc: "Modern Office와 New York City를 선택해 개인 세션을 요청합니다. 실제 콘텐츠는 서버에 준비된 빌드에 따라 제공됩니다.",
    icon: "🏢",
  },
  {
    title: "현재 · 세션 관리",
    desc: "생성·시작·실행 상태를 확인하고, 별도 플레이어를 열거나 세션을 종료할 수 있습니다.",
    icon: "👤",
  },
  {
    title: "개발 중 · 공유 오피스",
    desc: "여러 사용자의 아바타, 채팅과 공간 음성을 연결하는 경험을 준비합니다. 공유 오피스는 현재 선택할 수 없습니다.",
    icon: "🎧",
  },
  {
    title: "계획 · 공간 내 AI 업무",
    desc: "NPC 대화·에이전트 연결 기반을 공간 속 업무로 확장합니다. 관리자 AI 도구와 공개 3D 공간의 제공 범위는 구분됩니다.",
    icon: "🤖",
  },
];

export default function DeskLaunch() {
  const [status, setStatus] = useState("idle"); // idle | spawning | starting | running | error
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [session, setSession] = useState(null); // { session_id, player_url, status }
  // 비활성화되지 않은 첫 레벨을 기본 선택 (disabled 레벨은 기본값으로 사용 금지)
  const [selectedLevel, setSelectedLevel] = useState(
    () => LEVELS.find((l) => !l.disabled) || LEVELS[0]
  );
  const [spawnError, setSpawnError] = useState(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [health, setHealth] = useState(null); // { available, active_instances, max_instances }
  const [healthError, setHealthError] = useState(null); // PS2 API unreachable — visible banner
  const streamRef = useRef(null);
  const heartbeatRef = useRef(null);
  const pollRef = useRef(null);
  const isLoggedIn = !!localStorage.getItem("token");

  // Check spawner health on mount (calls GPU server directly).
  // Failure is shown as a visible banner instead of being silently swallowed —
  // the 2026-04-10 incident hid a backend crash behind a blank "spawnError".
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await ps2api.get("/api/ps2/health");
        setHealth(res.data);
        setHealthError(null);
      } catch (err) {
        const status = err.response?.status;
        if (status === 401) {
          // GPU server auth mismatch — show banner instead of logging out.
          // The ps2api interceptor no longer wipes credentials for health checks.
          setHealth(null);
          setHealthError("스트리밍 서버 인증을 확인하지 못했습니다. 관리자에게 문의해주세요.");
          return;
        }
        setHealth(null);
        setHealthError(
          status
            ? `GPU 서버 응답 오류 (HTTP ${status})`
            : "스트리밍 서버에 연결하지 못했습니다. 잠시 후 다시 확인해주세요."
        );
      }
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
    // 개발중 레벨은 실행 차단
    if (selectedLevel.disabled) {
      setStatus("error");
      setSpawnError(
        `"${selectedLevel.name}" 은(는) 아직 개발중입니다. ${selectedLevel.statusNote || ""}`
      );
      return;
    }
    setStatus("spawning");
    setSpawnError(null);
    setAuthExpired(false);
    try {
      let res;
      if (selectedLevel.isOffice) {
        // Office multiplayer mode — joins shared dedicated server
        res = await officeApi.join(selectedLevel.officeId, selectedLevel.map);
      } else {
        // Solo mode — spawns independent instance
        res = await ps2api.post("/api/ps2/spawn", { map: selectedLevel.map });
      }
      setSession(res.data);
      setStatus("starting");
      startPolling(res.data.session_id);
    } catch (err) {
      setStatus("error");
      if (err.response?.status === 401) {
        setAuthExpired(true);
        setSpawnError("세션이 만료되었습니다. 다시 로그인해주세요.");
      } else {
        setSpawnError(err.response?.data?.detail || "Failed to start session");
      }
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
            브라우저로 여는 UE5 작업 공간
          </p>
          <p className={styles.heroDesc}>
            Solo 환경을 선택하고 로그인 후 개인 세션을 시작하세요.<br/>
            서버가 준비되면 별도 플레이어 창에서 3D 공간을 체험할 수 있습니다.
          </p>
          <div className={styles.heroCta}>
            {isLoggedIn && status === "idle" && (
              <button onClick={handleSpawn} className={styles.spawnBtn}>
                내 세션 시작
              </button>
            )}
            {status === "spawning" && (
              <button className={styles.spawnBtn} disabled>
                세션 생성 중...
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
                세션 종료
              </button>
            )}
            {status === "error" && !authExpired && (
              <button onClick={handleSpawn} className={styles.spawnBtn}>
                다시 시도
              </button>
            )}
            {status === "error" && authExpired && (
              <Link to="/login" className={styles.spawnBtn}>
                다시 로그인
              </Link>
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

      {/* GPU Server offline banner — visible, not swallowed */}
      {healthError && (
        <div className={styles.offlineBanner} role="alert">
          <span className={styles.offlineBannerIcon}>⚠</span>
          <div className={styles.offlineBannerBody}>
            <strong className={styles.offlineBannerTitle}>스트리밍 서버 연결 확인 필요</strong>
            <span className={styles.offlineBannerMsg}>{healthError}</span>
            <span className={styles.offlineBannerHint}>
              세션 시작은 서버가 복구된 후 가능합니다. 서버 관리자에게 문의하거나 잠시 후 새로고침 해주세요.
            </span>
          </div>
        </div>
      )}

      {/* Level Selector */}
      {status !== "running" && (
        <section className={styles.levelSection}>
          <h2 className={styles.levelSectionTitle}>체험할 환경 선택</h2>
          <div className={styles.levelGrid}>
            {LEVELS.map((level) => {
              const isDisabled = !!level.disabled;
              const isActive = selectedLevel.id === level.id;
              return (
                <button
                  key={level.id}
                  className={`${styles.levelCard} ${isActive ? styles.levelCardActive : ""} ${isDisabled ? styles.levelCardDisabled : ""}`}
                  onClick={() => {
                    if (isDisabled) return;
                    setSelectedLevel(level);
                  }}
                  disabled={isDisabled}
                  aria-disabled={isDisabled}
                  title={isDisabled ? `${level.statusLabel || "개발중"} — ${level.statusNote || "실행 불가"}` : undefined}
                >
                  <div className={styles.levelThumb} style={{ background: level.gradient }}>
                    <span className={styles.levelIcon}>{level.icon}</span>
                    {isDisabled && (
                      <div className={styles.levelDisabledOverlay}>
                        <span className={styles.levelStatusBadge}>
                          {level.statusLabel || "개발중"}
                        </span>
                        <span className={styles.levelStatusSub}>실행 불가</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.levelInfo}>
                    <h3 className={styles.levelName}>
                      {level.name}
                      {level.isOffice && <span className={styles.multiplayerBadge}>공유 공간 · 예정</span>}
                    </h3>
                    <p className={styles.levelDesc}>
                      {level.desc}
                      {isDisabled && level.statusNote && (
                        <>
                          <br />
                          <span className={styles.levelStatusNote}>⚠ {level.statusNote}</span>
                        </>
                      )}
                    </p>
                  </div>
                  {isActive && !isDisabled && (
                    <div className={styles.levelCheck}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* PS2 Stream Viewer */}
      <section className={styles.streamSection} ref={streamRef}>
        <div className={styles.streamContainer}>
          {status === "running" && session ? (
            <>
              <div className={styles.streamLaunched}>
                <div className={styles.launchedIcon}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none" />
                  </svg>
                </div>
                <h3 className={styles.launchedTitle}>세션이 준비되었습니다</h3>
                <p className={styles.launchedDesc}>
                  아래 버튼으로 플레이어를 여세요. 영상이 연결되면 공간을 조작할 수 있습니다.
                </p>
                <button
                  onClick={() => window.open(session.player_url, "TwinverseDesk", "width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no")}
                  className={styles.openStreamBtn}
                >
                  스트리밍 열기
                </button>
              </div>
            </>
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
                    ? "UE5 인스턴스 시작 중... 서버 상태에 따라 시간이 걸릴 수 있습니다"
                    : status === "error"
                      ? "세션 오류 발생"
                      : isLoggedIn
                        ? "내 세션 시작 버튼으로 개인 세션을 요청하세요"
                        : "로그인 후 독립 세션을 시작할 수 있습니다"}
              </p>
              {status === "idle" && (
                <p className={styles.placeholderHint}>
                  Solo 환경은 사용자별 UE5 세션을 요청합니다.
                  <br />
                  스트리밍 서버가 실행 중이고 여유 자원이 있어야 접속할 수 있습니다.
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
        <h2 className={styles.sectionTitle}>현재 체험과 다음 단계</h2>
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
        <h2 className={styles.sectionTitle}>접속 전 준비사항</h2>
        <p className={styles.sectionDesc}>
          UE5를 기기에 설치하지 않고 브라우저로 접속합니다. 화질과 반응 속도는 서버·장면·기기·네트워크에 따라 달라집니다.
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

      {/* 이용 순서 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>처음 접속하는 방법</h2>
        <div className={styles.reqGrid}>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>1 · 선택</span>
            <span className={styles.reqValue}>로그인 후 활성화된 Solo 환경을 선택하고 내 세션 시작을 누르세요.</span>
          </div>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>2 · 연결</span>
            <span className={styles.reqValue}>세션 준비 후 스트리밍 열기로 플레이어를 여세요. 창이 보이지 않으면 팝업 차단을 확인하세요.</span>
          </div>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>3 · 체험</span>
            <span className={styles.reqValue}>영상이 나타나면 플레이어 화면을 클릭하고 장면의 조작 안내를 따르세요. 세션을 유지하려면 이 페이지도 열어두세요.</span>
          </div>
          <div className={styles.reqRow}>
            <span className={styles.reqLabel}>4 · 종료</span>
            <span className={styles.reqValue}>체험을 마친 뒤 이 페이지의 세션 종료를 눌러 사용 중인 서버 자원을 반환하세요.</span>
          </div>
        </div>
        <p className={styles.sectionDesc}>
          서버 오류나 용량 부족이 표시되면 잠시 후 다시 시도하세요. 로그인 만료는 다시 로그인하면 됩니다.
          세션은 준비됐지만 영상이 없다면 네트워크 상태를 확인하고 관리자에게 연결 문제를 알려주세요.
        </p>
        <p className={styles.sectionDesc}>
          접속 방식은 Epic Games의{" "}
          <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-pixel-streaming-in-unreal-engine" target="_blank" rel="noopener noreferrer">Pixel Streaming 개요</a>와{" "}
          <a href="https://dev.epicgames.com/documentation/unreal-engine/hosting-and-networking-guide-for-pixel-streaming-in-unreal-engine" target="_blank" rel="noopener noreferrer">네트워크 안내</a>에서 확인할 수 있습니다.
        </p>
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
