import { useState, useEffect } from "react";
import styles from "./TVDeskRun.module.css";

const TVDESK_URL = import.meta.env.VITE_TVDESK_URL || "https://tvdesk.twinverse.org";

export default function TVDeskRun() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        await fetch(TVDESK_URL, { method: "HEAD", mode: "no-cors" });
        if (!cancelled) setStatus("online");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleLaunch = () => {
    window.open(TVDESK_URL, "_blank", "noopener");
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>TVDesk Live</span>
        <h1 className={styles.title}>TVDesk 실행</h1>
        <p className={styles.subtitle}>
          TVDesk 가상 오피스에 접속합니다. Orbitron PostgreSQL에 연결되어 있습니다.
        </p>
      </header>

      <section className={styles.launchSection}>
        <div className={styles.launchCard}>
          <div className={styles.launchVisual}>
            <div className={styles.mockScreen}>
              <div className={styles.mockHeader}>
                <span /><span /><span />
              </div>
              <div className={styles.mockBody}>
                <div className={styles.mock3d}>
                  <div className={styles.mockFloor} />
                  <div className={styles.mockDesk} />
                  <div className={styles.mockChar} />
                  <div className={styles.mockNpc} />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.launchInfo}>
            <div className={styles.statusBadge}>
              <span className={`${styles.statusDot} ${status === "online" ? styles.statusOnline : status === "checking" ? styles.statusChecking : ""}`} />
              {status === "online" ? "서버 실행 중" : status === "checking" ? "확인 중..." : "서버 미연결"}
            </div>
            <h2 className={styles.launchTitle}>가상 오피스에 입장하기</h2>
            <p className={styles.launchDesc}>
              TVDesk가 새 탭에서 열립니다. 2D 픽셀아트 가상 오피스에서 AI 동료들과 함께 일하세요.
            </p>
            <button
              onClick={handleLaunch}
              className={styles.launchBtn}
              disabled={status !== "online"}
            >
              {status === "online" ? "TVDesk 실행하기" : status === "checking" ? "서버 확인 중..." : "서버 미연결"}
            </button>
            {status === "offline" && (
              <p className={styles.offlineHint}>
                서버가 실행되지 않고 있습니다. 15초마다 자동으로 재확인합니다.
              </p>
            )}
          </div>
        </div>
      </section>

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
            <span className={styles.infoValue}>{TVDESK_URL}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>데이터베이스</span>
            <span className={styles.infoValue}>Orbitron PostgreSQL (192.168.219.101:3718)</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>프로토콜</span>
            <span className={styles.infoValue}>HTTPS + WebSocket (Cloudflare Tunnel)</span>
          </div>
        </div>
      </section>

      <section className={styles.guideSection}>
        <h3 className={styles.infoTitle}>사용 가이드</h3>
        <div className={styles.guideGrid}>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>1</span>
            <div>
              <strong>"TVDesk 실행하기"</strong> 버튼을 클릭하면 새 탭에서 TVDesk가 열립니다.
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>2</span>
            <div>
              <strong>회원가입/로그인</strong> 후 가상 오피스에 입장합니다.
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>3</span>
            <div>
              <strong>캐릭터를 커스터마이징</strong>하고 오피스 맵을 탐색하세요.
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>4</span>
            <div>
              <strong>AI NPC</strong>에게 업무를 위임하거나 AI 회의실에서 브레인스토밍하세요.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
