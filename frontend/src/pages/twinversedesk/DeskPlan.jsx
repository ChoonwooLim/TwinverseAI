import styles from "./DeskPlan.module.css";

const PHASES = [
  {
    phase: "Phase 1",
    title: "코어 엔진 & 기반 시스템",
    period: "M1 – M3",
    status: "planned",
    tasks: [
      "Unreal Engine 5 Pixel Streaming 서버 구축",
      "FastAPI + WebSocket 시그널링 서버 개발",
      "React 클라이언트 — UE5 스트림 뷰어 통합",
      "기본 3D 가상 오피스 레벨 제작 (로비, 회의실, 라운지)",
      "사용자 인증 & 조직 관리 시스템",
      "PostgreSQL 스키마 설계 (TVDesk 27테이블 → 최적화된 구조)",
    ],
  },
  {
    phase: "Phase 2",
    title: "3D 캐릭터 & 아바타 시스템",
    period: "M3 – M5",
    status: "planned",
    tasks: [
      "MetaHuman 기반 고품질 3D 아바타 생성 파이프라인",
      "50+ 커스터마이징 슬롯 (헤어, 의상, 악세서리, 표정 등)",
      "실시간 의상 변경 & 물리 시뮬레이션 (Cloth Physics)",
      "표정 애니메이션 시스템 (52개 블렌드쉐이프)",
      "아바타 프리셋 & 저장/불러오기",
      "웹 기반 캐릭터 에디터 UI (React + 3D 프리뷰)",
    ],
  },
  {
    phase: "Phase 3",
    title: "실시간 멀티플레이어",
    period: "M5 – M7",
    status: "planned",
    tasks: [
      "Dedicated Server 기반 멀티플레이어 (TVDesk Socket.IO 대체)",
      "위치/회전/애니메이션 동기화 (클라이언트 예측 + 서버 보정)",
      "근접 기반 공간 음성 채팅 (Spatial Audio)",
      "WebRTC 비디오 통화 (화면 공유 포함)",
      "텍스트 채팅 & 이모지 리액션",
      "100+ 동시접속 최적화 (Level Streaming + LOD)",
    ],
  },
  {
    phase: "Phase 4",
    title: "AI 에이전트 통합",
    period: "M7 – M9",
    status: "planned",
    tasks: [
      "AI NPC — 3D 캐릭터로 시각화된 AI 어시스턴트",
      "Claude / GPT / Gemini 멀티프로바이더 지원",
      "AI 회의실 — 다중 AI 에이전트 동시 토론 (3D 씬)",
      "음성 인식/합성 통합 (STT/TTS → AI NPC 립싱크)",
      "업무 위임 시스템 (AI에게 작업 할당/추적)",
      "RAG 기반 조직 지식 베이스 검색",
    ],
  },
  {
    phase: "Phase 5",
    title: "맵 에디터 & 확장",
    period: "M9 – M12",
    status: "planned",
    tasks: [
      "웹 기반 3D 레벨 에디터 (Unreal → 웹 변환)",
      "프리팹 라이브러리 (가구, 장비, 장식물 200+ 에셋)",
      "드래그 & 드롭 룸 커스터마이징",
      "Unreal Engine 레벨 Import/Export (.umap ↔ JSON)",
      "멀티 플로어 빌딩 시스템",
      "모바일/태블릿 뷰어 최적화",
    ],
  },
];

const COMPARE_ITEMS = [
  { feature: "렌더링 엔진", desk: "Phaser 3 (2D WebGL)", twin: "Unreal Engine 5 (Pixel Streaming 3D)" },
  { feature: "캐릭터 품질", desk: "LPC 픽셀아트 (32×32)", twin: "MetaHuman 3D (포토리얼)" },
  { feature: "캐릭터 커스텀", desk: "1,000+ 2D 레이어", twin: "50+ 3D 슬롯 + 물리 시뮬레이션" },
  { feature: "맵 시스템", desk: "2D 타일맵 (Tiled JSON)", twin: "3D 레벨 (Unreal Engine .umap)" },
  { feature: "맵 에디터", desk: "브라우저 타일맵 에디터", twin: "웹 3D 에디터 + UE5 Import" },
  { feature: "동시접속", desk: "~30명 (Socket.IO 단일 서버)", twin: "100+ (Dedicated Server + Level Streaming)" },
  { feature: "음성 채팅", desk: "WebRTC (2D 근접)", twin: "Spatial Audio (3D 공간 음향)" },
  { feature: "AI 에이전트", desk: "텍스트 채팅", twin: "3D NPC + 음성 + 립싱크" },
  { feature: "물리 엔진", desk: "없음", twin: "Chaos Physics (충돌, 파괴, 천 시뮬레이션)" },
  { feature: "모바일 지원", desk: "미지원", twin: "Pixel Streaming으로 모바일 접속 가능" },
  { feature: "조명 시스템", desk: "없음 (플랫 2D)", twin: "Lumen (글로벌 일루미네이션)" },
  { feature: "그래픽 품질", desk: "레트로 픽셀", twin: "AAA급 실시간 렌더링" },
];

const ARCHITECTURE = [
  {
    layer: "프론트엔드",
    tech: "React 19 + Vite + Unreal Pixel Streaming SDK",
    desc: "웹 UI와 3D 뷰를 하나의 SPA에서 통합. React가 UI를 담당하고 UE5 Pixel Streaming이 3D 렌더링을 담당.",
  },
  {
    layer: "시그널링 서버",
    tech: "FastAPI + WebSocket",
    desc: "Pixel Streaming 연결 중개, 사용자 인풋 → UE5 전달, 스트림 세션 관리.",
  },
  {
    layer: "게임 서버",
    tech: "Unreal Engine 5 Dedicated Server",
    desc: "3D 월드 시뮬레이션, 멀티플레이어 동기화, 물리 연산, AI NPC 동작 처리.",
  },
  {
    layer: "API 서버",
    tech: "FastAPI + SQLModel + PostgreSQL",
    desc: "사용자/조직/프로젝트/채팅/AI 세션 등 비즈니스 로직 처리. JWT 인증.",
  },
  {
    layer: "AI 서비스",
    tech: "Claude API + OpenAI API + RAG Pipeline",
    desc: "멀티프로바이더 AI 게이트웨이, 지식 베이스 검색, AI NPC 대화/업무 위임.",
  },
  {
    layer: "미디어 서버",
    tech: "LiveKit / mediasoup",
    desc: "WebRTC SFU 기반 음성/비디오 통화, 공간 음향, 화면 공유.",
  },
];

const UE_FEATURES = [
  {
    title: "Pixel Streaming",
    desc: "Unreal Engine이 서버에서 렌더링한 화면을 웹 브라우저에 실시간 스트리밍합니다. 사용자는 고사양 PC 없이 웹 브라우저만으로 AAA급 3D 그래픽을 경험할 수 있습니다.",
  },
  {
    title: "Nanite 가상 지오메트리",
    desc: "수억 개의 폴리곤을 실시간 처리하는 UE5 핵심 기술로, 건축물과 오피스 환경을 영화급 디테일로 렌더링합니다.",
  },
  {
    title: "Lumen 글로벌 일루미네이션",
    desc: "실시간 반사와 간접 조명으로 자연스러운 오피스 환경을 구현합니다. 시간대별 조명 변화, 창문 반사 등 현실감 있는 공간을 연출합니다.",
  },
  {
    title: "MetaHuman Framework",
    desc: "포토리얼리스틱 3D 캐릭터 생성 프레임워크. 피부 텍스처, 헤어 시뮬레이션, 표정 애니메이션까지 영화급 퀄리티의 아바타를 구현합니다.",
  },
  {
    title: "Chaos Physics",
    desc: "실시간 물리 엔진으로 가구 상호작용, 의상 시뮬레이션, 파티클 이펙트 등 인터랙티브한 오피스 환경을 구현합니다.",
  },
  {
    title: "Level Streaming",
    desc: "대규모 맵을 영역별로 동적 로드/언로드하여 100+ 동시접속에서도 안정적인 성능을 유지합니다. 멀티 플로어 빌딩에 필수적인 기술입니다.",
  },
];

export default function DeskPlan() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>TwinverseDesk Development Plan</span>
        <h1 className={styles.title}>TwinverseDesk 개발계획</h1>
        <p className={styles.subtitle}>
          TVDesk의 혁신적 콘셉트를 계승하면서 Unreal Engine 5 기반 3D 가상 오피스로 진화시키는
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
          TwinverseDesk는 Unreal Engine 5의 최신 기술을 활용하여 웹 브라우저에서 AAA급 3D 그래픽을 제공합니다.
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
        <h2 className={styles.sectionTitle}>개발 로드맵</h2>
        <div className={styles.timeline}>
          {PHASES.map((p, i) => (
            <div key={i} className={styles.phase}>
              <div className={styles.phaseMarker}>
                <div className={styles.phaseDot} />
                {i < PHASES.length - 1 && <div className={styles.phaseLine} />}
              </div>
              <div className={styles.phaseContent}>
                <div className={styles.phaseMeta}>
                  <span className={styles.phaseLabel}>{p.phase}</span>
                  <span className={styles.phasePeriod}>{p.period}</span>
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
