import { useState } from "react";
import styles from "./AdminSkills.module.css";

const SKILL_CATEGORIES = [
  {
    title: "프로젝트 관리",
    desc: "세션 시작/종료, 프로젝트 초기화, 문서 자동 업데이트 등 개발 워크플로우 자동화 스킬",
    skills: [
      {
        name: "start",
        command: "/start",
        desc: "새 작업 세션 시작 — 프로젝트 컨텍스트 자동 로드",
        features: [
          "git status, 최근 커밋, 브랜치 상태 자동 파악",
          "CLAUDE.md, docs/ 문서 자동 읽기",
          "이전 세션 작업 내역 요약 표시",
        ],
        usage: "세션 시작 시 /start 입력. AI가 프로젝트 현재 상태를 파악하고 이전 작업을 이어갈 준비를 합니다.",
      },
      {
        name: "end",
        command: "/end",
        desc: "작업 세션 종료 — 프로젝트 문서 자동 업데이트, 커밋, 요약 보고",
        features: [
          "git log 분석으로 작업 내역 자동 분류 (feat/fix/style/docs)",
          "docs/work-log.md, bugfix-log.md, upgrade-log.md, dev-plan.md 자동 업데이트",
          "변경사항 자동 커밋 & 푸시",
          "세션 종료 보고서 생성 (다음 세션 추천 작업 포함)",
        ],
        usage: "작업 완료 후 /end 입력. 문서 업데이트 → 커밋 → 푸시 → 요약 보고까지 자동 수행됩니다.",
      },
      {
        name: "init",
        command: "/init",
        desc: "프로젝트 초기 세팅 — 전체 풀스택 프로젝트를 원클릭으로 생성",
        features: [
          "Git 초기화 (main 브랜치)",
          "FastAPI 백엔드 (JWT 인증, CRUD API, 파일 업로드)",
          "React + Vite 프론트엔드 (라우팅, 레이아웃, 페이지 16종)",
          "커뮤니티 게시판 4종 (공지사항, Q&A, 갤러리, 동영상)",
          "어드민 대시보드 (사용자/게시판 관리, 스킬/플러그인 뷰어, 문서 뷰어)",
          "Dark Glass Neon 디자인 시스템 (22개 CSS 모듈)",
          "멀티스테이지 Dockerfile (Orbitron 배포용)",
          "프로젝트 문서 초기화 (dev-plan.md, work-log.md 등)",
        ],
        usage: "빈 디렉토리에서 /init 입력. 전체 프로젝트가 자동 생성됩니다.",
      },
      {
        name: "project-start",
        command: "/project-start",
        desc: "원스톱 프로젝트 부트스트랩 — /init → MCP 세팅 → /end 까지 자동 실행",
        features: [
          "/init 스킬 자동 호출",
          "MCP 서버 템플릿 자동 머지 (settings.local.json)",
          "/end 스킬로 초기 문서 생성 & 커밋",
        ],
        usage: "완전 새 프로젝트 시작 시 /project-start 입력. 모든 초기 세팅이 한 번에 완료됩니다.",
      },
    ],
  },
  {
    title: "디자인 & UX",
    desc: "UI 디자인, 애니메이션, 레이아웃, 접근성 등 프론트엔드 품질 향상 스킬",
    skills: [
      {
        name: "frontend-design",
        command: "/frontend-design",
        desc: "프로덕션급 프론트엔드 인터페이스 생성 — 창의적이고 세련된 디자인",
        features: [
          "페이지/컴포넌트 신규 생성 시 고품질 디자인 자동 적용",
          "프로젝트 디자인 시스템(global.css) 자동 참조",
          "반응형 레이아웃, 접근성, 다크모드 고려",
        ],
        usage: "새 페이지나 컴포넌트를 만들 때 /frontend-design 입력. 디자인 시스템에 맞는 고품질 UI가 생성됩니다.",
      },
      {
        name: "animate",
        command: "/animate",
        desc: "애니메이션, 마이크로 인터랙션, 모션 효과 추가",
        features: [
          "hover/focus/active 상태 전환 애니메이션",
          "스크롤 기반 reveal 효과",
          "로딩/성공/에러 상태 전환 모션",
        ],
        usage: "기존 컴포넌트에 생동감을 더할 때 /animate 입력.",
      },
      {
        name: "arrange",
        command: "/arrange",
        desc: "레이아웃, 간격, 시각적 리듬 개선",
        features: [
          "그리드 레이아웃 최적화",
          "간격 일관성 보정",
          "시각적 계층 구조 강화",
        ],
        usage: "레이아웃이 어색하거나 간격이 불균일할 때 /arrange 입력.",
      },
      {
        name: "adapt",
        command: "/adapt",
        desc: "반응형 디자인 — 다양한 화면 크기, 디바이스, 플랫폼 대응",
        features: [
          "브레이크포인트 설정 및 미디어 쿼리 적용",
          "유동적 레이아웃 및 터치 타겟 최적화",
          "모바일/태블릿/데스크톱 대응",
        ],
        usage: "반응형 대응이 필요할 때 /adapt 입력.",
      },
      {
        name: "audit",
        command: "/audit",
        desc: "접근성, 성능, 테마, 반응형 등 기술 품질 감사",
        features: [
          "WCAG 접근성 체크",
          "성능 지표 분석",
          "P0~P3 심각도 등급 보고서 생성",
        ],
        usage: "배포 전 품질 점검 시 /audit 입력. 점수와 개선 계획이 생성됩니다.",
      },
      {
        name: "critique",
        command: "/critique",
        desc: "UX 관점 디자인 평가 — 시각 계층, 정보 아키텍처, 인지 부하 분석",
        features: [
          "정량적 점수 산출",
          "페르소나 기반 테스트",
          "실행 가능한 피드백 제공",
        ],
        usage: "디자인 리뷰가 필요할 때 /critique 입력.",
      },
      {
        name: "polish",
        command: "/polish",
        desc: "출시 전 최종 품질 패스 — 정렬, 간격, 일관성, 마이크로 디테일 수정",
        features: [
          "서브픽셀 정렬 보정",
          "토큰 일관성 확인",
          "마이크로 디테일 수정",
        ],
        usage: "배포 직전 마무리 다듬기 시 /polish 입력.",
      },
      {
        name: "bolder",
        command: "/bolder",
        desc: "밋밋한 디자인에 시각적 임팩트 추가",
        features: ["대비 강화", "타이포그래피 임팩트", "컬러 포인트 추가"],
        usage: "디자인이 너무 심심할 때 /bolder 입력.",
      },
      {
        name: "quieter",
        command: "/quieter",
        desc: "과도한 디자인을 차분하게 톤 다운",
        features: ["강도 감소", "여백 확대", "색상 절제"],
        usage: "디자인이 너무 자극적일 때 /quieter 입력.",
      },
      {
        name: "colorize",
        command: "/colorize",
        desc: "단조로운 UI에 전략적 컬러 추가",
        features: ["색상 팔레트 확장", "의미 있는 컬러 코딩", "그라디언트 적용"],
        usage: "화면이 너무 단색일 때 /colorize 입력.",
      },
      {
        name: "typeset",
        command: "/typeset",
        desc: "타이포그래피 개선 — 폰트, 계층, 크기, 가독성 최적화",
        features: ["폰트 선택 최적화", "텍스트 계층 구조 정리", "줄간격/자간 보정"],
        usage: "텍스트가 읽기 어렵거나 계층이 불분명할 때 /typeset 입력.",
      },
      {
        name: "clarify",
        command: "/clarify",
        desc: "UX 카피 개선 — 에러 메시지, 레이블, 안내문 명확화",
        features: ["에러 메시지 개선", "버튼/레이블 텍스트 최적화", "안내문 재작성"],
        usage: "사용자가 혼란스러워할 수 있는 텍스트가 있을 때 /clarify 입력.",
      },
      {
        name: "delight",
        command: "/delight",
        desc: "인터페이스에 즐거움과 개성 추가",
        features: ["마이크로 인터랙션", "이스터 에그", "개성 있는 빈 상태 디자인"],
        usage: "기능은 완성됐지만 재미가 부족할 때 /delight 입력.",
      },
      {
        name: "distill",
        command: "/distill",
        desc: "불필요한 복잡성 제거 — 디자인 본질만 남기기",
        features: ["불필요한 요소 제거", "정보 밀도 최적화", "핵심 기능 강조"],
        usage: "화면이 너무 복잡하거나 요소가 많을 때 /distill 입력.",
      },
      {
        name: "extract",
        command: "/extract",
        desc: "재사용 가능한 컴포넌트, 디자인 토큰, 패턴 추출",
        features: ["반복 패턴 컴포넌트화", "디자인 토큰 추출", "디자인 시스템 보강"],
        usage: "코드에 반복되는 UI 패턴이 있을 때 /extract 입력.",
      },
      {
        name: "harden",
        command: "/harden",
        desc: "프로덕션 준비 — 에러 핸들링, i18n, 텍스트 오버플로우, 엣지 케이스",
        features: ["에러 상태 UI 추가", "긴 텍스트 오버플로우 처리", "i18n 대응 준비"],
        usage: "프로덕션 배포 전 견고성 강화 시 /harden 입력.",
      },
      {
        name: "normalize",
        command: "/normalize",
        desc: "디자인 시스템 표준에 맞게 UI 재정렬",
        features: ["토큰 불일치 수정", "스타일 드리프트 보정", "일관성 복원"],
        usage: "여러 사람이 작업 후 스타일이 불일치할 때 /normalize 입력.",
      },
      {
        name: "onboard",
        command: "/onboard",
        desc: "온보딩 플로우, 빈 상태, 최초 실행 경험 디자인",
        features: ["단계별 온보딩 가이드", "빈 상태 디자인", "첫 사용자 경험 최적화"],
        usage: "신규 사용자 경험을 개선하고 싶을 때 /onboard 입력.",
      },
      {
        name: "optimize",
        command: "/optimize",
        desc: "UI 성능 최적화 — 로딩 속도, 렌더링, 번들 크기",
        features: ["불필요한 리렌더 제거", "이미지 최적화", "코드 스플리팅 적용"],
        usage: "화면이 느리거나 버벅거릴 때 /optimize 입력.",
      },
      {
        name: "overdrive",
        command: "/overdrive",
        desc: "기술적으로 야심찬 구현 — 셰이더, 스프링 물리, 60fps 애니메이션",
        features: ["WebGL/셰이더 효과", "스프링 기반 물리 애니메이션", "스크롤 기반 리빌"],
        usage: "와우 팩터가 필요한 프레젠테이션/랜딩 페이지에 /overdrive 입력.",
      },
      {
        name: "teach-impeccable",
        command: "/teach-impeccable",
        desc: "프로젝트 디자인 컨텍스트를 AI 설정 파일에 저장 (1회 실행)",
        features: ["프로젝트 디자인 가이드라인 분석", "AI 설정 파일에 영구 저장", "이후 모든 디자인 스킬에 자동 적용"],
        usage: "프로젝트 초기에 1번 /teach-impeccable 실행. 이후 모든 디자인 작업에 프로젝트 컨텍스트가 자동 반영됩니다.",
      },
    ],
  },
  {
    title: "코드 품질 & 워크플로우",
    desc: "공식 플러그인 기반 코드 리뷰, 코드 단순화 등 개발 품질 관리 스킬",
    skills: [
      {
        name: "simplify",
        command: "/simplify",
        desc: "변경된 코드의 재사용성, 품질, 효율성을 검토하고 개선",
        features: [
          "중복 코드 발견 및 통합",
          "복잡한 로직 단순화",
          "성능 개선 포인트 식별",
        ],
        usage: "코드 작성 후 /simplify 입력. 개선 가능한 부분을 찾아 수정합니다.",
      },
      {
        name: "code-review",
        command: "/code-review",
        desc: "PR 코드 리뷰 — superpowers 플러그인 기반",
        features: [
          "PR diff 자동 분석",
          "버그, 보안 취약점, 성능 이슈 식별",
          "코딩 컨벤션 준수 여부 확인",
        ],
        usage: "PR 생성 후 /code-review 입력. 상세한 리뷰 피드백을 받습니다.",
      },
    ],
  },
];

export default function AdminSkills() {
  const [openSkill, setOpenSkill] = useState(null);

  const toggle = (name) => setOpenSkill(openSkill === name ? null : name);

  const totalSkills = SKILL_CATEGORIES.reduce((sum, cat) => sum + cat.skills.length, 0);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <span className={styles.overline}>Claude Code Skills</span>
        <h1 className={styles.title}>AI 스킬 ({totalSkills})</h1>
        <p className={styles.headerDesc}>
          이 프로젝트에 설치된 모든 Claude Code 스킬 목록입니다. 슬래시 커맨드(<code>/명령어</code>)로 실행합니다.
        </p>
      </div>

      {SKILL_CATEGORIES.map((cat) => (
        <section key={cat.title} className={styles.category}>
          <div className={styles.catHeader}>
            <h2 className={styles.catTitle}>{cat.title}</h2>
            <span className={styles.catCount}>{cat.skills.length}개</span>
          </div>
          <p className={styles.catDesc}>{cat.desc}</p>

          <ul className={styles.list}>
            {cat.skills.map((skill, i) => (
              <li key={skill.name} className={styles.item}>
                <button onClick={() => toggle(skill.name)} className={styles.skillBtn}>
                  <span className={styles.skillIndex}>{String(i + 1).padStart(2, "0")}</span>
                  <div className={styles.skillBody}>
                    <span className={styles.skillName}>
                      {skill.name}
                      <code className={styles.command}>{skill.command}</code>
                    </span>
                    <span className={styles.skillShort}>{skill.desc}</span>
                  </div>
                  <span className={`${styles.skillChevron} ${openSkill === skill.name ? styles.skillChevronOpen : ""}`}>
                    ▼
                  </span>
                </button>
                {openSkill === skill.name && (
                  <div className={styles.detail}>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailLabel}>주요 기능</h4>
                      <ul className={styles.featureList}>
                        {skill.features.map((f, j) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailLabel}>사용법</h4>
                      <p className={styles.usageText}>{skill.usage}</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
