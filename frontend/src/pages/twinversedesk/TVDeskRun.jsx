import { useState, useEffect, useRef } from "react";
import styles from "./TVDeskRun.module.css";

const TVDESK_PS2_URL =
  import.meta.env.VITE_TVDESK_URL || "http://localhost:8080";
const SIGNALING_URL =
  import.meta.env.VITE_TVDESK_SIGNALING || "ws://localhost:8888";

export default function TVDeskRun() {
  const [status, setStatus] = useState("checking");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(TVDESK_PS2_URL, {
          method: "HEAD",
          mode: "no-cors",
        });
        if (!cancelled) setStatus("online");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
      <header className={styles.pageHeader}>
        <span className={styles.overline}>Pixel Streaming 2</span>
        <h1 className={styles.title}>TwinverseDesk Live</h1>
        <p className={styles.subtitle}>
          UE5 Pixel Streaming 2로 브라우저에서 직접 TwinverseDesk에 접속합니다.
        </p>
      </header>

      {/* Stream Viewer */}
      <section className={styles.streamSection} ref={streamRef}>
        <div className={styles.streamContainer}>
          {status === "online" ? (
            <iframe
              src={TVDESK_PS2_URL}
              className={styles.streamFrame}
              allow="autoplay; fullscreen; microphone; gamepad"
              title="TwinverseDesk Pixel Streaming"
            />
          ) : (
            <div className={styles.streamPlaceholder}>
              <div className={styles.placeholderIcon}>
                {status === "checking" ? (
                  <div className={styles.spinner} />
                ) : (
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect
                      x="2"
                      y="3"
                      width="20"
                      height="14"
                      rx="2"
                      ry="2"
                    />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                )}
              </div>
              <p className={styles.placeholderText}>
                {status === "checking"
                  ? "Pixel Streaming 서버 확인 중..."
                  : "서버에 연결할 수 없습니다"}
              </p>
              {status === "offline" && (
                <p className={styles.placeholderHint}>
                  LaunchPS2_FullTest.bat를 실행하여 로컬 스트리밍을 시작하세요.
                  <br />
                  15초마다 자동으로 재확인합니다.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Stream Controls */}
        <div className={styles.streamControls}>
          <div className={styles.statusBadge}>
            <span
              className={`${styles.statusDot} ${status === "online" ? styles.statusOnline : status === "checking" ? styles.statusChecking : ""}`}
            />
            {status === "online"
              ? "스트리밍 중"
              : status === "checking"
                ? "확인 중..."
                : "오프라인"}
          </div>
          <div className={styles.controlBtns}>
            {status === "online" && (
              <>
                <button
                  onClick={toggleFullscreen}
                  className={styles.controlBtn}
                  title={isFullscreen ? "전체화면 종료" : "전체화면"}
                >
                  {isFullscreen ? "Exit FS" : "Fullscreen"}
                </button>
                <button
                  onClick={() =>
                    window.open(TVDESK_PS2_URL, "_blank", "noopener")
                  }
                  className={styles.controlBtn}
                  title="새 탭에서 열기"
                >
                  New Tab
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Connection Info */}
      <section className={styles.infoSection}>
        <h3 className={styles.infoTitle}>접속 정보</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>서버 상태</span>
            <span
              className={`${styles.infoValue} ${status === "online" ? styles.infoOnline : ""}`}
            >
              {status === "online"
                ? "Pixel Streaming 실행 중"
                : status === "checking"
                  ? "확인 중..."
                  : "미연결"}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Player URL</span>
            <span className={styles.infoValue}>{TVDESK_PS2_URL}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Signaling</span>
            <span className={styles.infoValue}>{SIGNALING_URL}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>프로토콜</span>
            <span className={styles.infoValue}>WebRTC + WebSocket</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>엔진</span>
            <span className={styles.infoValue}>
              Unreal Engine 5.7 + PixelStreaming2
            </span>
          </div>
        </div>
      </section>

      {/* Quick Guide */}
      <section className={styles.guideSection}>
        <h3 className={styles.infoTitle}>사용 가이드</h3>
        <div className={styles.guideGrid}>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>1</span>
            <div>
              <strong>LaunchPS2_FullTest.bat</strong> 실행으로 Wilbur + UE5 자동
              시작
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>2</span>
            <div>
              이 페이지에서 <strong>스트리밍 화면</strong>이 자동���로 표시됩니다
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>3</span>
            <div>
              <strong>마우스/키보드</strong>로 직접 UE5 게임을 조작할 수 있습니다
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>4</span>
            <div>
              <strong>Fullscreen</strong> 버튼으로 전체화면 몰입 플레이 가능
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
