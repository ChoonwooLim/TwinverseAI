import { Link } from "react-router-dom";
import styles from "./DeskLaunch.module.css";

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
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>Coming Soon</span>
          <h1 className={styles.title}>TwinverseDesk</h1>
          <p className={styles.tagline}>
            차세대 3D 가상 오피스 플랫폼
          </p>
          <p className={styles.heroDesc}>
            Unreal Engine 5 Pixel Streaming 기반의 AAA급 3D 가상 오피스.<br/>
            웹 브라우저만으로 몰입감 있는 업무 환경을 경험하세요.
          </p>
          <div className={styles.heroCta}>
            <button className={styles.launchBtn} disabled>
              서비스 준비 중
            </button>
            <Link to="/twinversedesk/plan" className={styles.planLink}>
              개발계획 보기 →
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
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
              <span className={styles.mockLabel}>Pixel Streaming Preview</span>
            </div>
          </div>
        </div>
      </header>

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
