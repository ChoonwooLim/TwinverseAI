import { useState } from "react";
import styles from "./AdminClawCode.module.css";

/* ─── Static analysis data ─── */

const OVERVIEW = {
  name: "Claw Code",
  repo: "ultraworkers/claw-code",
  version: "0.1.0",
  license: "MIT",
  languages: ["Rust (primary)", "Python (reference)", "Bash (scripts)"],
  rustLoc: "48,599",
  testLoc: "2,568",
  crates: 10,
  commits: 292,
  authors: 3,
  tools: "40+",
  dateRange: "2026-03-31 ~ 2026-04-03",
  description:
    "Anthropic Claude Code CLI의 공개 Rust 재구현체. 멀티 프로바이더를 지원하는 프로덕션급 AI 에이전트 하네스로, 자율 도구 실행과 세션 관리를 제공한다. 'Claw'는 Discord를 통해 인간이 방향을 설정하고 AI 에이전트가 병렬로 작업을 수행하는 자율 개발 모델을 지칭한다.",
};

const CRATES = [
  {
    name: "rusty-claude-cli",
    role: "Main CLI Binary",
    desc: "메인 진입점. REPL, 인자 파싱, OAuth 콜백, 세션 관리, 터미널 렌더링(Markdown→ANSI), 스피너 애니메이션 등 포함.",
    lines: "~2,000",
    key: [
      "LiveCli — 인터렉티브 세션 매니저",
      "CliAction — 파싱된 CLI 인자",
      "CliOutputFormat — Text vs JSON 출력",
      "PermissionMode — read-only / workspace-write / danger-full-access",
    ],
    deps: "api, commands, compat-harness, runtime, plugins, tools, rustyline, crossterm, tokio, pulldown-cmark, syntect",
  },
  {
    name: "runtime",
    role: "Core Engine",
    desc: "대화 상태, 권한, 도구, MCP, 세션 영속성을 관리하는 핵심 엔진. 50+ 모듈 포함.",
    lines: "50+ modules",
    key: [
      "ConversationRuntime<C, T> — 메시지 루프 오케스트레이션",
      "Session — JSONL 영속성, 자동 로테이션 (256KB 청크, 최대 3 백업)",
      "PermissionEnforcer — 파일/Bash 작업 권한 시행",
      "ConfigLoader — 우선순위 기반 설정 (user > project > local)",
      "MCP Client/Server — Model Context Protocol 생명주기",
      "LSP Client — IDE 언어 서비스",
      "Hooks — 이벤트 전후 생명주기 훅",
      "Compact — 토큰 초과 시 자동 세션 압축 (기본 100K)",
    ],
    deps: "serde, tokio, walkdir, regex, glob, sha2",
  },
  {
    name: "tools",
    role: "Tool Execution",
    desc: "40+ 도구 스펙 정의 및 실행 시스템. 파일, 검색, Bash, 태스크, MCP/LSP, 플러그인 등 모든 도구를 통합 디스패치.",
    lines: "~2,000+",
    key: [
      "mvp_tool_specs() — 40+ 도구 스펙 레지스트리",
      "execute_tool() — 도구 요청 디스패치",
      "Tool Pool — 빌트인 + 플러그인 + 런타임 도구 병합",
      "Permission Enforcement — 도구별 required_permission 적용",
    ],
    deps: "api, runtime, plugins, reqwest, tokio, flate2",
  },
  {
    name: "api",
    role: "Provider Clients",
    desc: "멀티 AI 프로바이더 추상화 레이어. Anthropic, OpenAI-호환, xAI 지원. SSE 스트리밍, OAuth, 프록시 설정 포함.",
    lines: "",
    key: [
      "ProviderClient — Anthropic / Xai / OpenAi 변형",
      "Anthropic API — 네이티브 제공, OAuth, 프롬프트 캐싱",
      "OpenAI-compatible — OpenRouter, Ollama, DashScope, xAI 게이트웨이",
      "SSE Parser — Server-Sent Event 스트리밍",
    ],
    deps: "reqwest, serde, tokio, telemetry",
  },
  {
    name: "commands",
    role: "Slash Commands",
    desc: "슬래시 커맨드 레지스트리 및 렌더링. /help, /status, /cost, /model, /config, /memory, /skills, /agents, /mcp, /doctor 등 지원.",
    lines: "",
    key: [
      "validate_slash_command_input() — 입력 검증",
      "resume_supported_slash_commands() — 세션 재개 시 커맨드 복원",
      "JSON 렌더링 — 커맨드 스펙 직렬화",
    ],
    deps: "plugins, runtime, serde_json",
  },
  {
    name: "plugins",
    role: "Plugin System",
    desc: "플러그인 발견, 설치, 활성화/비활성화/제거 생명주기 관리. 스키마 정의 및 훅 통합.",
    lines: "",
    key: [
      "PluginManager — 전체 생명주기 관리",
      "PluginRegistry — 발견 및 검증",
      "PluginTool — 플러그인 도구 정의",
    ],
    deps: "serde, serde_json",
  },
  {
    name: "telemetry",
    role: "Usage Telemetry",
    desc: "세션 추적 및 사용량 텔레메트리. JSONL/메모리 싱크 지원.",
    lines: "",
    key: [
      "SessionTracer — 세션 이벤트 추적",
      "TelemetryEvent / AnalyticsEvent — 이벤트 타입",
      "JsonlTelemetrySink / MemoryTelemetrySink — 텔레메트리 싱크",
    ],
    deps: "serde, serde_json",
  },
  {
    name: "mock-anthropic-service",
    role: "Mock Service",
    desc: "결정론적 테스트용 Anthropic API 모의 서비스. /v1/messages 엔드포인트로 재현 가능한 테스트 환경 제공.",
    lines: "",
    key: [
      "MockAnthropicService — HTTP 서버 스폰",
      "--bind HOST:PORT 인자 지원",
      "10개 스크립트 시나리오, 19개 캡처된 API 요청",
    ],
    deps: "api, serde_json, tokio",
  },
  {
    name: "compat-harness",
    role: "TS Manifest Extraction",
    desc: "업스트림 TypeScript 스냅샷 파일에서 매니페스트 메타데이터를 추출. 패리티 검증용.",
    lines: "",
    key: [
      "extract_manifest() — TS 스냅샷 읽기",
      "도구/커맨드 인벤토리 추출",
    ],
    deps: "commands, tools, runtime",
  },
];

const FEATURES = [
  {
    title: "멀티 프로바이더 지원",
    color: "#667eea",
    items: [
      "Anthropic — ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / OAuth",
      "OpenAI-compatible — OpenRouter, Ollama, 로컬 모델",
      "xAI (Grok) — XAI_API_KEY",
      "DashScope (Qwen) — DASHSCOPE_API_KEY",
      "모델명 자동 프로바이더 감지",
      "커스텀 별칭: opus, sonnet, haiku, grok, grok-mini, 사용자 정의",
    ],
  },
  {
    title: "도구 시스템 (40+ 도구)",
    color: "#00d4ff",
    items: [
      "파일 — read_file, write_file, edit_file (diff 패칭)",
      "검색 — glob_search, grep_search, web_search, web_fetch",
      "실행 — bash (검증, 타임아웃, 샌드박스)",
      "태스크 — task_create/get/list/update/output/stop",
      "팀/크론 — team_create/delete, cron_create/delete/list",
      "MCP/LSP — ListMcpResources, ReadMcpResource, 심볼/참조/진단/호버/정의",
      "UI — SendUserMessage, AskUserQuestion",
      "자동화 — Skill, Agent, Brief, RemoteTrigger, PlanMode",
    ],
  },
  {
    title: "권한 시스템",
    color: "#4ade80",
    items: [
      "read-only — 파일 읽기만, bash 읽기전용 휴리스틱",
      "workspace-write — 워크스페이스 내 파일 수정 가능",
      "danger-full-access — 제한 없음 (기본값)",
      "인터렉티브 권한 에스컬레이션 프롬프트",
    ],
  },
  {
    title: "세션 관리",
    color: "#f093fb",
    items: [
      "JSONL 영속성 — 자동 로테이션 (256KB 청크, 최대 3 백업)",
      "--resume latest|<session-id>|<path> 지원",
      "자동 압축 — 토큰 임계 초과 시 요약 (기본 100K input)",
      "세션 포크 — 부모에서 분기, 출처 추적",
      "프롬프트 히스토리 — 타임스탬프 기록",
    ],
  },
  {
    title: "인터랙티브 REPL",
    color: "#fbbf24",
    items: [
      "50+ 슬래시 커맨드 (/help, /status, /cost, /skills, /agents ...)",
      "탭 자동완성 — 커맨드, 모델 별칭, 권한 모드, 세션 ID",
      "실시간 스트리밍 — ANSI 마크다운 렌더링",
      "스피너 애니메이션 — 처리 중 진행 표시",
    ],
  },
  {
    title: "MCP (Model Context Protocol)",
    color: "#ff6b6b",
    items: [
      "서버 생명주기 — stdio, websocket, managed proxy, remote, SDK",
      "리소스 발견 및 읽기",
      "도구 발견 및 호출",
      "인증 상태 추적",
      "Degraded 모드 폴백",
    ],
  },
  {
    title: "설정 시스템",
    color: "#a78bfa",
    items: [
      "5단계 우선순위: ~/.claw.json > XDG > .claw.json > settings.json > settings.local.json",
      "병합 설정 섹션, MCP 서버 정의, 훅 정의",
      "피처 플래그, 권한 규칙",
    ],
  },
  {
    title: "Git 통합",
    color: "#34d399",
    items: [
      "커밋 추적, 신선도 검사",
      "Stale base/branch 감지",
      "레인 이벤트 추적 (커밋 출처, 차단 이벤트)",
      "정책 엔진 — 병합/푸시 결정",
    ],
  },
  {
    title: "기타",
    color: "#fb923c",
    items: [
      "비용/사용량 추적 — 모델별 토큰 가격, USD 추정",
      "훅 시스템 — 이벤트 전후 생명주기 훅",
      "플러그인 시스템 — 발견/설치/활성화/비활성화/제거",
      "Mock 패리티 하네스 — 10 시나리오, 결정론적 테스트",
      "unsafe 코드 금지 — 모든 기능 메모리 안전 Rust",
    ],
  },
];

const TECH_STACK = [
  { lib: "tokio", ver: "1.x", purpose: "비동기 런타임 (멀티 스레드)" },
  { lib: "reqwest", ver: "0.12", purpose: "HTTP 클라이언트 + 프록시" },
  { lib: "serde / serde_json", ver: "1.x", purpose: "직렬화/역직렬화" },
  { lib: "rustyline", ver: "15", purpose: "REPL 라인 편집" },
  { lib: "crossterm", ver: "0.28", purpose: "터미널 UI / 크로스플랫폼" },
  { lib: "pulldown-cmark", ver: "0.13", purpose: "Markdown → ANSI 렌더링" },
  { lib: "syntect", ver: "5", purpose: "코드 구문 강조" },
  { lib: "flate2", ver: "1", purpose: "압축 (gzip)" },
  { lib: "walkdir", ver: "2", purpose: "디렉토리 재귀 탐색" },
  { lib: "glob", ver: "0.3", purpose: "Glob 패턴 매칭" },
  { lib: "regex", ver: "1", purpose: "정규식" },
  { lib: "sha2", ver: "0.10", purpose: "SHA 해싱" },
];

const PROTOCOLS = [
  { name: "Anthropic Messages API", desc: "네이티브 프로바이더" },
  { name: "OpenAI-compatible API", desc: "OpenRouter, Ollama, xAI, DashScope 게이트웨이" },
  { name: "Model Context Protocol (MCP)", desc: "도구/리소스 발견 및 실행" },
  { name: "Language Server Protocol (LSP)", desc: "IDE 언어 서비스" },
  { name: "OAuth 2.0 + PKCE", desc: "인증 흐름" },
  { name: "Server-Sent Events (SSE)", desc: "응답 스트리밍" },
  { name: "JSONL", desc: "세션 영속성 포맷" },
];

const PYTHON_REF = {
  desc: "src/ 디렉토리에 동일 인터페이스의 Python 참조 구현이 포함되어 있다. 80+ 모듈, 30+ JSON 스냅샷 매니페스트로 구성.",
  modules: [
    "main.py — 서브커맨드 (summary, manifest, parity-audit, bootstrap, tools, commands, turn-loop 등)",
    "runtime.py — PortRuntime 대화 루프",
    "session_store.py — 세션 로딩/관리",
    "query.py / query_engine.py — 커맨드/도구 발견용 QueryEngine",
    "tools.py / tool_pool.py — 도구 조립 및 디스패치",
    "permissions.py — 권한 시행",
    "parity_audit.py — 아카이브된 TS 소스 대비 패리티 비교",
    "subsystems/ — 30+ JSON 스냅샷 (assistant, bootstrap, bridge, cli, components ...)",
  ],
};

const ARCHITECTURE_FLOW = [
  { step: "User CLI Input", detail: "사용자가 명령어 또는 프롬프트 입력" },
  { step: "CliAction Parser", detail: "main.rs에서 인자 파싱 → Prompt / Status / Skills / Login 분기" },
  { step: "LiveCli::run_turn_with_output()", detail: "인터랙티브 세션 턴 실행" },
  { step: "ConversationRuntime<C, T>", detail: "시스템 프롬프트 로드 + 권한 정책 빌드 + 세션 생성/재개" },
  { step: "Build ApiRequest", detail: "system_prompt + messages + tools 조합" },
  { step: "Stream from Provider", detail: "ProviderClient::stream_message → SSE 스트림" },
  { step: "Accumulate Events", detail: "TextDelta, ToolUse, Usage, PromptCache, MessageStop" },
  { step: "Tool Execution", detail: "PermissionEnforcer 검사 → tools::execute_tool → Bash/File/Search/MCP/LSP/Plugin 디스패치" },
  { step: "Finalize Turn", detail: "세션 JSONL 영속 → 사용량 추적 → 압축 체크 → TurnSummary" },
  { step: "Render Output", detail: "Markdown→ANSI (텍스트) 또는 JSON (스크립팅) 출력" },
];

const BUILD_COMMANDS = [
  { cmd: "cargo build --workspace", desc: "디버그 빌드" },
  { cmd: "cargo build --release --workspace", desc: "릴리스 빌드" },
  { cmd: "./target/debug/claw prompt \"describe this\"", desc: "원샷 프롬프트" },
  { cmd: "./target/debug/claw status", desc: "상태 확인" },
  { cmd: "./target/debug/claw doctor", desc: "헬스 체크" },
  { cmd: "./target/debug/claw --resume latest", desc: "세션 재개" },
  { cmd: "./target/debug/claw login", desc: "OAuth 인증" },
  { cmd: "./target/debug/claw --model sonnet prompt \"test\"", desc: "모델 지정 실행" },
  { cmd: "cargo test --workspace", desc: "전체 테스트" },
  { cmd: "cargo fmt --all --check", desc: "포맷 검사" },
  { cmd: "cargo clippy --workspace --all-targets -- -D warnings", desc: "린트 검사" },
];

const PARITY_LANES = [
  "Lane 1: Core CLI + REPL",
  "Lane 2: API Provider Layer",
  "Lane 3: Tool Execution System",
  "Lane 4: Session Management",
  "Lane 5: Permission System",
  "Lane 6: MCP Integration",
  "Lane 7: Plugin System",
  "Lane 8: Configuration",
  "Lane 9: Telemetry & Usage",
];

/* ─── Component ─── */

export default function AdminClawCode() {
  const [openSection, setOpenSection] = useState(null);
  const [openCrate, setOpenCrate] = useState(null);

  const toggleSection = (id) => setOpenSection(openSection === id ? null : id);
  const toggleCrate = (name) => setOpenCrate(openCrate === name ? null : name);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <span className={styles.overline}>Project Deep-Dive Analysis</span>
        <h1 className={styles.title}>Claw Code</h1>
        <p className={styles.headerDesc}>
          Claude Code CLI의 오픈소스 Rust 재구현체 — 멀티 프로바이더 AI 에이전트 하네스 정밀 분석 보고서
        </p>
        <p className={styles.headerMeta}>
          <span>D:\00_AI_ALL\01_instructkr</span>
          <span className={styles.dot}></span>
          <span>{OVERVIEW.repo}</span>
          <span className={styles.dot}></span>
          <span>{OVERVIEW.license}</span>
        </p>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {[
          { label: "Rust LOC", value: OVERVIEW.rustLoc },
          { label: "Test LOC", value: OVERVIEW.testLoc },
          { label: "Crates", value: OVERVIEW.crates },
          { label: "Tools", value: OVERVIEW.tools },
          { label: "Commits", value: OVERVIEW.commits },
          { label: "Authors", value: OVERVIEW.authors },
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
          <span className={styles.tagMuted}>v{OVERVIEW.version}</span>
          <span className={styles.tagMuted}>{OVERVIEW.dateRange}</span>
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

      {/* Crates */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>03</span> Rust 크레이트 구조 ({CRATES.length}개)
        </h2>
        <ul className={styles.crateList}>
          {CRATES.map((c, i) => (
            <li key={c.name} className={styles.crateItem}>
              <button onClick={() => toggleCrate(c.name)} className={styles.crateBtn}>
                <span className={styles.crateIndex}>{String(i + 1).padStart(2, "0")}</span>
                <div className={styles.crateBody}>
                  <span className={styles.crateName}>
                    {c.name}
                    <span className={styles.crateRole}>{c.role}</span>
                  </span>
                  <span className={styles.crateDesc}>{c.desc}</span>
                </div>
                <span className={`${styles.chevron} ${openCrate === c.name ? styles.chevronOpen : ""}`}>
                  &#x25BC;
                </span>
              </button>
              {openCrate === c.name && (
                <div className={styles.crateDetail}>
                  <div className={styles.detailBlock}>
                    <h4 className={styles.detailLabel}>핵심 요소</h4>
                    <ul className={styles.keyList}>
                      {c.key.map((k, j) => (
                        <li key={j}>{k}</li>
                      ))}
                    </ul>
                  </div>
                  {c.lines && (
                    <p className={styles.detailMeta}>
                      <strong>규모:</strong> {c.lines}
                    </p>
                  )}
                  <p className={styles.detailMeta}>
                    <strong>Dependencies:</strong>{" "}
                    <span className={styles.depText}>{c.deps}</span>
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Features */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>04</span> 핵심 기능 ({FEATURES.length}개 카테고리)
        </h2>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
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

      {/* Tech Stack */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>05</span> 기술 스택
        </h2>

        <h3 className={styles.subTitle}>라이브러리</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>라이브러리</th>
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

        <h3 className={styles.subTitle}>프로토콜 & 표준</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>프로토콜</th>
                <th>설명</th>
              </tr>
            </thead>
            <tbody>
              {PROTOCOLS.map((p) => (
                <tr key={p.name}>
                  <td><code className={styles.code}>{p.name}</code></td>
                  <td>{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Python Reference */}
      <section className={styles.section}>
        <button onClick={() => toggleSection("python")} className={styles.sectionToggle}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>06</span> Python 참조 구현
          </h2>
          <span className={`${styles.chevron} ${openSection === "python" ? styles.chevronOpen : ""}`}>
            &#x25BC;
          </span>
        </button>
        {openSection === "python" && (
          <div className={styles.sectionContent}>
            <p className={styles.bodyText}>{PYTHON_REF.desc}</p>
            <ul className={styles.keyList}>
              {PYTHON_REF.modules.map((m, i) => (
                <li key={i}><code className={styles.code}>{m.split(" — ")[0]}</code>{m.includes(" — ") ? ` — ${m.split(" — ")[1]}` : ""}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Build & Commands */}
      <section className={styles.section}>
        <button onClick={() => toggleSection("build")} className={styles.sectionToggle}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>07</span> 빌드 & 커맨드
          </h2>
          <span className={`${styles.chevron} ${openSection === "build" ? styles.chevronOpen : ""}`}>
            &#x25BC;
          </span>
        </button>
        {openSection === "build" && (
          <div className={styles.sectionContent}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>명령어</th>
                    <th>설명</th>
                  </tr>
                </thead>
                <tbody>
                  {BUILD_COMMANDS.map((b) => (
                    <tr key={b.cmd}>
                      <td><code className={styles.code}>{b.cmd}</code></td>
                      <td>{b.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Parity Status */}
      <section className={styles.section}>
        <button onClick={() => toggleSection("parity")} className={styles.sectionToggle}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>08</span> 패리티 상태 (9 레인)
          </h2>
          <span className={`${styles.chevron} ${openSection === "parity" ? styles.chevronOpen : ""}`}>
            &#x25BC;
          </span>
        </button>
        {openSection === "parity" && (
          <div className={styles.sectionContent}>
            <p className={styles.bodyText}>
              업스트림 TypeScript 원본 대비 Rust 포트의 패리티를 9개 개발 레인으로 추적한다. 현재 모든 레인이 <code className={styles.code}>main</code>에 병합 완료.
            </p>
            <ul className={styles.laneList}>
              {PARITY_LANES.map((lane, i) => (
                <li key={i} className={styles.laneItem}>
                  <span className={styles.laneCheck}>&#x2713;</span>
                  {lane}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Philosophy */}
      <section className={styles.section}>
        <button onClick={() => toggleSection("philosophy")} className={styles.sectionToggle}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>09</span> 프로젝트 철학
          </h2>
          <span className={`${styles.chevron} ${openSection === "philosophy" ? styles.chevronOpen : ""}`}>
            &#x25BC;
          </span>
        </button>
        {openSection === "philosophy" && (
          <div className={styles.sectionContent}>
            <p className={styles.bodyText}>
              Claw Code는 <strong>자율 소프트웨어 개발</strong>의 시연 프로젝트이다.
              인간 개발자가 Discord를 통해 방향을 설정하고, AI 에이전트(claws)가 병렬로 작업을 수행한다.
            </p>
            <ul className={styles.keyList}>
              <li><strong>OmX</strong> — 인간↔에이전트 브릿지 (Discord 인터페이스)</li>
              <li><strong>clawhip</strong> — 멀티 에이전트 코디네이션 시스템</li>
              <li><strong>OmO</strong> — 에이전트↔에이전트 통신</li>
              <li><strong>자동 루프</strong> — 계획 → 실행 → 리뷰 → 복구</li>
            </ul>
            <p className={styles.bodyText} style={{ marginTop: "0.75rem" }}>
              Anthropic 비공식 프로젝트이며, Claude Code를 확장하는 커뮤니티 기반 오픈소스이다.
            </p>
          </div>
        )}
      </section>

      {/* CI/CD */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>10</span> CI/CD & 워크플로우
        </h2>
        <div className={styles.ciList}>
          <div className={styles.ciItem}>
            <span className={styles.ciLabel}>rust-ci.yml</span>
            <span className={styles.ciDesc}>fmt check → clippy → test (rusty-claude-cli)</span>
          </div>
          <div className={styles.ciItem}>
            <span className={styles.ciLabel}>release.yml</span>
            <span className={styles.ciDesc}>릴리스 자동화</span>
          </div>
          <div className={styles.ciItem}>
            <span className={styles.ciLabel}>Containerfile</span>
            <span className={styles.ciDesc}>컨테이너 퍼스트 배포 워크플로우</span>
          </div>
          <div className={styles.ciItem}>
            <span className={styles.ciLabel}>install.sh</span>
            <span className={styles.ciDesc}>설치 스크립트</span>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className={styles.footer}>
        <p>
          분석 기준일: 2026-04-09 &middot; 소스: D:\00_AI_ALL\01_instructkr &middot; 자동 생성 분석 보고서
        </p>
      </div>
    </div>
  );
}
