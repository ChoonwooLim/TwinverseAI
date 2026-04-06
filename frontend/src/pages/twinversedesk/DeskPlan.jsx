import styles from "./DeskPlan.module.css";

const PHASES = [
  {
    phase: "Phase 1",
    title: "코어 엔진 & 기반 시스템",
    period: "M1 - M3",
    status: "in-progress",
    tasks: [
      "Unreal Engine 5.5 Pixel Streaming 서버 구축 (TURN/STUN 릴레이 포함)",
      "FastAPI + WebSocket 시그널링 서버 개발 (세션 관리, 자동 재연결)",
      "React 19 클라이언트 - UE5 스트림 뷰어 통합 (적응형 비트레이트)",
      "기본 3D 가상 오피스 레벨 제작 (로비, 회의실, 라운지, 개인 부스)",
      "JWT 인증 + OAuth 2.0 SSO (Google, GitHub, Microsoft 365)",
      "PostgreSQL 스키마 설계 (DeskRPG 27테이블 → 42테이블 확장 구조)",
      "Orbitron 클라우드 배포 파이프라인 (Docker + CI/CD)",
      "Cloudflare Tunnel HTTPS + WebSocket 프록시 구성",
    ],
  },
  {
    phase: "Phase 2",
    title: "3D 캐릭터 & 아바타 시스템",
    period: "M3 - M5",
    status: "planned",
    tasks: [
      "MetaHuman 5.0 기반 포토리얼 3D 아바타 생성 파이프라인",
      "80+ 커스터마이징 슬롯 (헤어스타일, 의상, 악세서리, 피부톤, 체형, 문신 등)",
      "실시간 의상 변경 & Chaos Cloth Physics 시뮬레이션",
      "52개 블렌드쉐이프 표정 애니메이션 + Live Link 페이셜 캡처",
      "아바타 프리셋 마켓플레이스 (사용자 제작 아이템 거래)",
      "웹 기반 캐릭터 에디터 UI (React + Three.js 실시간 프리뷰)",
      "AI 기반 아바타 자동 생성 (사진 업로드 → MetaHuman 변환)",
    ],
  },
  {
    phase: "Phase 3",
    title: "실시간 멀티플레이어 & 커뮤니케이션",
    period: "M5 - M7",
    status: "planned",
    tasks: [
      "UE5 Dedicated Server 기반 멀티플레이어 (DeskRPG Socket.IO 완전 대체)",
      "클라이언트 예측 + 서버 보정 위치/회전/애니메이션 동기화",
      "Spatial Audio 기반 근접 음성 채팅 (거리에 따른 볼륨 감쇠)",
      "WebRTC 영상 통화 + 화면 공유 (PiP 모드 지원)",
      "실시간 텍스트 채팅 (채널, DM, 그룹) + 이모지/GIF 리액션",
      "200+ 동시접속 최적화 (Level Streaming + Dynamic LOD + Occlusion Culling)",
      "네트워크 지연 보상 알고리즘 (한국/미국/유럽 멀티리전)",
    ],
  },
  {
    phase: "Phase 4",
    title: "AI 에이전트 & 지능형 업무 시스템",
    period: "M7 - M10",
    status: "planned",
    tasks: [
      "AI NPC - 3D MetaHuman 캐릭터 + 자연어 대화 + 립싱크 애니메이션",
      "멀티프로바이더 AI 게이트웨이 (Claude 4.5, GPT-5, Gemini 2.5)",
      "AI 회의실 - 다중 AI 에이전트 동시 토론 (3D 씬 + 실시간 음성)",
      "음성 인식/합성 통합 (Whisper STT → AI 처리 → ElevenLabs TTS → 립싱크)",
      "Kanban/Scrum 통합 업무 위임 시스템 (AI에게 작업 할당, 진행률 추적, 보고)",
      "RAG 기반 조직 지식 베이스 (문서, Slack, Notion, Confluence 연동)",
      "AI 코드 리뷰어 NPC (GitHub PR 분석 → 3D 캐릭터가 브리핑)",
      "AI 비서 NPC (일정 관리, 이메일 요약, 미팅 노트 자동 작성)",
    ],
  },
  {
    phase: "Phase 5",
    title: "3D 맵 에디터 & 생태계 확장",
    period: "M10 - M12",
    status: "planned",
    tasks: [
      "웹 기반 3D 레벨 에디터 (드래그 & 드롭 + 실시간 협업 편집)",
      "프리팹 라이브러리 500+ 에셋 (가구, 장비, 식물, 조명, 벽면 데코)",
      "UE5 레벨 Import/Export (.umap ↔ JSON ↔ glTF)",
      "멀티 플로어 빌딩 시스템 (엘리베이터, 계단, 옥상 정원)",
      "테마/시즌 스킨 시스템 (크리스마스, 할로윈, 사이버펑크 등)",
      "모바일/태블릿 뷰어 최적화 (터치 인터페이스 + 적응형 UI)",
      "사용자 제작 맵 공유 마켓플레이스 + 평가 시스템",
      "API/SDK 공개 — 서드파티 플러그인 개발 지원",
    ],
  },
];

const COMPARE_ITEMS = [
  { feature: "렌더링 엔진", desk: "Phaser 3 (2D WebGL)", twin: "Unreal Engine 5.5 (Pixel Streaming 3D)" },
  { feature: "캐릭터 품질", desk: "LPC 픽셀아트 (32x32)", twin: "MetaHuman 5.0 (포토리얼리스틱)" },
  { feature: "캐릭터 커스텀", desk: "1,000+ 2D 레이어", twin: "80+ 3D 슬롯 + 물리 시뮬레이션 + AI 생성" },
  { feature: "맵 시스템", desk: "2D 타일맵 (Tiled JSON)", twin: "3D 레벨 (Unreal Engine .umap + Nanite)" },
  { feature: "맵 에디터", desk: "브라우저 타일맵 에디터", twin: "웹 3D 에디터 + UE5 Import + 실시간 협업" },
  { feature: "동시접속", desk: "~30명 (Socket.IO 단일 서버)", twin: "200+ (Dedicated Server + Level Streaming)" },
  { feature: "음성 채팅", desk: "WebRTC (2D 근접)", twin: "Spatial Audio (3D 공간 음향 + 노이즈 캔슬링)" },
  { feature: "AI 에이전트", desk: "텍스트 채팅", twin: "3D NPC + 음성 + 립싱크 + 업무 위임" },
  { feature: "물리 엔진", desk: "없음", twin: "Chaos Physics (충돌, 파괴, 천, 유체 시뮬레이션)" },
  { feature: "모바일 지원", desk: "미지원", twin: "Pixel Streaming 모바일 + 터치 인터페이스" },
  { feature: "조명 시스템", desk: "없음 (플랫 2D)", twin: "Lumen GI + 시간대별 동적 조명" },
  { feature: "그래픽 품질", desk: "레트로 픽셀", twin: "AAA급 실시간 렌더링 (Nanite + Lumen)" },
  { feature: "인증 시스템", desk: "자체 JWT", twin: "JWT + OAuth 2.0 SSO (Google, GitHub, MS)" },
  { feature: "업무 관리", desk: "없음", twin: "Kanban/Scrum 보드 + AI 자동 추적" },
  { feature: "지식 베이스", desk: "없음", twin: "RAG + Slack/Notion/Confluence 연동" },
];

const ARCHITECTURE = [
  {
    layer: "프론트엔드",
    tech: "React 19 + Vite 6 + UE5 Pixel Streaming SDK",
    desc: "웹 UI와 3D 뷰를 하나의 SPA에서 통합. React가 UI/대시보드를 담당하고 UE5 Pixel Streaming이 3D 가상 오피스를 실시간 렌더링합니다.",
  },
  {
    layer: "시그널링 서버",
    tech: "FastAPI + WebSocket + TURN/STUN",
    desc: "Pixel Streaming 연결 중개, 사용자 인풋 → UE5 전달, 적응형 비트레이트 관리, 자동 재연결 처리.",
  },
  {
    layer: "게임 서버",
    tech: "Unreal Engine 5.5 Dedicated Server",
    desc: "3D 월드 시뮬레이션, 멀티플레이어 동기화 (위치/회전/애니메이션), Chaos Physics 연산, AI NPC 행동 트리 실행.",
  },
  {
    layer: "API 서버",
    tech: "FastAPI + SQLModel + PostgreSQL (Orbitron)",
    desc: "사용자/조직/프로젝트/채팅/AI 세션 등 비즈니스 로직. JWT + OAuth 2.0 인증. Orbitron 플랫폼에 Docker 배포.",
  },
  {
    layer: "AI 게이트웨이",
    tech: "Claude API + OpenAI API + RAG (LangChain)",
    desc: "멀티프로바이더 AI 게이트웨이, 벡터 DB 기반 지식 베이스 검색, AI NPC 대화 오케스트레이션, 업무 위임 엔진.",
  },
  {
    layer: "미디어 서버",
    tech: "LiveKit SFU + ElevenLabs TTS",
    desc: "WebRTC SFU 기반 음성/비디오 통화, 3D 공간 음향 처리, 화면 공유, AI 음성 합성 (립싱크 연동).",
  },
  {
    layer: "인프라",
    tech: "Orbitron + Docker + Cloudflare Tunnel + GitHub Actions",
    desc: "CI/CD 파이프라인, HTTPS/WSS 터널링, 자동 배포, 모니터링 (Grafana), 로그 수집 (Loki).",
  },
];

const UE_FEATURES = [
  {
    title: "Pixel Streaming",
    desc: "UE5가 서버에서 렌더링한 화면을 WebRTC로 브라우저에 실시간 스트리밍. 사용자는 고사양 PC 없이 웹 브라우저만으로 AAA급 3D 그래픽을 경험합니다. 적응형 비트레이트로 네트워크 상태에 따라 자동 품질 조절.",
  },
  {
    title: "Nanite 가상 지오메트리",
    desc: "수십억 개의 폴리곤을 실시간 처리하는 UE5 핵심 기술. 건축물, 가구, 장식물을 영화급 디테일로 렌더링하면서도 프레임 드롭 없이 부드러운 성능을 유지합니다.",
  },
  {
    title: "Lumen 글로벌 일루미네이션",
    desc: "실시간 반사, 간접 조명, 그림자로 자연스러운 오피스 환경 구현. 시간대별 조명 변화 (아침 햇살 → 석양 → 야간 조명), 창문 반사, 네온 사인 등 현실감 있는 공간 연출.",
  },
  {
    title: "MetaHuman Framework",
    desc: "포토리얼리스틱 3D 캐릭터 생성. 피부 SSS 렌더링, Groom 헤어 시뮬레이션, 52개 블렌드쉐이프 표정 애니메이션, Live Link 페이셜 캡처까지 영화급 아바타를 실시간으로 구현.",
  },
  {
    title: "Chaos Physics",
    desc: "실시간 물리 엔진: 가구 충돌/상호작용, 천 시뮬레이션 (의상, 커튼), 파티클 이펙트 (커피 김, 먼지), 파괴 물리 (화이트보드 자석 등) 인터랙티브 오피스 환경.",
  },
  {
    title: "Level Streaming + World Partition",
    desc: "대규모 맵을 영역별로 동적 로드/언로드하여 200+ 동시접속에서도 안정적 성능 유지. World Partition으로 멀티 플로어 빌딩을 층별로 독립 스트리밍.",
  },
  {
    title: "Mass Entity (ECS)",
    desc: "Entity Component System 기반 대규모 오브젝트 시뮬레이션. 수백 개의 AI NPC 동시 행동, 군중 시뮬레이션, 환경 인터랙션을 효율적으로 처리.",
  },
  {
    title: "Niagara VFX",
    desc: "GPU 기반 파티클 시스템으로 환경 이펙트 구현: 비/눈 날씨, 홀로그램 디스플레이, 텔레포트 이펙트, AI NPC 활성화 시각 피드백 등.",
  },
];

const KPI_TARGETS = [
  { metric: "동시접속", target: "200+", unit: "명" },
  { metric: "렌더링 프레임", target: "60", unit: "FPS" },
  { metric: "네트워크 지연", target: "<50", unit: "ms" },
  { metric: "AI 응답 속도", target: "<2", unit: "초" },
  { metric: "Pixel Streaming 지연", target: "<100", unit: "ms" },
  { metric: "가용성", target: "99.9", unit: "%" },
];

export default function DeskPlan() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>TwinverseDesk Development Plan</span>
        <h1 className={styles.title}>TwinverseDesk 개발계획</h1>
        <p className={styles.subtitle}>
          DeskRPG의 혁신적 가상 오피스 콘셉트를 계승하면서, Unreal Engine 5 기반 AAA급 3D 가상 오피스로 진화시키는
          차세대 플랫폼 개발 로드맵입니다.
        </p>
      </header>

      {/* 비전 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>비전</h2>
        <div className={styles.visionBox}>
          <blockquote className={styles.vision}>
            "웹 브라우저에서 접속하는 AAA급 3D 가상 오피스.<br/>
            MetaHuman 아바타, 공간 음향, AI NPC가 함께하는<br/>
            <strong>미래형 업무 환경</strong>을 만듭니다."
          </blockquote>
        </div>
      </section>

      {/* 성능 목표 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>성능 목표 (KPI)</h2>
        <div className={styles.kpiGrid}>
          {KPI_TARGETS.map((k) => (
            <div key={k.metric} className={styles.kpiCard}>
              <span className={styles.kpiValue}>{k.target}</span>
              <span className={styles.kpiUnit}>{k.unit}</span>
              <span className={styles.kpiLabel}>{k.metric}</span>
            </div>
          ))}
        </div>
      </section>

      {/* DeskRPG vs TwinverseDesk */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>DeskRPG vs TwinverseDesk 비교</h2>
        <div className={styles.compareTable}>
          <div className={`${styles.compareRow} ${styles.compareHeader}`}>
            <span>기능</span>
            <span>DeskRPG</span>
            <span>TwinverseDesk</span>
          </div>
          {COMPARE_ITEMS.map((c, i) => (
            <div key={i} className={styles.compareRow}>
              <span className={styles.compareFeature}>{c.feature}</span>
              <span className={styles.comparOld}>{c.desk}</span>
              <span className={styles.compareNew}>{c.twin}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 시스템 아키텍처 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>시스템 아키텍처</h2>
        <div className={styles.archGrid}>
          {ARCHITECTURE.map((a) => (
            <div key={a.layer} className={styles.archCard}>
              <div className={styles.archHeader}>
                <h3 className={styles.archLayer}>{a.layer}</h3>
                <code className={styles.archTech}>{a.tech}</code>
              </div>
              <p className={styles.archDesc}>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Unreal Engine 핵심 기술 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Unreal Engine 5 핵심 기술</h2>
        <p className={styles.sectionDesc}>
          TwinverseDesk는 Unreal Engine 5.5의 최신 기술 스택을 활용하여 웹 브라우저에서 AAA급 3D 그래픽과 실시간 멀티플레이어를 제공합니다.
        </p>
        <div className={styles.ueGrid}>
          {UE_FEATURES.map((f) => (
            <div key={f.title} className={styles.ueCard}>
              <h3 className={styles.ueTitle}>{f.title}</h3>
              <p className={styles.ueDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 개발 로드맵 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>개발 로드맵 (12개월)</h2>
        <div className={styles.timeline}>
          {PHASES.map((p, i) => (
            <div key={i} className={`${styles.phase} ${p.status === "in-progress" ? styles.phaseActive : ""}`}>
              <div className={styles.phaseMarker}>
                <div className={`${styles.phaseDot} ${p.status === "in-progress" ? styles.phaseDotActive : ""}`} />
                {i < PHASES.length - 1 && <div className={styles.phaseLine} />}
              </div>
              <div className={styles.phaseContent}>
                <div className={styles.phaseMeta}>
                  <span className={styles.phaseLabel}>{p.phase}</span>
                  <span className={styles.phasePeriod}>{p.period}</span>
                  {p.status === "in-progress" && <span className={styles.phaseStatus}>진행 중</span>}
                </div>
                <h3 className={styles.phaseTitle}>{p.title}</h3>
                <ul className={styles.phaseTasks}>
                  {p.tasks.map((t, j) => (
                    <li key={j}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
