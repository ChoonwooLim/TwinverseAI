import { useState } from "react";
import styles from "./AdminPlugins.module.css";

const PLUGIN_CATEGORIES = [
  {
    title: "공식 플러그인",
    desc: "Claude Code에 설치된 공식 플러그인 (settings.json)",
    plugins: [
      {
        name: "superpowers",
        displayName: "Superpowers",
        source: "claude-plugins-official",
        desc: "고급 개발 워크플로우 자동화 — 브레인스토밍, 계획 수립, 코드 리뷰, 디버깅, TDD 등",
        features: [
          "brainstorming: 창의적 작업 전 아이디어 발산 및 구조화",
          "writing-plans: 다단계 작업의 구현 계획 수립",
          "executing-plans: 계획을 체크포인트 기반으로 단계별 실행",
          "code-review: PR 코드 리뷰 및 피드백",
          "systematic-debugging: 체계적 버그 추적 및 수정",
          "test-driven-development: TDD 기반 개발 가이드",
          "verification-before-completion: 작업 완료 전 검증",
          "dispatching-parallel-agents: 독립 작업 병렬 실행",
          "using-git-worktrees: Git worktree 기반 격리 작업",
        ],
        usage: "자동 활성화됨. 복잡한 작업 시 AI가 자동으로 적절한 워크플로우를 선택합니다.",
        requiresKey: false,
      },
      {
        name: "code-review",
        displayName: "Code Review",
        source: "claude-plugins-official",
        desc: "PR 단위 코드 리뷰 — 변경사항 분석, 버그/보안 이슈 식별, 컨벤션 검사",
        features: [
          "PR diff 자동 분석 및 라인별 코멘트",
          "보안 취약점 및 성능 이슈 식별",
          "코딩 컨벤션 및 베스트 프랙티스 준수 확인",
        ],
        usage: "/code-review 명령으로 현재 PR을 리뷰합니다.",
        requiresKey: false,
      },
      {
        name: "github",
        displayName: "GitHub",
        source: "claude-plugins-official",
        desc: "GitHub 통합 — Issue, PR, 리포지토리 관리를 AI가 직접 수행",
        features: [
          "Issue 생성/조회/수정",
          "PR 생성/리뷰/머지",
          "리포지토리 정보 조회",
        ],
        usage: "'이슈 만들어줘', 'PR 리뷰해줘' 등으로 사용. gh auth 토큰 필요.",
        requiresKey: false,
      },
      {
        name: "figma",
        displayName: "Figma",
        source: "claude-plugins-official",
        desc: "Figma 디자인 통합 — 디자인을 코드로 변환, 디자인 시스템 생성",
        features: [
          "Figma 디자인을 프로덕션 코드로 1:1 변환",
          "디자인 시스템 규칙 자동 생성",
          "Code Connect 템플릿 관리",
          "컴포넌트 라이브러리 생성",
        ],
        usage: "/figma-implement-design으로 디자인을 코드로 변환합니다. Figma 인증 필요.",
        requiresKey: false,
      },
    ],
  },
  {
    title: "MCP 서버",
    desc: "Model Context Protocol 기반 외부 도구 서버 (settings.local.json)",
    plugins: [
      {
        name: "context7",
        displayName: "Context7",
        source: "@upstash/context7-mcp",
        desc: "라이브러리 최신 문서 실시간 조회 — React, FastAPI, SQLModel 등",
        features: [
          "npm/PyPI 라이브러리의 최신 공식 문서 조회",
          "API 변경사항 자동 반영",
          "코드 작성 시 최신 사용법 자동 참조",
        ],
        usage: "자동 활성화. 코드 작성 시 AI가 최신 API 문서를 자동 참조합니다.",
        requiresKey: false,
      },
      {
        name: "github-mcp",
        displayName: "GitHub (MCP)",
        source: "@modelcontextprotocol/server-github",
        desc: "GitHub API 직접 접근 — Issue, PR, 리포지토리 조작",
        features: [
          "Issue/PR CRUD 및 검색",
          "리포지토리 파일 읽기/쓰기",
          "GitHub Actions 관리",
        ],
        usage: "GitHub 관련 작업 시 자동 활용. GITHUB_PERSONAL_ACCESS_TOKEN 필요.",
        requiresKey: true,
        keyName: "GITHUB_PERSONAL_ACCESS_TOKEN",
      },
      {
        name: "postgres",
        displayName: "PostgreSQL",
        source: "@modelcontextprotocol/server-postgres",
        desc: "프로젝트 DB 직접 쿼리 — 스키마 조회, 데이터 확인, 디버깅",
        features: [
          "테이블 스키마 자동 조회",
          "SELECT/INSERT/UPDATE 쿼리 실행",
          "데이터 무결성 확인",
        ],
        usage: "'DB에서 사용자 테이블 확인해줘', '최근 데이터 조회해줘' 등. DATABASE_URL 필요.",
        requiresKey: true,
        keyName: "DATABASE_URL",
      },
      {
        name: "puppeteer",
        displayName: "Puppeteer",
        source: "@modelcontextprotocol/server-puppeteer",
        desc: "헤드리스 브라우저 제어 — 스크린샷, UI 테스트, 웹 스크래핑",
        features: [
          "페이지 스크린샷 캡처",
          "폼 자동 입력 및 클릭",
          "DOM 요소 추출 및 분석",
        ],
        usage: "'로그인 페이지 스크린샷 찍어줘', '이 URL 데이터 가져와줘' 등.",
        requiresKey: false,
      },
      {
        name: "sequential-thinking",
        displayName: "Sequential Thinking",
        source: "@modelcontextprotocol/server-sequential-thinking",
        desc: "복잡한 문제 단계별 추론 — 체계적 분해 및 논리적 사고 강화",
        features: [
          "복잡한 아키텍처 설계 지원",
          "다단계 디버깅 추론",
          "의사결정 트리 분석",
        ],
        usage: "자동 활성화. 복잡한 문제 해결 시 AI가 단계별로 사고합니다.",
        requiresKey: false,
      },
      {
        name: "memory",
        displayName: "Memory",
        source: "@modelcontextprotocol/server-memory",
        desc: "지식 그래프 기반 장기 기억 — 대화 간 맥락 유지",
        features: [
          "엔티티/관계 기반 지식 저장",
          "이전 대화 맥락 자동 복원",
          "프로젝트 히스토리 추적",
        ],
        usage: "'이거 기억해줘', '지난번에 말한 거 뭐였지?' 등.",
        requiresKey: false,
      },
      {
        name: "brave-search",
        displayName: "Brave Search",
        source: "@modelcontextprotocol/server-brave-search",
        desc: "웹 검색 — 최신 정보, 에러 해결법, 문서 실시간 조회",
        features: [
          "프라이버시 중심 웹 검색",
          "에러 메시지 검색 및 해결법 제안",
          "최신 기술 문서 조회",
        ],
        usage: "'이 에러 검색해줘', 'React 19 변경사항 찾아줘' 등. BRAVE_API_KEY 필요.",
        requiresKey: true,
        keyName: "BRAVE_API_KEY",
      },
      {
        name: "filesystem",
        displayName: "Filesystem",
        source: "@modelcontextprotocol/server-filesystem",
        desc: "확장 파일 시스템 조작 — 검색, 이동, 복사, 디렉토리 트리",
        features: [
          "파일/디렉토리 검색 및 탐색",
          "파일 이동/복사/이름변경",
          "디렉토리 트리 시각화",
        ],
        usage: "파일 관련 복잡한 작업 시 자동 활용.",
        requiresKey: false,
      },
      {
        name: "fetch",
        displayName: "Fetch",
        source: "@modelcontextprotocol/server-fetch",
        desc: "외부 HTTP API 호출 — 웹페이지 내용 가져오기, REST API 테스트",
        features: [
          "GET/POST/PUT/DELETE 요청",
          "웹페이지 내용 추출",
          "API 응답 분석",
        ],
        usage: "'이 API 호출해줘', '이 URL 내용 확인해줘' 등.",
        requiresKey: false,
      },
      {
        name: "docker",
        displayName: "Docker",
        source: "@modelcontextprotocol/server-docker",
        desc: "Docker 관리 — 이미지 빌드, 컨테이너 실행/중지, 로그 조회",
        features: [
          "Docker 이미지 빌드/풀",
          "컨테이너 실행/중지/재시작",
          "컨테이너 로그 실시간 조회",
        ],
        usage: "'도커 컨테이너 목록', '이미지 빌드해줘', '로그 확인해줘' 등.",
        requiresKey: false,
      },
    ],
  },
];

export default function AdminPlugins() {
  const [openPlugin, setOpenPlugin] = useState(null);

  const toggle = (name) => setOpenPlugin(openPlugin === name ? null : name);

  const totalPlugins = PLUGIN_CATEGORIES.reduce((sum, cat) => sum + cat.plugins.length, 0);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <span className={styles.overline}>MCP Plugins & Servers</span>
        <h1 className={styles.title}>플러그인 ({totalPlugins})</h1>
        <p className={styles.headerDesc}>
          Claude Code에 설치된 공식 플러그인 및 MCP 서버 목록입니다. 대부분 자동 활성화되며, 일부는 API 키가 필요합니다.
        </p>
      </div>

      {PLUGIN_CATEGORIES.map((cat) => (
        <section key={cat.title} className={styles.section}>
          <div className={styles.catHeader}>
            <h2 className={styles.catTitle}>{cat.title}</h2>
            <span className={styles.catCount}>{cat.plugins.length}개</span>
          </div>
          <p className={styles.catDesc}>{cat.desc}</p>

          <div className={styles.grid}>
            {cat.plugins.map((plugin) => (
              <div
                key={plugin.name}
                className={`${styles.card} ${openPlugin === plugin.name ? styles.cardOpen : ""}`}
                onClick={() => toggle(plugin.name)}
              >
                <div className={`${styles.cardStatusRule} ${plugin.requiresKey ? styles.notConfigured : styles.isConfigured}`} />
                <div className={styles.cardTop}>
                  <h3 className={styles.cardName}>{plugin.displayName}</h3>
                  <span className={plugin.requiresKey ? styles.badgeKey : styles.badgeAuto}>
                    {plugin.requiresKey ? "키 필요" : "자동"}
                  </span>
                </div>
                <p className={styles.cardSource}>{plugin.source}</p>
                <p className={styles.cardDesc}>{plugin.desc}</p>

                {openPlugin === plugin.name && (
                  <div className={styles.cardDetail}>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailLabel}>주요 기능</h4>
                      <ul className={styles.featureList}>
                        {plugin.features.map((f, j) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailLabel}>사용법</h4>
                      <p className={styles.usageText}>{plugin.usage}</p>
                    </div>
                    {plugin.requiresKey && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailLabel}>필수 환경변수</h4>
                        <code className={styles.envKey}>{plugin.keyName}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
