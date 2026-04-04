import { useState, useEffect } from "react";
import styles from "./DeskRPGRun.module.css";

const DESKRPG_URL = import.meta.env.VITE_DESKRPG_URL || "http://localhost:3100";

export default function DeskRPGRun() {
  const [status, setStatus] = useState("checking"); // checking | online | offline
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(DESKRPG_URL, { method: "HEAD", mode: "no-cors" });
        if (!cancelled) setStatus("online");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleFullscreen = () => {
    setFullscreen(true);
  };

  const handleNewTab = () => {
    window.open(DESKRPG_URL, "_blank");
  };

  if (fullscreen) {
    return (
      <div className={styles.fullscreen}>
        <div className={styles.fullscreenBar}>
          <span className={styles.fullscreenTitle}>DeskRPG</span>
          <div className={styles.fullscreenActions}>
            <button onClick={handleNewTab} className={styles.barBtn}>새 탭에서 열기</button>
            <button onClick={() => setFullscreen(false)} className={styles.barBtn}>닫기</button>
          </div>
        </div>
        <iframe
          src={DESKRPG_URL}
          className={styles.fullscreenFrame}
          title="DeskRPG"
          allow="microphone; camera; fullscreen"
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>DeskRPG Live</span>
        <h1 className={styles.title}>DeskRPG 실행</h1>
        <p className={styles.subtitle}>
          DeskRPG 가상 오피스에 접속합니다. Orbitron PostgreSQL에 연결되어 있습니다.
        </p>
      </header>

      {status === "online" ? (
        <>
          <section className={styles.toolbar}>
            <div className={styles.statusBadge}>
              <span className={`${styles.statusDot} ${styles.statusOnline}`} />
              서버 연결됨
            </div>
            <div className={styles.toolbarActions}>
              <button onClick={handleFullscreen} className={styles.actionBtn}>전체화면</button>
              <button onClick={handleNewTab} className={styles.actionBtnOutline}>새 탭에서 열기</button>
            </div>
          </section>
          <section className={styles.embedSection}>
            <iframe
              src={DESKRPG_URL}
              className={styles.embedFrame}
              title="DeskRPG"
              allow="microphone; camera; fullscreen"
            />
          </section>
        </>
      ) : (
        <section className={styles.embedSection}>
          <div className={styles.placeholder}>
            <div className={styles.iconWrap}>
              {status === "checking" ? (
                <div className={styles.spinner} />
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </div>
            <h2 className={styles.placeholderTitle}>
              {status === "checking" ? "서버 연결 확인 중..." : "DeskRPG 서버에 연결할 수 없습니다"}
            </h2>
            <p className={styles.placeholderDesc}>
              {status === "checking"
                ? "DeskRPG 서버 상태를 확인하고 있습니다."
                : "서버가 실행 중인지 확인해 주세요. 15초마다 자동으로 재시도합니다."}
            </p>
            {status === "offline" && (
              <code className={styles.cmdHint}>npx deskrpg start -p 3100</code>
            )}
            <div className={styles.statusBadge}>
              <span className={`${styles.statusDot} ${status === "checking" ? styles.statusChecking : ""}`} />
              {status === "checking" ? "확인 중" : "서버 미연결"}
            </div>
          </div>
        </section>
      )}

      <section className={styles.infoSection}>
        <h3 className={styles.infoTitle}>접속 정보</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>서버 상태</span>
            <span className={`${styles.infoValue} ${status === "online" ? styles.infoOnline : ""}`}>
              {status === "online" ? "실행 중" : status === "checking" ? "확인 중..." : "미연결"}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>서버 URL</span>
            <span className={styles.infoValue}>{DESKRPG_URL}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>데이터베이스</span>
            <span className={styles.infoValue}>Orbitron PostgreSQL (192.168.219.101:3718)</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>프로토콜</span>
            <span className={styles.infoValue}>HTTP + WebSocket (Socket.IO)</span>
          </div>
        </div>
      </section>
    </div>
  );
}
