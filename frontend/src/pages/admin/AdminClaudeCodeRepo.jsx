import { useState } from "react";
import styles from "./AdminClaudeCodeRepo.module.css";

/* ─── Static analysis data ─── */

const OVERVIEW = {
  name: "Claude Code",
  repo: "anthropics/claude-code",
  owner: "Anthropic",
  license: "Copyright Anthropic",
  languages: ["Node.js / TypeScript", "Python (hooks)", "Bash / Shell", "YAML"],
  totalFiles: 184,
  totalLoc: "~87,000",
  commits: 695,
  changelogLines: "2,828",
  plugins: 12,
  agents: "18+",
  commands: "15+",
  description:
    "Anthropic 공식 터미널 기반 AI 코딩 어시스턴트. 코드베이스를 깊이 이해하고 자연어 명령으로 개발 작업을 수행하는 에이전틱 도구. 터미널, IDE, GitHub @claude 멘션으로 호출 가능하며, 자율 에이전트를 통해 코드 탐색·리뷰·생성·리팩토링을 수행한다.",
};

const PLUGINS = [
  {
    name: "feature-dev",
    desc: "7단계 구조화된 기능 개발 워크플로우",
    command: "/feature-dev",
    detail: [
      "Phase 1: Discovery — 요구사항 발견 및 범위 설정",
      "Phase 2: Exploration — 코드베이스 탐색 (code-explorer 에이전트)",
      "Phase 3: Clarification — 사용자와 요구사항 명확화",
      "Phase 4: Architecture — 설계 (code-architect 에이전트)",
      "Phase 5: Implementation — 구현",
      "Phase 6: Review — 리뷰 (code-reviewer 에이전트)",
      "Phase 7: Summary — 최종 요약",
    ],
    agents: ["code-explorer", "code-architect", "code-reviewer"],
  },
  {
    name: "code-review",
    desc: "5개 병렬 Sonnet 에이전트를 사용한 자동 PR 리뷰",
    command: "/code-review",
    detail: [
      "병렬 에이전트 5개가 동시에 다양한 관점으로 코드 리뷰",
      "신뢰도 기반 필터링 — 낮은 확신의 피드백 자동 제외",
      "버그, 품질, 컨벤션, 보안, 성능 관점 통합 분석",
    ],
    agents: ["code-reviewer"],
  },
  {
    name: "pr-review-toolkit",
    desc: "6종 전문 리뷰 에이전트 + 종합 PR 리뷰 워크플로우",
    command: "/pr-review-toolkit:review-pr",
    detail: [
      "comment-analyzer — 문서/주석 정확성 검증",
      "test-analyzer — 테스트 커버리지 품질 평가",
      "error-hunter — 사일런트 에러/예외 처리 탐지",
      "type-analyzer — 타입 설계 및 불변성 리뷰",
      "code-reviewer — 코드 품질/패턴 분석",
      "simplifier — 리팩토링 및 유지보수성 개선",
    ],
    agents: ["comment-analyzer", "test-analyzer", "error-hunter", "type-analyzer", "code-reviewer", "simplifier"],
  },
  {
    name: "plugin-dev",
    desc: "플러그인 개발 툴킷 — 7개 전문 스킬 + 8단계 가이드 워크플로우",
    command: "/plugin-dev:create-plugin",
    detail: [
      "8-phase 가이드 플러그인 생성 워크플로우",
      "hooks 스킬 — 훅 시스템 전문 지식",
      "MCP 스킬 — Model Context Protocol 통합",
      "structure 스킬 — 디렉토리 구조 설계",
      "settings 스킬 — 설정 관리",
      "commands 스킬 — 슬래시 커맨드 정의",
      "agents 스킬 — 에이전트 생성",
      "skills 스킬 — 프로그레시브 디스클로저 지식 모듈",
    ],
    agents: ["plugin-validator", "skill-reviewer", "agent-creator"],
  },
  {
    name: "hookify",
    desc: "JSON 편집 없이 마크다운으로 커스텀 훅 생성",
    command: "/hookify",
    detail: [
      "YAML 프론트매터 + 마크다운 본문으로 규칙 정의",
      "이벤트: bash, file, stop, prompt, all",
      "연산자: regex_match, contains, equals, starts_with, ends_with, not_contains",
      "액션: warn (경고만) / block (차단)",
      "/hookify:list — 모든 훅 목록 조회",
      "/hookify:configure — 인터랙티브 설정",
    ],
    agents: [],
  },
  {
    name: "agent-sdk-dev",
    desc: "Agent SDK 프로젝트 스캐폴딩 및 검증",
    command: "/new-sdk-app",
    detail: [
      "Python / TypeScript Agent SDK 프로젝트 자동 생성",
      "agent-sdk-verifier-py — Python SDK 검증 에이전트",
      "agent-sdk-verifier-ts — TypeScript SDK 검증 에이전트",
      "셋업 및 베스트 프랙티스 자동 점검",
    ],
    agents: ["agent-sdk-verifier-py", "agent-sdk-verifier-ts"],
  },
  {
    name: "commit-commands",
    desc: "Git 워크플로우 자동화 커맨드 모음",
    command: "/commit",
    detail: [
      "/commit — 스마트 커밋 메시지 생성 및 커밋",
      "/commit-push-pr — 커밋 → 푸시 → PR 생성 일괄 실행",
      "/clean_gone — 삭제된 리모트 브랜치의 로컬 정리",
    ],
    agents: [],
  },
  {
    name: "ralph-wiggum",
    desc: "자기참조 AI 반복 루프 — 완료까지 자율 작업 수행",
    command: "/ralph-loop",
    detail: [
      "Stop 훅이 세션 종료 시도를 가로채서 계속 실행",
      "작업 완료까지 자율적으로 반복",
      "/cancel-ralph — 루프 중단",
      "자동 계획 → 실행 → 검토 → 복구 사이클",
    ],
    agents: [],
  },
  {
    name: "explanatory-output-style",
    desc: "코딩 세션 중 교육적 인사이트 제공 모드",
    command: "(SessionStart hook)",
    detail: [
      "구현 선택의 이유 설명",
      "패턴 및 안티패턴 교육",
      "session-start.sh 훅으로 자동 활성화",
    ],
    agents: [],
  },
  {
    name: "learning-output-style",
    desc: "인터랙티브 학습 모드 — 사용자 참여 유도",
    command: "(SessionStart hook)",
    detail: [
      "사용자에게 코드 기여 요청",
      "학습 중심 대화 유도",
      "session-start.sh 훅으로 자동 활성화",
    ],
    agents: [],
  },
  {
    name: "security-guidance",
    desc: "보안 패턴 감지 및 경고 시스템",
    command: "(PreToolUse hook)",
    detail: [
      "9종 보안 패턴 실시간 감지:",
      "GitHub Actions 워크플로우 인젝션",
      "child_process.exec() 인젝션",
      "new Function() 코드 인젝션",
      "eval() 실행 위험",
      "dangerouslySetInnerHTML / document.write() / innerHTML XSS",
      "pickle 역직렬화 공격",
      "os.system() 안전하지 않은 사용",
      "세션별 상태 추적 (중복 경고 방지)",
    ],
    agents: [],
  },
  {
    name: "claude-opus-4-5-migration",
    desc: "모델 마이그레이션 유틸리티 (Sonnet 4.x → Opus 4.5)",
    command: "-",
    detail: [
      "기존 프로젝트의 모델 참조 자동 업데이트",
      "마이그레이션 가이드 및 호환성 체크",
    ],
    agents: [],
  },
  {
    name: "frontend-design",
    desc: "UI/UX 디자인 품질 가이드",
    command: "-",
    detail: [
      "프론트엔드 설계 품질 기준 제시",
      "디자인 패턴 및 접근성 가이드라인",
    ],
    agents: [],
  },
];

const AGENTS = [
  { name: "code-explorer", plugin: "feature-dev", desc: "기존 코드의 실행 경로를 추적하고 분석" },
  { name: "code-architect", plugin: "feature-dev", desc: "기능 구현을 위한 아키텍처 설계 및 대안 제시" },
  { name: "code-reviewer", plugin: "feature-dev / code-review", desc: "버그, 품질, 컨벤션 관점의 코드 리뷰" },
  { name: "comment-analyzer", plugin: "pr-review-toolkit", desc: "문서/주석의 정확성 검증" },
  { name: "test-analyzer", plugin: "pr-review-toolkit", desc: "테스트 커버리지 품질 평가" },
  { name: "error-hunter", plugin: "pr-review-toolkit", desc: "사일런트 에러/실패 경로 탐지" },
  { name: "type-analyzer", plugin: "pr-review-toolkit", desc: "타입 설계 및 불변성 리뷰" },
  { name: "simplifier", plugin: "pr-review-toolkit", desc: "리팩토링, 가독성, 유지보수성 개선" },
  { name: "plugin-validator", plugin: "plugin-dev", desc: "플러그인 구조 및 설정 검증" },
  { name: "skill-reviewer", plugin: "plugin-dev", desc: "스킬 품질 및 트리거 리뷰" },
  { name: "agent-creator", plugin: "plugin-dev", desc: "AI 지원 에이전트 자동 생성" },
  { name: "conversation-analyzer", plugin: "plugin-dev", desc: "대화 패턴 분석" },
  { name: "agent-sdk-verifier-py", plugin: "agent-sdk-dev", desc: "Python SDK 셋업 검증" },
  { name: "agent-sdk-verifier-ts", plugin: "agent-sdk-dev", desc: "TypeScript SDK 셋업 검증" },
];

const HOOKS = [
  {
    name: "PreToolUse",
    desc: "도구 실행 전 호출. 허용/경고/차단 결정 가능.",
    examples: ["보안 패턴 감지 (security-guidance)", "커스텀 규칙 평가 (hookify)"],
  },
  {
    name: "PostToolUse",
    desc: "도구 실행 후 호출. 결과 검증 및 후처리.",
    examples: ["hookify 규칙 평가", "결과 로깅"],
  },
  {
    name: "Stop",
    desc: "세션 종료 시도 시 호출. 종료를 차단하거나 조건부 허용.",
    examples: ["ralph-wiggum 자율 루프 (종료 차단)", "hookify stop 규칙"],
  },
  {
    name: "UserPromptSubmit",
    desc: "사용자 프롬프트 제출 시 호출. 입력 필터링 가능.",
    examples: ["hookify prompt 규칙", "입력 검증"],
  },
  {
    name: "SessionStart",
    desc: "세션 시작 시 호출. 초기 컨텍스트 설정.",
    examples: ["explanatory-output-style 활성화", "learning-output-style 활성화"],
  },
  {
    name: "SessionEnd",
    desc: "세션 종료 시 호출. 정리 작업 수행.",
    examples: ["상태 파일 정리", "텔레메트리 전송"],
  },
];

const HOOKIFY_RULE = `---
name: block-rm-rf
enabled: true
event: bash
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: "rm\\\\s+-rf"
---
위험한 rm -rf 명령은 차단됩니다.`;

const COMMANDS = [
  { cmd: "/feature-dev", plugin: "feature-dev", desc: "7단계 기능 개발 워크플로우" },
  { cmd: "/code-review", plugin: "code-review", desc: "5개 병렬 에이전트 PR 리뷰" },
  { cmd: "/pr-review-toolkit:review-pr", plugin: "pr-review-toolkit", desc: "6종 전문 에이전트 종합 리뷰" },
  { cmd: "/new-sdk-app", plugin: "agent-sdk-dev", desc: "Agent SDK 프로젝트 스캐폴딩" },
  { cmd: "/plugin-dev:create-plugin", plugin: "plugin-dev", desc: "8단계 플러그인 생성 가이드" },
  { cmd: "/hookify", plugin: "hookify", desc: "마크다운 기반 커스텀 훅 생성" },
  { cmd: "/hookify:list", plugin: "hookify", desc: "모든 훅 목록 조회" },
  { cmd: "/hookify:configure", plugin: "hookify", desc: "인터랙티브 훅 설정" },
  { cmd: "/commit", plugin: "commit-commands", desc: "스마트 커밋" },
  { cmd: "/commit-push-pr", plugin: "commit-commands", desc: "커밋 → 푸시 → PR 일괄" },
  { cmd: "/clean_gone", plugin: "commit-commands", desc: "삭제된 리모트 브랜치 로컬 정리" },
  { cmd: "/ralph-loop", plugin: "ralph-wiggum", desc: "자율 반복 루프 시작" },
  { cmd: "/cancel-ralph", plugin: "ralph-wiggum", desc: "반복 루프 중단" },
];

const ARCHITECTURE_FLOW = [
  { step: "User Input (Terminal / IDE / @claude)", detail: "자연어 명령 또는 슬래시 커맨드 입력" },
  { step: "Command Parser + Plugin Registry", detail: "슬래시 커맨드 → 플러그인 라우팅, 자연어 → 인텐트 결정" },
  { step: "Skill Loader + Context Builder", detail: "CLAUDE.md + 코드베이스 컨텍스트 + Git 상태 수집" },
  { step: "Claude API (Anthropic Models)", detail: "Sonnet 4 / Opus 4.5 / Haiku 4.5 + 프롬프트 캐싱" },
  { step: "Tool Selection & Execution", detail: "Bash, Read, Write/Edit, WebFetch, MCP Tools 등 선택" },
  { step: "Hook Engine (Python)", detail: "PreToolUse → 규칙 평가 → Allow/Warn/Block 결정" },
  { step: "Tool Result Collection", detail: "도구 실행 결과 수집 + PostToolUse 훅 실행" },
  { step: "Agent Dispatch (필요 시)", detail: "code-explorer, code-reviewer 등 전문 에이전트 병렬 실행" },
  { step: "Response Rendering", detail: "마크다운 렌더링 + 스트리밍 출력" },
  { step: "Session Persistence", detail: "JSONL 세션 저장 + 사용량 추적" },
];

const DIR_STRUCTURE = [
  { path: ".claude/commands/", desc: "커스텀 슬래시 커맨드 (commit-push-pr, dedupe, triage-issue)" },
  { path: ".claude-plugin/", desc: "플러그인 마켓플레이스 레지스트리 (marketplace.json)" },
  { path: ".devcontainer/", desc: "DevContainer 설정 (Docker 기반 샌드박스 개발 환경)" },
  { path: ".github/workflows/", desc: "GitHub Actions 11개 (이슈 자동화, 트리아지, 중복 관리)" },
  { path: ".github/ISSUE_TEMPLATE/", desc: "이슈 템플릿 5종 (버그, 기능요청, 문서, 모델동작, 설정)" },
  { path: "examples/hooks/", desc: "예제 훅 스크립트 (bash_command_validator)" },
  { path: "examples/settings/", desc: "예제 설정 3종 (strict, lax, bash-sandbox)" },
  { path: "plugins/", desc: "12개 공식 플러그인 디렉토리" },
  { path: "scripts/", desc: "GitHub 자동화 스크립트 (TypeScript + Shell)" },
  { path: "CHANGELOG.md", desc: "변경 이력 (2,828줄)" },
  { path: "README.md", desc: "프로젝트 문서 (설치, 기능, 프라이버시 정책)" },
];

const TECH_STACK = [
  { lib: "Node.js", ver: "20.x", purpose: "메인 런타임 (CLI 실행)" },
  { lib: "TypeScript", ver: "-", purpose: "스크립트 및 자동화 코드" },
  { lib: "Python", ver: "3.7+", purpose: "훅 실행 엔진 (hookify, security)" },
  { lib: "Bun", ver: "-", purpose: "대체 TypeScript 런타임" },
  { lib: "Claude API", ver: "latest", purpose: "AI 모델 호출 (Sonnet/Opus/Haiku)" },
  { lib: "MCP", ver: "-", purpose: "외부 서비스 통합 프로토콜" },
  { lib: "GitHub API", ver: "v3", purpose: "이슈/PR 자동화" },
  { lib: "gh CLI", ver: "-", purpose: "GitHub 커맨드라인 도구" },
  { lib: "Docker", ver: "-", purpose: "DevContainer 샌드박스 환경" },
  { lib: "iptables/ipset", ver: "-", purpose: "네트워크 격리 방화벽" },
  { lib: "GitHub Actions", ver: "-", purpose: "CI/CD 워크플로우 (11개)" },
];

const SECURITY_FEATURES = [
  {
    title: "9종 보안 패턴 실시간 감지",
    color: "#ff6b6b",
    items: [
      "GitHub Actions 워크플로우 인젝션",
      "child_process.exec() / eval() / new Function() 인젝션",
      "dangerouslySetInnerHTML / document.write() / innerHTML XSS",
      "pickle 역직렬화 공격",
      "os.system() 안전하지 않은 사용",
    ],
  },
  {
    title: "권한 관리 시스템",
    color: "#667eea",
    items: [
      "도구별 세밀한 사용 권한 제어",
      "Bash 실행 승인 필수 모드 (strict)",
      "파일 쓰기/수정 권한 분리",
      "MCP 서버 접근 권한 관리",
    ],
  },
  {
    title: "샌드박스 & 격리",
    color: "#4ade80",
    items: [
      "DevContainer Docker 기반 격리 개발 환경",
      "Bash 샌드박스 모드 (settings-bash-sandbox.json)",
      "iptables/ipset 네트워크 방화벽 (init-firewall.sh)",
      "플러그인 마켓플레이스 비활성화 옵션",
    ],
  },
  {
    title: "엔터프라이즈 설정",
    color: "#f093fb",
    items: [
      "Managed settings — 조직 수준 정책 강제",
      "웹 도구 비활성화 옵션",
      "플러그인 허용/차단 리스트",
      "세션별 보안 상태 추적 (30일 자동 정리)",
    ],
  },
];

const GITHUB_WORKFLOWS = [
  { name: "claude.yml", desc: "메인 Claude Code 워크플로우" },
  { name: "claude-issue-triage.yml", desc: "Claude AI 이슈 자동 트리아지" },
  { name: "claude-dedupe-issues.yml", desc: "이슈 중복 자동 감지" },
  { name: "auto-close-duplicates.yml", desc: "중복 이슈 자동 닫기" },
  { name: "issue-lifecycle-comment.yml", desc: "이슈 라이프사이클 자동 코멘트" },
  { name: "issue-opened-dispatch.yml", desc: "이슈 오픈 이벤트 디스패치" },
  { name: "lock-closed-issues.yml", desc: "닫힌 이슈 자동 잠금" },
  { name: "log-issue-events.yml", desc: "이슈 이벤트 로깅" },
  { name: "non-write-users-check.yml", desc: "비 write 권한 사용자 체크" },
  { name: "remove-autoclose-label.yml", desc: "자동닫기 라벨 제거" },
  { name: "sweep.yml", desc: "Sweep 봇 자동화" },
];

const INSTALL_METHODS = [
  { method: "curl", cmd: "curl -fsSL https://claude.ai/install.sh | bash" },
  { method: "Homebrew", cmd: "brew install claude-code" },
  { method: "WinGet", cmd: "winget install claude-code" },
  { method: "npm", cmd: "npm install -g @anthropic-ai/claude-code" },
];

/* ─── Component ─── */

export default function AdminClaudeCodeRepo() {
  const [openPlugin, setOpenPlugin] = useState(null);
  const [openSection, setOpenSection] = useState(null);

  const togglePlugin = (name) => setOpenPlugin(openPlugin === name ? null : name);
  const toggleSection = (id) => setOpenSection(openSection === id ? null : id);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <span className={styles.overline}>Official Repository Analysis</span>
        <h1 className={styles.title}>Claude Code</h1>
        <p className={styles.headerDesc}>
          Anthropic 공식 터미널 기반 AI 코딩 어시스턴트 — 플러그인·에이전트·훅 시스템 정밀 분석 보고서
        </p>
        <p className={styles.headerMeta}>
          <span>D:\00_AI_ALL\02_anthropics</span>
          <span className={styles.dot}></span>
          <span>{OVERVIEW.repo}</span>
          <span className={styles.dot}></span>
          <span>{OVERVIEW.owner}</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {[
          { label: "Total Files", value: OVERVIEW.totalFiles },
          { label: "Total LOC", value: OVERVIEW.totalLoc },
          { label: "Commits", value: OVERVIEW.commits },
          { label: "Plugins", value: OVERVIEW.plugins },
          { label: "Agents", value: OVERVIEW.agents },
          { label: "Commands", value: OVERVIEW.commands },
        ].map((s) => (
          <div key={s.label} className={styles.statCard}>
            <span className={styles.statValue}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Overview */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>01</span> 개요
        </h2>
        <p className={styles.bodyText}>{OVERVIEW.description}</p>
        <div className={styles.tagRow}>
          {OVERVIEW.languages.map((lang) => (
            <span key={lang} className={styles.tag}>{lang}</span>
          ))}
        </div>
        <h3 className={styles.subTitle}>설치 방법</h3>
        <div className={styles.installGrid}>
          {INSTALL_METHODS.map((m) => (
            <div key={m.method} className={styles.installCard}>
              <span className={styles.installMethod}>{m.method}</span>
              <code className={styles.installCmd}>{m.cmd}</code>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture Flow */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>02</span> 아키텍처 흐름
        </h2>
        <div className={styles.flowList}>
          {ARCHITECTURE_FLOW.map((f, i) => (
            <div key={i} className={styles.flowItem}>
              <div className={styles.flowLine}>
                <span className={styles.flowDot} />
                {i < ARCHITECTURE_FLOW.length - 1 && <span className={styles.flowConnector} />}
              </div>
              <div className={styles.flowContent}>
                <span className={styles.flowStep}>{f.step}</span>
                <span className={styles.flowDetail}>{f.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Directory Structure */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>03</span> 디렉토리 구조
        </h2>
        <div className={styles.dirList}>
          {DIR_STRUCTURE.map((d) => (
            <div key={d.path} className={styles.dirItem}>
              <code className={styles.dirPath}>{d.path}</code>
              <span className={styles.dirDesc}>{d.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Plugins */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>04</span> 공식 플러그인 ({PLUGINS.length}개)
        </h2>
        <ul className={styles.pluginList}>
          {PLUGINS.map((p, i) => (
            <li key={p.name} className={styles.pluginItem}>
              <button onClick={() => togglePlugin(p.name)} className={styles.pluginBtn}>
                <span className={styles.pluginIndex}>{String(i + 1).padStart(2, "0")}</span>
                <div className={styles.pluginBody}>
                  <span className={styles.pluginName}>
                    {p.name}
                    {p.command !== "-" && <code className={styles.pluginCmd}>{p.command}</code>}
                  </span>
                  <span className={styles.pluginDesc}>{p.desc}</span>
                </div>
                <span className={`${styles.chevron} ${openPlugin === p.name ? styles.chevronOpen : ""}`}>
                  &#x25BC;
                </span>
              </button>
              {openPlugin === p.name && (
                <div className={styles.pluginDetail}>
                  <ul className={styles.keyList}>
                    {p.detail.map((d, j) => (
                      <li key={j}>{d}</li>
                    ))}
                  </ul>
                  {p.agents.length > 0 && (
                    <p className={styles.detailMeta}>
                      <strong>Agents:</strong>{" "}
                      <span className={styles.depText}>{p.agents.join(", ")}</span>
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Agents */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>05</span> 에이전트 시스템 ({AGENTS.length}개)
        </h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>에이전트</th>
                <th>플러그인</th>
                <th>역할</th>
              </tr>
            </thead>
            <tbody>
              {AGENTS.map((a) => (
                <tr key={a.name}>
                  <td><code className={styles.code}>{a.name}</code></td>
                  <td>{a.plugin}</td>
                  <td>{a.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Hook System */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>06</span> 훅 시스템 ({HOOKS.length}종)
        </h2>
        <div className={styles.hookGrid}>
          {HOOKS.map((h) => (
            <div key={h.name} className={styles.hookCard}>
              <h3 className={styles.hookName}>{h.name}</h3>
              <p className={styles.hookDesc}>{h.desc}</p>
              <ul className={styles.hookExamples}>
                {h.examples.map((ex, j) => (
                  <li key={j}>{ex}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <h3 className={styles.subTitle}>Hookify 규칙 예시</h3>
        <pre className={styles.codeBlock}>{HOOKIFY_RULE}</pre>
      </section>

      {/* Slash Commands */}
      <section className={styles.section}>
        <button onClick={() => toggleSection("commands")} className={styles.sectionToggle}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>07</span> 슬래시 커맨드 ({COMMANDS.length}개)
          </h2>
          <span className={`${styles.chevron} ${openSection === "commands" ? styles.chevronOpen : ""}`}>
            &#x25BC;
          </span>
        </button>
        {openSection === "commands" && (
          <div className={styles.sectionContent}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>커맨드</th>
                    <th>플러그인</th>
                    <th>설명</th>
                  </tr>
                </thead>
                <tbody>
                  {COMMANDS.map((c) => (
                    <tr key={c.cmd}>
                      <td><code className={styles.code}>{c.cmd}</code></td>
                      <td>{c.plugin}</td>
                      <td>{c.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Tech Stack */}
      <section className={styles.section}>
        <button onClick={() => toggleSection("tech")} className={styles.sectionToggle}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>08</span> 기술 스택
          </h2>
          <span className={`${styles.chevron} ${openSection === "tech" ? styles.chevronOpen : ""}`}>
            &#x25BC;
          </span>
        </button>
        {openSection === "tech" && (
          <div className={styles.sectionContent}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>기술</th>
                    <th>버전</th>
                    <th>용도</th>
                  </tr>
                </thead>
                <tbody>
                  {TECH_STACK.map((t) => (
                    <tr key={t.lib}>
                      <td><code className={styles.code}>{t.lib}</code></td>
                      <td>{t.ver}</td>
                      <td>{t.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Security */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>09</span> 보안 기능
        </h2>
        <div className={styles.featureGrid}>
          {SECURITY_FEATURES.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <h3 className={styles.featureTitle} style={{ color: f.color }}>
                <span className={styles.featureDot} style={{ background: f.color }} />
                {f.title}
              </h3>
              <ul className={styles.featureItems}>
                {f.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CI/CD */}
      <section className={styles.section}>
        <button onClick={() => toggleSection("cicd")} className={styles.sectionToggle}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>10</span> GitHub Actions ({GITHUB_WORKFLOWS.length}개)
          </h2>
          <span className={`${styles.chevron} ${openSection === "cicd" ? styles.chevronOpen : ""}`}>
            &#x25BC;
          </span>
        </button>
        {openSection === "cicd" && (
          <div className={styles.sectionContent}>
            <div className={styles.ciList}>
              {GITHUB_WORKFLOWS.map((w) => (
                <div key={w.name} className={styles.ciItem}>
                  <span className={styles.ciLabel}>{w.name}</span>
                  <span className={styles.ciDesc}>{w.desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <div className={styles.footer}>
        <p>
          분석 기준일: 2026-04-09 &middot; 소스: D:\00_AI_ALL\02_anthropics &middot; 자동 생성 분석 보고서
        </p>
      </div>
    </div>
  );
}
