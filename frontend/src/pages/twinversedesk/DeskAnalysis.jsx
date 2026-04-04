import styles from "./DeskAnalysis.module.css";

const TECH_STACK = [
  { name: "Next.js 16", role: "풀스택 프레임워크", detail: "App Router + RSC, 서버/클라이언트 하이브리드 렌더링" },
  { name: "Phaser 3", role: "2D 게임 엔진", detail: "WebGL/Canvas 기반, 타일맵 렌더링, 스프라이트 애니메이션" },
  { name: "Socket.IO", role: "실시간 통신", detail: "WebSocket 기반 멀티플레이어 동기화, 채팅, 위치 브로드캐스트" },
  { name: "Drizzle ORM", role: "데이터베이스", detail: "PostgreSQL/SQLite 듀얼 지원, 타입 안전 쿼리 빌더" },
  { name: "OpenClaw", role: "AI 게이트웨이", detail: "OpenAI/Anthropic/Google 멀티프로바이더 AI 통합" },
  { name: "Tiled Format", role: "맵 에디터", detail: "브라우저 내장 타일맵 에디터, JSON 기반 맵 포맷" },
];

const SCALE_STATS = [
  { label: "소스 파일", value: "264", unit: "개" },
  { label: "코드 라인", value: "63,800", unit: "줄" },
  { label: "DB 테이블", value: "27", unit: "개" },
  { label: "API 라우트", value: "70+", unit: "개" },
  { label: "React 컴포넌트", value: "78", unit: "개" },
  { label: "지원 언어", value: "4", unit: "개" },
];

const FEATURES = [
  {
    category: "가상 오피스",
    items: [
      "등각(Isometric) 2D 타일맵 기반 가상 공간",
      "아바타 실시간 이동 및 위치 동기화",
      "근접 기반 음성/비디오 채팅 (WebRTC)",
      "맵 영역별 인터랙션 (회의실, 라운지, 개인 데스크)",
      "브라우저 내장 맵 에디터 (Tiled JSON 포맷)",
    ],
  },
  {
    category: "캐릭터 시스템",
    items: [
      "LPC (Liberated Pixel Cup) 스프라이트 규격",
      "1,000+ 레이어 조합 가능 (헤어, 의상, 장비 등)",
      "8방향 걷기/달리기/앉기 애니메이션",
      "커스텀 캐릭터 에디터 UI",
      "PNG 스프라이트시트 실시간 합성",
    ],
  },
  {
    category: "AI 통합",
    items: [
      "AI NPC 업무 위임 시스템 (Task Delegation)",
      "AI 회의실 — 다중 AI 에이전트 동시 토론",
      "OpenAI / Anthropic / Google AI 멀티 프로바이더",
      "컨텍스트 기반 대화 메모리",
      "AI 어시스턴트 커스터마이징",
    ],
  },
  {
    category: "조직 관리",
    items: [
      "RBAC 역할 기반 접근 제어 (Owner/Admin/Member/Viewer)",
      "조직(Organization) → 프로젝트 → 룸 계층 구조",
      "초대 시스템 (이메일/링크 기반)",
      "i18n 다국어 지원 (한/영/일/중)",
      "실시간 알림 및 활동 로그",
    ],
  },
];

const LIMITATIONS = [
  { title: "2D 렌더링 한계", desc: "Phaser 3 기반 등각 뷰는 시각적 몰입감이 부족하며 3D 공간 표현에 제약이 있습니다." },
  { title: "픽셀아트 캐릭터", desc: "LPC 스프라이트는 해상도와 표현력에 한계가 있으며 현대적 디자인 트렌드와 괴리가 있습니다." },
  { title: "확장성 문제", desc: "Socket.IO 단일 서버 아키텍처로 대규모 동시접속 처리에 병목이 발생합니다." },
  { title: "맵 에디터 제약", desc: "2D 타일맵 에디터는 직관성이 떨어지며 복잡한 공간 설계에 시간이 과도하게 소요됩니다." },
  { title: "모바일 미지원", desc: "데스크톱 브라우저 전용 설계로 모바일/태블릿 환경에서 사용이 불가능합니다." },
  { title: "AI 통합 깊이", desc: "AI 기능이 텍스트 채팅 수준에 머물러 있으며 시각/음성 멀티모달 지원이 없습니다." },
];

const DB_TABLES = [
  "users — 사용자 계정 및 프로필",
  "organizations — 조직(워크스페이스)",
  "projects — 프로젝트 단위 관리",
  "rooms — 가상 공간(맵) 정의",
  "room_tiles — 타일맵 데이터",
  "avatars — 캐릭터 커스텀 설정",
  "avatar_layers — 스프라이트 레이어",
  "messages — 채팅 메시지 이력",
  "ai_sessions — AI 대화 세션",
  "ai_messages — AI 메시지 로그",
  "tasks — 업무 할당/위임 기록",
  "invitations — 초대 관리",
  "permissions — RBAC 권한 매핑",
  "activity_logs — 활동 추적",
];

export default function DeskAnalysis() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>TVDesk Analysis Report</span>
        <h1 className={styles.title}>TVDesk 분석 보고서</h1>
        <p className={styles.subtitle}>
          TVDesk 오픈소스 프로젝트의 아키텍처, 기능, 기술 스택을 체계적으로 분석하여
          TwinverseDesk 개발을 위한 기반 자료를 제공합니다.
        </p>
      </header>

      {/* 프로젝트 규모 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>프로젝트 규모</h2>
        <div className={styles.statsGrid}>
          {SCALE_STATS.map((s) => (
            <div key={s.label} className={styles.statCard}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statUnit}>{s.unit}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 기술 스택 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>기술 스택</h2>
        <div className={styles.techGrid}>
          {TECH_STACK.map((t) => (
            <div key={t.name} className={styles.techCard}>
              <h3 className={styles.techName}>{t.name}</h3>
              <span className={styles.techRole}>{t.role}</span>
              <p className={styles.techDetail}>{t.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 핵심 기능 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>핵심 기능 분석</h2>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.category} className={styles.featureCard}>
              <h3 className={styles.featureCategory}>{f.category}</h3>
              <ul className={styles.featureList}>
                {f.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 데이터베이스 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>데이터베이스 구조</h2>
        <p className={styles.sectionDesc}>
          TVDesk는 27개의 데이터 테이블을 사용하며, Drizzle ORM으로 PostgreSQL과 SQLite를 동시 지원합니다.
          주요 테이블 구조는 다음과 같습니다.
        </p>
        <div className={styles.tableGrid}>
          {DB_TABLES.map((t, i) => {
            const [name, desc] = t.split(" — ");
            return (
              <div key={i} className={styles.tableRow}>
                <code className={styles.tableName}>{name}</code>
                <span className={styles.tableDesc}>{desc}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 한계점 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>한계점 및 개선 필요사항</h2>
        <p className={styles.sectionDesc}>
          TVDesk는 혁신적인 콘셉트를 가지고 있으나 아래의 기술적 한계가 확인되었습니다.
          TwinverseDesk는 이 한계점들을 근본적으로 해결합니다.
        </p>
        <div className={styles.limitGrid}>
          {LIMITATIONS.map((l) => (
            <div key={l.title} className={styles.limitCard}>
              <h3 className={styles.limitTitle}>{l.title}</h3>
              <p className={styles.limitDesc}>{l.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 결론 */}
      <section className={`${styles.section} ${styles.conclusion}`}>
        <h2 className={styles.sectionTitle}>분석 결론</h2>
        <div className={styles.conclusionContent}>
          <p>
            TVDesk는 <strong>가상 오피스 + AI + 게임화</strong>라는 혁신적 콘셉트를 가진 프로젝트입니다.
            264개의 소스 파일, 63,800줄의 코드, 27개의 DB 테이블로 구성된 대규모 풀스택 애플리케이션이며,
            실시간 멀티플레이어, AI 에이전트 통합, 캐릭터 커스터마이징 등 고도화된 기능을 구현하고 있습니다.
          </p>
          <p>
            그러나 <strong>2D Phaser 엔진의 시각적 한계</strong>, <strong>픽셀아트 캐릭터의 표현력 부족</strong>,
            <strong>확장성 병목</strong> 등의 근본적인 제약이 존재합니다. TwinverseDesk는 이러한 한계를
            극복하기 위해 <strong>Unreal Engine 기반 3D 렌더링</strong>, <strong>고품질 3D 캐릭터 시스템</strong>,
            <strong>분산 아키텍처</strong>를 도입하여 차세대 가상 오피스 플랫폼을 구현합니다.
          </p>
        </div>
      </section>
    </div>
  );
}
