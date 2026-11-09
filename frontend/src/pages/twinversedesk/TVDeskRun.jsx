import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
        <span className={styles.overline}>TVDesk · 2D Virtual Office</span>
        <h1 className={styles.title}>TVDesk 2D 오피스</h1>
        <p className={styles.subtitle}>
          DeskRPG 기반의 픽셀아트 가상 오피스를 새 탭에서 엽니다.
          캐릭터와 채널, AI NPC와 태스크 흐름을 갖춘 별도 웹 서비스입니다.
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
              {status === "online" ? "접속 요청 완료" : status === "checking" ? "접속 확인 중..." : "접속 요청 실패"}
            </div>
            <h2 className={styles.launchTitle}>가상 오피스에 입장하기</h2>
            <p className={styles.launchDesc}>
              새 탭에서 TVDesk의 계정·채널 안내를 따라 입장하세요.
              AI NPC 대화와 업무 위임은 해당 채널의 AI 연결이 준비되어 있어야 사용할 수 있습니다.
            </p>
            <button
              onClick={handleLaunch}
              className={styles.launchBtn}
              disabled={status !== "online"}
            >
              {status === "online" ? "TVDesk 새 탭에서 열기" : status === "checking" ? "접속 확인 중..." : "연결 재확인 중"}
            </button>
            {status === "offline" && (
              <p className={styles.offlineHint}>
                접속 요청에 실패했습니다. 15초마다 자동으로 재확인합니다. 네트워크 상태를 확인하거나 잠시 후 다시 이용해주세요.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className={styles.infoSection}>
        <h3 className={styles.infoTitle}>접속 정보</h3>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>접속 요청</span>
            <span className={`${styles.infoValue} ${status === "online" ? styles.infoOnline : ""}`}>
              {status === "online" ? "완료 · 서비스 화면 확인 필요" : status === "checking" ? "확인 중..." : "실패"}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>접속 주소</span>
            <span className={styles.infoValue}>{TVDESK_URL}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>서비스 형태</span>
            <span className={styles.infoValue}>2D 픽셀아트 웹 오피스 · 별도 탭에서 실행</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>AI 이용 조건</span>
            <span className={styles.infoValue}>서비스 로그인·채널 권한·AI 연결 설정에 따라 제공</span>
          </div>
        </div>
        <p className={styles.connectionNote}>
          이 페이지는 접속 요청의 완료 여부를 확인합니다. 로그인·오피스·AI 기능의 정상 동작은
          새 탭의 실제 서비스 화면에서 확인해주세요.
        </p>
      </section>

      <section className={styles.guideSection}>
        <h3 className={styles.infoTitle}>사용 가이드</h3>
        <div className={styles.guideGrid}>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>1</span>
            <div>
              <strong>TVDesk 새 탭에서 열기</strong>를 누르세요. 창이 열리지 않으면 브라우저의 팝업 차단을 확인하세요.
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>2</span>
            <div>
              <strong>TVDesk의 로그인 안내</strong>를 따르세요. 현재 포털에 로그인했더라도 별도 서비스에서 로그인이 필요할 수 있습니다.
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>3</span>
            <div>
              <strong>캐릭터와 채널을 선택</strong>하고 오피스를 탐색하세요. 참여 가능한 공간과 기능은 채널 권한에 따라 달라집니다.
            </div>
          </div>
          <div className={styles.guideStep}>
            <span className={styles.guideNum}>4</span>
            <div>
              <strong>AI 연결이 준비된 채널</strong>에서는 NPC 대화·업무 요청·태스크 보드·AI 회의를 이용할 수 있습니다. 제공되는 기능을 서비스 화면에서 확인하세요.
            </div>
          </div>
        </div>
      </section>

      <section className={styles.guideSection}>
        <h3 className={styles.infoTitle}>UE5 공간을 찾고 계신가요?</h3>
        <p className={styles.connectionNote}>
          TwinverseDesk는 UE5 Pixel Streaming으로 3D 공간을 여는 별도 실행 경험입니다.
          현재 Solo 세션 연동을 제공하며 스트리밍 서버가 준비되어 있어야 합니다.{" "}
          <Link to="/twinversedesk/launch">TwinverseDesk 3D 실행 →</Link>
        </p>
      </section>
    </div>
  );
}
