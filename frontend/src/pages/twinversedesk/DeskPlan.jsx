import styles from "./DeskPlan.module.css";

const PHASES = [
  {
    phase: "Phase 0",
    title: "사전 조사 (게이트)",
    period: "W1",
    status: "in-progress",
    tasks: [
      "Orbitron 기존 배포 파이프라인 내부 구조 조사 (훅 포인트 식별)",
      "UE5 PixelStreaming2 멀티 스트리머 모드 검증 (단일 프로세스 6 독립 WebRTC 스트림)",
      "Wilbur 시그널링 서버 관리 API 범위 조사",
      "Cloudflare API 토큰 권한 확인 (DNS 쓰기 + Tunnel ingress 수정)",
      "GPU 서버 (twinverse-ai 192.168.219.117) Docker + NVIDIA runtime 가용성 확인",
    ],
  },
  {
    phase: "Phase 0.5",
    title: "Twinverse UE5 템플릿 v1 (Track A — 내부)",
    period: "W2 - W4",
    status: "planned",
    tasks: [
      "UE5 5.7.4 C++ 프로젝트 + PixelStreaming2 / OnlineSubsystem / EnhancedInput / Voice 플러그인",
      "Listen Server 모드 + GameMode / PlayerController / Character 스캐폴딩",
      "OfficeMain.umap + NavMesh + 기본 콜리전 (13단계 office-map-spec 준수)",
      "WASD 이동 + 점프 + 카메라 (Enhanced Input, 리플리케이션)",
      "닉네임 UMG 머리 위 표시 + 서버 복제",
      "인게임 채팅 (Server RPC → Multicast)",
      "공간 음성 채팅 (OnlineSubsystemVoice 또는 WebRTC mesh — 조사 후 선택)",
      "이모트 AnimMontage + 복제",
      "의자 상호작용 (Interactable interface)",
      "어드민 HTTP 엔드포인트 (Kick/Mute) — C++ HttpListener",
      "AI NPC 10명 통합 (OfficeNPCConversation → twinverse-ai Ollama)",
    ],
  },
  {
    phase: "Phase 1 ~ 2",
    title: "슬롯 DB + 업로드 파이프라인 (Orbitron, Track B)",
    period: "W3 - W5",
    status: "planned",
    tasks: [
      "PostgreSQL 스키마: ps_slot_templates / ps_slots / ps_versions / ps_sessions",
      "슬롯 CRUD API + 관리 UI (관리자 전용)",
      "tus.io 재개 가능 업로드 (단일 zip 최대 20 GB)",
      "템플릿 manifest.json 추출 + 버전 증가 + SSE 진행률 이벤트",
      "owner_user_id / tenant_id / pinned — Phase C (SaaS) 대비 선예약 필드",
    ],
  },
  {
    phase: "Phase 3 ~ 4",
    title: "Docker 빌드 + 원격 배포 + 활성화",
    period: "W5 - W7",
    status: "planned",
    tasks: [
      "템플릿별 Dockerfile (nvidia/cuda:12.6.0-base + UE5 런타임)",
      "Orbitron → GPU 서버 imageBuilder + 원격 전송 파이프라인",
      "슬롯 루트 /opt/ps-slots/<slot>/versions/v<N>/ 구조 + current 심볼릭 링크",
      "Atomic symlink swap 활성화 + 3-version 롤백",
      "Cloudflare DNS + Tunnel ingress 자동 등록 (SIGHUP reload)",
    ],
  },
  {
    phase: "Phase 5",
    title: "런타임 · 큐 · 세션 (Track B)",
    period: "W7 - W9",
    status: "planned",
    tasks: [
      "On-demand UE5 컨테이너 기동/종료 (유휴 시 자원 반환)",
      "Wilbur 시그널링 서버 연동 + 뷰포트별 WebRTC peer",
      "슬롯당 최대 6명 제한 + FIFO 대기열 (SSE 이벤트)",
      "Join / Heartbeat / Leave API + ghost session sweeper",
      "HMAC 서명 게스트 링크 + 로그인/게스트 하이브리드 식별",
      "어드민 Kick / Mute 프록시 (UE5 템플릿 어드민 엔드포인트 호출)",
    ],
  },
  {
    phase: "Phase 6",
    title: "사용자 UI",
    period: "W9 - W10",
    status: "planned",
    tasks: [
      "슬롯 카탈로그 페이지 (Office / Modern / NYC 카드)",
      "세션 페이지: 스트림 뷰 + 대기열 위치 + 재접속 보정",
      "게스트 링크 발급 UI (관리자)",
      "버전 이력 + 롤백 UI",
    ],
  },
  {
    phase: "Phase 7",
    title: "기존 임시본 마이그레이션",
    period: "W10 - W11",
    status: "planned",
    tasks: [
      "기존 project 27 (twinverse-ps2) → 신규 office 슬롯으로 마이그레이션",
      "ps2.twinverse.org → ps.twinverse.org/office 리다이렉트",
      "/opt/twinverse-ps2/ 정리",
      "E2E 테스트 (6인 동시 접속 + NPC 대화 + 채팅 + 음성)",
    ],
  },
];

const COMPARE_ITEMS = [
  { feature: "멀티플레이 모델", old: "Dedicated Server + 사용자당 UE5 클라 프로세스", now: "Listen Server + 단일 UE5 프로세스 6 뷰포트" },
  { feature: "동시접속 상한", old: "200+ (이론)", now: "슬롯당 6명 + FIFO 대기열 (Phase B 현실 목표)" },
  { feature: "GPU 자원", old: "6명 = RTX 3090 2장+", now: "6명 = RTX 3090 1장 (VRAM ~10 GB)" },
  { feature: "프로세스 수", old: "N+1 (DS + 클라 N)", now: "1 (호스트 = 서버 겸 플레이어)" },
  { feature: "입장 지연", old: "~10초 (클라 프로세스 부팅)", now: "~1초 (뷰포트 추가)" },
  { feature: "AI NPC LLM", old: "Anthropic / OpenAI 외부 API 직접 호출", now: "twinverse-ai Ollama (gemma3:12b) 1차, 외부 폴백" },
  { feature: "배포 단위", old: "단일 프로젝트 (수작업 배포)", now: "Orbitron 슬롯 파이프라인 (템플릿 업로드 → atomic swap)" },
  { feature: "UE 버전", old: "5.5", now: "5.7.4" },
  { feature: "식별 체계", old: "JWT 로그인만", now: "로그인 + HMAC 서명 게스트 링크 하이브리드" },
  { feature: "롤백", old: "수동", now: "3-version symlink 원자적 되돌리기" },
];

const ARCHITECTURE = [
  {
    layer: "프론트엔드",
    tech: "React 19 + Vite 6 + WebRTC",
    desc: "슬롯 카탈로그 + 세션 페이지. WebRTC 로 UE5 PixelStreaming2 에 직접 연결, 대기열 상태는 SSE 로 수신.",
  },
  {
    layer: "Orbitron API (Track B)",
    tech: "Node.js + PostgreSQL",
    desc: "슬롯 CRUD, tus 업로드, 버전 관리, 빌드 파이프라인, 원격 배포, 큐/세션 DAO. 모든 상태 변경은 atomic, 역연산 가능.",
  },
  {
    layer: "UE5 런타임 (Track A)",
    tech: "UE5 5.7.4 Listen Server + PixelStreaming2 멀티 스트리머",
    desc: "단일 프로세스가 호스트(서버) + 플레이어0 겸임. 뷰포트 0~5 각각 독립 WebRTC 스트림. 슬롯별 Docker 컨테이너로 on-demand 기동.",
  },
  {
    layer: "시그널링",
    tech: "Wilbur (Epic PixelStreamingInfrastructure)",
    desc: "슬롯당 1개 Wilbur 인스턴스, 6 뷰포트 peer 등록. 세션 시작/종료 API 로 Orbitron 과 연동.",
  },
  {
    layer: "AI 게이트웨이",
    tech: "twinverse-ai 192.168.219.117 Ollama",
    desc: "NPC 대화 1차: Ollama gemma3:12b (로컬, 무료). 폴백: Anthropic Claude (필요 시). OpenAI / Gemini 는 선택적. ai-shared-registry SSOT 준수.",
  },
  {
    layer: "네트워크",
    tech: "Cloudflare Tunnel + ps.twinverse.org/*",
    desc: "슬롯별 서브경로 ingress 자동 등록, SIGHUP reload 로 무중단 반영. DNS 쓰기 토큰은 Orbitron secrets.",
  },
  {
    layer: "GPU 서버",
    tech: "Threadripper 3970X + RTX 3090 24GB + Ubuntu 22.04",
    desc: "Docker + NVIDIA runtime. 슬롯 루트 /opt/ps-slots/<slot>/current/. Ollama(11434) 는 기존 공유 자원 유지.",
  },
];

const UE_FEATURES = [
  {
    title: "PixelStreaming2 멀티 스트리머",
    desc: "단일 UE5 프로세스가 다수 독립 WebRTC 스트림을 동시 송출하는 모드. 렌더 씬 1회 계산을 여러 뷰포트가 공유해 GPU 자원을 1/3~1/6 수준으로 절감. 슬롯당 최대 6명 수용.",
  },
  {
    title: "Listen Server 모드",
    desc: "UE5 표준 멀티플레이의 호스트 권위 모델. 단일 프로세스 안에서 서버 + 플레이어0 을 동시 담당. Twinverse 는 호스트를 시스템 관리 프로세스로 운영하므로 호스트 이탈 이슈는 비해당.",
  },
  {
    title: "Enhanced Input + Replication",
    desc: "WASD · 점프 · 카메라 · 상호작용 입력을 Enhanced Input 으로 관리. 캐릭터 위치/회전/애니메이션은 Replication 으로 6 플레이어 전체 동기화, AnimMontage 이모트도 Multicast RPC.",
  },
  {
    title: "공간 음성 채팅",
    desc: "근접 거리 감쇠 공간 음향. OnlineSubsystemVoice 또는 WebRTC mesh 중 조사 후 선택 (Phase 0).",
  },
  {
    title: "AI NPC 10명",
    desc: "슬롯당 NPC 최대 10명. UOfficeNPCConversation ActorComponent 가 Server RPC 로 메시지 수신 → backend /api/npc/chat HTTP 호출 → Ollama(gemma3:12b) 응답 → Multicast 로 말풍선/채팅 표시. 히스토리 20턴, 쿨다운 2초.",
  },
  {
    title: "어드민 제어",
    desc: "UE5 컨테이너가 HTTP 엔드포인트 (Kick/Mute) 노출. Orbitron public-api 가 이를 프록시해 관리자 UI 에서 호출.",
  },
  {
    title: "의자 / 상호작용",
    desc: "Interactable interface 기반 의자 착석, 테이블 오브젝트 조작. 착석 상태는 리플리케이션되어 모든 플레이어에게 일관 표시.",
  },
  {
    title: "세션 하트비트 + 유령 세션 청소",
    desc: "클라이언트가 5초마다 heartbeat. 30초 무응답은 ghost sweeper 가 자동 퇴장 처리. 대기열 자동 승격 (SELECT ... FOR UPDATE atomic).",
  },
];

const KPI_TARGETS = [
  { metric: "슬롯당 동시접속", target: "6", unit: "명" },
  { metric: "평균 대기 시간", target: "<30", unit: "초" },
  { metric: "PixelStreaming 지연", target: "<100", unit: "ms" },
  { metric: "입장 시간", target: "~1", unit: "초" },
  { metric: "AI NPC 응답", target: "<3", unit: "초" },
  { metric: "GPU 1장 수용 슬롯", target: "3", unit: "슬롯" },
  { metric: "롤백 버전 수", target: "3", unit: "버전" },
  { metric: "가용성", target: "99.9", unit: "%" },
];

const TRACK_SPLIT = [
  {
    track: "Track A — 내부 (Steven + Claude @ TwinverseAI)",
    scope: "UE5 5.7.4 멀티플레이어 템플릿 v1 제작",
    items: [
      "Listen Server + 6 뷰포트 스캐폴딩",
      "캐릭터 / WASD / 닉네임 / 채팅 / 음성 / 이모트 / 의자",
      "AI NPC 10명 (Ollama 연결)",
      "어드민 HTTP 엔드포인트 (Kick/Mute)",
      "OfficeMain.umap 맵 제작",
    ],
  },
  {
    track: "Track B — 외부 AI (Orbitron 개발자)",
    scope: "Orbitron 배포 파이프라인 + 런타임 플랫폼",
    items: [
      "슬롯 DB + CRUD + 관리 UI",
      "tus 업로드 + 빌드 파이프라인",
      "원격 배포 + atomic 활성화 + 3-version 롤백",
      "큐 / 세션 / 하트비트 / 게스트 링크",
      "Cloudflare DNS · Tunnel 자동화",
      "사용자 UI (카탈로그 · 세션 페이지)",
    ],
  },
];

export default function DeskPlan() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>TwinverseDesk Development Plan — Phase B (2026-04-15 개정)</span>
        <h1 className={styles.title}>TwinverseDesk 개발계획</h1>
        <p className={styles.subtitle}>
          Unreal Engine 5.7.4 Pixel Streaming 2 기반 멀티플레이어 가상 오피스 플랫폼.
          단일 UE5 프로세스가 6 뷰포트를 동시 송출하는 Listen Server 모델로 GPU 자원을 절감하고,
          Orbitron 슬롯 파이프라인으로 템플릿 단위 배포를 자동화합니다.
        </p>
      </header>

      {/* 비전 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>비전</h2>
        <div className={styles.visionBox}>
          <blockquote className={styles.vision}>
            "웹 브라우저에서 접속하는 멀티플레이어 3D 가상 오피스.<br/>
            RTX 3090 1장으로 3 슬롯 동시 서비스.<br/>
            <strong>AI NPC 와 함께하는 1인 기업형 업무 환경</strong>을 만듭니다."
          </blockquote>
        </div>
      </section>

      {/* KPI */}
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

      {/* 피벗 비교 (기존 → 현재) */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>이전 계획 vs 현재 계획 (2026-04-15 피벗)</h2>
        <p className={styles.sectionDesc}>
          GPU 자원 한계와 Orbitron 파이프라인 통합 요구에 맞춰 멀티플레이어 모델과 AI 백엔드를 재설계했습니다.
        </p>
        <div className={styles.compareTable}>
          <div className={`${styles.compareRow} ${styles.compareHeader}`}>
            <span>항목</span>
            <span>이전</span>
            <span>현재</span>
          </div>
          {COMPARE_ITEMS.map((c, i) => (
            <div key={i} className={styles.compareRow}>
              <span className={styles.compareFeature}>{c.feature}</span>
              <span className={styles.comparOld}>{c.old}</span>
              <span className={styles.compareNew}>{c.now}</span>
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

      {/* UE5 핵심 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>UE5 5.7.4 핵심 기능</h2>
        <p className={styles.sectionDesc}>
          Listen Server + PixelStreaming2 멀티 스트리머 조합으로 단일 GPU 1장에서 슬롯당 6 플레이어를 경제적으로 수용합니다.
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

      {/* Track A/B 책임 분리 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>작업 트랙 분리</h2>
        <p className={styles.sectionDesc}>
          UE5 템플릿 제작(Track A)은 내부에서, Orbitron 배포 파이프라인(Track B)은 외부 AI 가 담당합니다. 두 트랙은 템플릿 zip 샘플 · manifest 스펙 · 어드민 HTTP 계약만 공유합니다.
        </p>
        <div className={styles.archGrid}>
          {TRACK_SPLIT.map((t) => (
            <div key={t.track} className={styles.archCard}>
              <div className={styles.archHeader}>
                <h3 className={styles.archLayer}>{t.track}</h3>
                <code className={styles.archTech}>{t.scope}</code>
              </div>
              <ul className={styles.phaseTasks}>
                {t.items.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 로드맵 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>개발 로드맵 (Phase 0 ~ 7)</h2>
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

      {/* 후속 Phase C 예고 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Phase C (후속)</h2>
        <p className={styles.sectionDesc}>
          Phase B 완료 후: 멀티 테넌시 · 사용자별 격리 · 결제. 스키마에는 owner_user_id / tenant_id / pinned 필드가 이미 선예약돼 있어 Phase C 진입 시 스키마 변경 없이 정책만 추가됩니다.
        </p>
      </section>
    </div>
  );
}
