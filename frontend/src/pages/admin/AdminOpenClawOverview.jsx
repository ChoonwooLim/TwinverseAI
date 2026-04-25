import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import styles from "./AdminOpenClawOverview.module.css";

export default function AdminOpenClawOverview() {
  const [health, setHealth] = useState(null);
  const [healthErr, setHealthErr] = useState("");

  useEffect(() => {
    let alive = true;
    api
      .get("/api/admin/openclaw/console/health")
      .then((r) => {
        if (alive) setHealth(r.data);
      })
      .catch((e) => {
        if (alive) setHealthErr(e?.response?.data?.detail || e.message || "");
      });
    return () => {
      alive = false;
    };
  }, []);

  const gatewayUp = health?.ok === true;
  const gatewayPill = healthErr
    ? { dot: styles.pillDotYellow, label: "Gateway 응답 지연" }
    : gatewayUp
    ? { dot: styles.pillDotGreen, label: "LAN Gateway 운영 중" }
    : { dot: styles.pillDotYellow, label: "상태 확인 중" };

  return (
    <div className={styles.page}>
      {/* ───────── Hero ───────── */}
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.overline}>OpenClaw · CLI Agent Broker</span>
          <h1 className={styles.heroTitle}>
            CLI 에이전트를 NPC와 자동화 워커로 — 하나의 RPC로
          </h1>
          <p className={styles.heroLede}>
            OpenClaw 는 ChatGPT/Codex · Claude Code · Gemini · Ollama 같은 CLI 에이전트를
            <strong> WebSocket RPC 게이트웨이</strong>로 감싸 persistent session · 도구 사용 ·
            스트리밍 응답을 표준화한다. <strong>LAN twinverse-ai 가 메인</strong>으로 모든
            정상 트래픽을 처리하고, <strong>Hostinger VPS 는 비상시 보조</strong>로
            failover · 외부망 접속 백업 경로 역할을 한다.
          </p>

          <div className={styles.heroPills}>
            <span className={styles.pill}>
              <span className={`${styles.pillDot} ${gatewayPill.dot}`} />
              {gatewayPill.label}
              {health?.version ? ` · v${health.version}` : ""}
            </span>
            <span className={styles.pill}>
              <span className={`${styles.pillDot} ${styles.pillDotPurple}`} />
              포트 18789 · RPC v1~v3
            </span>
            <span className={styles.pill}>
              <span className={`${styles.pillDot} ${styles.pillDotPurple}`} />
              기본 모델 <code>openai-codex/gpt-5.5</code>
            </span>
            <span className={styles.pill}>
              <span className={`${styles.pillDot} ${styles.pillDotPurple}`} />
              Ed25519 device pairing
            </span>
          </div>

          <div className={styles.heroActions}>
            <Link to="/admin/openclaw-console" className={`${styles.heroBtn} ${styles.heroBtnPrimary}`}>
              관리 콘솔 열기 →
            </Link>
            <Link to="/admin/openclaw-devices" className={`${styles.heroBtn} ${styles.heroBtnGhost}`}>
              디바이스 페어링
            </Link>
            <a
              href="https://openclaw-apco.srv1557851.hstgr.cloud/"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.heroBtn} ${styles.heroBtnGhost}`}
            >
              DeskRPG Web UI ↗
            </a>
          </div>
        </div>
      </header>

      {/* ───────── 0. 정체성 / 한 줄 요약 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>0</span>
            OpenClaw 란 무엇인가
          </h2>
          <p className={styles.sectionSub}>2026-04-26 시점 정의</p>
        </div>

        <div className={styles.statStrip}>
          <div className={styles.stat}>
            <span className={styles.statValue}>2</span>
            <span className={styles.statLabel}>운영 인스턴스</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>v3</span>
            <span className={styles.statLabel}>최신 RPC 프로토콜</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>:18789</span>
            <span className={styles.statLabel}>LAN 포트</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>≤3</span>
            <span className={styles.statLabel}>슬롯당 NPC 수</span>
          </div>
        </div>

        <div className={styles.note}>
          <span className={styles.noteIcon}>ℹ</span>
          <span>
            OpenClaw 는 Hostinger VPS 의 <strong>매니지드 제품</strong>(Express + 토큰 로그인 UI)
            이며, LAN 의 twinverse-ai 머신은 동일 컨테이너 이미지를 self-host 한 형태입니다.
            토큰 회수/재발급은 Hostinger 패널에서, LAN 토큰은 Orbitron secrets 에 보관됩니다.
          </span>
        </div>
      </section>

      {/* ───────── 1. 운영 인스턴스 비교 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>1</span>
            운영 토폴로지 — 메인 / 비상 보조
          </h2>
          <p className={styles.sectionSub}>2026-04-26 정정 · LAN 우선, Hostinger 는 failover</p>
        </div>

        <div className={styles.cardGrid}>
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>
                LAN · twinverse-ai
                <span className={`${styles.cardBadge} ${styles.cardBadgePrimary}`}>메인 ⭐</span>
              </h3>
            </div>
            <dl className={styles.cardKv}>
              <dt>위상</dt>
              <dd>모든 정상 OpenClaw 트래픽의 1차 백엔드</dd>
              <dt>호스트</dt>
              <dd>
                <code>192.168.219.117</code> (Office)
              </dd>
              <dt>WebSocket</dt>
              <dd>
                <code>ws://192.168.219.117:18789</code>
              </dd>
              <dt>도메인</dt>
              <dd>
                <code>wss://openclaw.twinverse.org</code>
              </dd>
              <dt>기본 모델</dt>
              <dd>
                <code>openai-codex/gpt-5.5</code>
              </dd>
              <dt>폴백</dt>
              <dd>
                <code>ollama/qwen2.5:7b</code> · <code>gemma3:12b</code>
              </dd>
              <dt>인증</dt>
              <dd>pairing + Ed25519 device key</dd>
              <dt>사용처</dt>
              <dd>TwinverseAI Office Tier 2 NPC · DeskRPG 백엔드 · 모든 신규 통합</dd>
            </dl>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>
                Hostinger VPS
                <span className={`${styles.cardBadge} ${styles.cardBadgeWarn}`}>비상 보조</span>
              </h3>
            </div>
            <dl className={styles.cardKv}>
              <dt>위상</dt>
              <dd>LAN 장애·점검·외부망 격리 시 failover 만 사용</dd>
              <dt>호스트</dt>
              <dd>
                <code>srv1557851.hstgr.cloud</code>
              </dd>
              <dt>WebSocket</dt>
              <dd>
                <code>wss://openclaw-apco.srv1557851.hstgr.cloud/openclaw</code>
              </dd>
              <dt>Web UI</dt>
              <dd>
                <a
                  href="https://openclaw-apco.srv1557851.hstgr.cloud/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  https://openclaw-apco.srv1557851.hstgr.cloud/
                </a>
              </dd>
              <dt>기본 모델</dt>
              <dd>
                <code>openai-codex/gpt-5.4</code>
              </dd>
              <dt>인증</dt>
              <dd>pairing + ChatGPT Plus OAuth</dd>
              <dt>제공</dt>
              <dd>Hostinger 매니지드 (Express UI)</dd>
              <dt>사용처</dt>
              <dd>비상 failover · 외부망 chat playground</dd>
            </dl>
          </article>
        </div>

        <div style={{ marginTop: "0.75rem" }} className={`${styles.note} ${styles.warn}`}>
          <span className={styles.noteIcon}>⚠</span>
          <span>
            정상 운영에서는 트래픽이 <strong>전부 LAN</strong> 으로 향합니다. Hostinger 는
            대기 상태로 두고, LAN 응답 불가 / 외부망 접근 필수 / OAuth refresh 점검 같은
            예외 상황에서만 수동 또는 폴백 정책으로 전환합니다. Hostinger <code>gpt-5.4</code>
            는 ChatGPT Plus OAuth refresh 에 취약하니 비상 사용 시 토큰 상태 먼저 확인.
          </span>
        </div>
      </section>

      {/* ───────── 2. 서버 인벤토리 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>2</span>
            배포 서버 인벤토리
          </h2>
          <p className={styles.sectionSub}>SSOT: infra-docs/ai-shared-registry.md</p>
        </div>

        <div className={styles.cardGrid}>
          <article className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>
                twinverse-ai ⭐
                <span className={`${styles.cardBadge} ${styles.cardBadgePrimary}`}>AI 컴퓨트</span>
              </h3>
            </div>
            <dl className={styles.cardKv}>
              <dt>IP</dt>
              <dd>
                <code>192.168.219.117</code>
              </dd>
              <dt>OS</dt>
              <dd>Ubuntu 24.04.4 LTS</dd>
              <dt>CPU</dt>
              <dd>AMD Threadripper 3970X (64T)</dd>
              <dt>RAM</dt>
              <dd>125 GB</dd>
              <dt>GPU</dt>
              <dd>RTX 3090 24 GB</dd>
              <dt>Disk</dt>
              <dd>913 GB NVMe (~817 GB free)</dd>
              <dt>Stack</dt>
              <dd>Docker 29.4 + nvidia-container-toolkit · Ollama 0.20.5 · Python 3.12.3</dd>
              <dt>SSH</dt>
              <dd>
                <code>ssh twinverse-ai</code> (사용자 stevenlim, NOPASSWD sudo)
              </dd>
              <dt>역할</dt>
              <dd>OpenClaw LAN · Ollama · ai-image-service</dd>
            </dl>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>
                GPU PC
                <span className={`${styles.cardBadge} ${styles.cardBadgeWarn}`}>UE5 전담</span>
              </h3>
            </div>
            <dl className={styles.cardKv}>
              <dt>IP</dt>
              <dd>
                <code>192.168.219.100</code>
              </dd>
              <dt>OS</dt>
              <dd>Windows 11</dd>
              <dt>GPU</dt>
              <dd>GTX 1080 × 2</dd>
              <dt>역할</dt>
              <dd>UE5 5.7.4 Pixel Streaming · TwinverseDesk PS2</dd>
              <dt>AI 서비스</dt>
              <dd>❌ 배치 금지 (이관 완료, Flux HF 캐시만 백업으로 보존)</dd>
            </dl>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>
                Orbitron
                <span className={`${styles.cardBadge} ${styles.cardBadgePrimary}`}>Web · DB · Secrets</span>
              </h3>
            </div>
            <dl className={styles.cardKv}>
              <dt>IP</dt>
              <dd>
                <code>192.168.219.101</code>
              </dd>
              <dt>OS</dt>
              <dd>Ubuntu 24.04.4</dd>
              <dt>RAM</dt>
              <dd>64 GB</dd>
              <dt>GPU</dt>
              <dd>GTX 1080 × 2 (서빙 X)</dd>
              <dt>Stack</dt>
              <dd>Docker 15+ 컨테이너 · PostgreSQL · Orbitron secrets</dd>
              <dt>SSH</dt>
              <dd>
                <code>ssh stevenlim@192.168.219.101</code>
              </dd>
              <dt>역할</dt>
              <dd>웹 배포 · 미디어 · API 키 보관 (SSOT)</dd>
            </dl>
          </article>

          <article className={styles.card}>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>
                Hostinger VPS
                <span className={`${styles.cardBadge} ${styles.cardBadgeWarn}`}>비상 보조</span>
              </h3>
            </div>
            <dl className={styles.cardKv}>
              <dt>위상</dt>
              <dd>LAN failover · 외부망 노출 백업</dd>
              <dt>플랜</dt>
              <dd>
                <code>KVM 2</code> (만료 2027-04-04, 자동 갱신)
              </dd>
              <dt>OS</dt>
              <dd>Ubuntu 24.04 LTS</dd>
              <dt>CPU</dt>
              <dd>2 코어</dd>
              <dt>RAM</dt>
              <dd>8 GB</dd>
              <dt>디스크</dt>
              <dd>100 GB (사용 8 GB / 8%)</dd>
              <dt>대역폭</dt>
              <dd>8 TB/월</dd>
              <dt>리전</dt>
              <dd>Malaysia · Kuala Lumpur</dd>
              <dt>FQDN</dt>
              <dd>
                <code>srv1557851.hstgr.cloud</code>
              </dd>
              <dt>OpenClaw</dt>
              <dd>
                <code>openclaw-apco.srv1557851.hstgr.cloud</code>
              </dd>
              <dt>IPv4</dt>
              <dd>
                <code>187.127.100.19</code>
              </dd>
              <dt>SSH</dt>
              <dd>
                <code>ssh root@187.127.100.19</code>
              </dd>
              <dt>컨테이너</dt>
              <dd>Traefik(traefik-86sw) → openclaw-apco</dd>
              <dt>방화벽</dt>
              <dd>커스텀 규칙 0개 ⚠ (보강 권장)</dd>
              <dt>백업</dt>
              <dd>스냅샷 2개 (자동 일일 미적용)</dd>
              <dt>운영</dt>
              <dd>대기 상태 · 비상 시에만 트래픽 전환</dd>
            </dl>
          </article>
        </div>
      </section>

      {/* ───────── 3. 아키텍처 다이어그램 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>3</span>
            아키텍처
          </h2>
          <p className={styles.sectionSub}>논리 구조 · 데이터 흐름</p>
        </div>

        <div className={styles.archWrap}>
          <pre className={styles.arch}>
{`        ┌──────────────────────────┐         ┌──────────────────────────┐
        │ TwinverseAI Office (LAN) │         │ DeskRPG (외부망 클라이언트)│
        │ Tier 2 NPC × 3 / slot     │         │ Node openclaw-gateway.js  │
        └─────────────┬─────────────┘         └─────────────┬────────────┘
                      │ wss (정상)                          │ wss (정상)
                      └──────────────┐         ┌────────────┘
                                     ▼         ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │  메인 ⭐  OpenClaw Gateway @ twinverse-ai (LAN)                     │
   │  ws://192.168.219.117:18789  ·  wss://openclaw.twinverse.org        │
   │   ┌──────────────────┐   ┌────────────────────────────┐            │
   │   │ Session Store    │   │ Agent Registry             │            │
   │   │ agent:{id}:{nm}  │   │ models / scopes / files    │            │
   │   └──────────────────┘   └────────────────────────────┘            │
   │   ┌──────────────────┐   ┌────────────────────────────┐            │
   │   │ Pairing / Auth   │   │ RPC Router (v1~v3)         │            │
   │   │ Ed25519 device   │   │ agents.* · chat.* · files  │            │
   │   └──────────────────┘   └────────────────────────────┘            │
   └────────────────────────────────────────┬───────────────────────────┘
                                            │
                                            │  비상 시 수동/폴백 전환만
                                            ▼  (정상 트래픽 X)
                  ╔════════════════════════════════════════════╗
                  ║  비상 보조  Hostinger VPS                     ║
                  ║  wss://openclaw-apco.srv1557851.hstgr.cloud  ║
                  ║  외부망 접속 / chat playground 백업            ║
                  ╚════════════════════════════════════════════╝

         ┌──────────────────────────────────────────────────┐
         │      CLI Agents (게이트웨이가 spawn 하는 백엔드)    │
         │  ChatGPT/Codex OAuth · Claude Code · Gemini       │
         │  Ollama (qwen2.5/gemma3) · 기타 어댑터              │
         └──────────────────────────────────────────────────┘`}
          </pre>
        </div>
      </section>

      {/* ───────── 4. 프로토콜 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>4</span>
            프로토콜 · RPC 메서드
          </h2>
          <p className={styles.sectionSub}>RPC v1~v3, modern v3</p>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>메서드</th>
                <th>설명</th>
                <th>핵심 파라미터</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>agents.list</code>
                </td>
                <td>사용 가능 에이전트 목록 조회</td>
                <td>—</td>
              </tr>
              <tr>
                <td>
                  <code>agents.create</code>
                </td>
                <td>에이전트 인스턴스 생성</td>
                <td>name · model · system prompt · tool 권한</td>
              </tr>
              <tr>
                <td>
                  <code>agents.delete</code>
                </td>
                <td>에이전트 삭제</td>
                <td>
                  <code>agentId</code> · <code>deleteFiles</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code>agents.files.get / .set / .list</code>
                </td>
                <td>에이전트별 작업파일 R/W</td>
                <td>
                  <code>agentId</code> · <code>name</code> · <code>content</code>
                </td>
              </tr>
              <tr className={styles.tableRowHi}>
                <td>
                  <code>chat.send</code>
                </td>
                <td>메시지 전송 + 스트리밍 delta (onDelta 콜백)</td>
                <td>
                  <code>sessionKey</code> · <code>message</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code>chat.abort</code>
                </td>
                <td>진행 중 스트림 취소</td>
                <td>
                  <code>sessionKey</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <h3 style={{ fontSize: "0.95rem", color: "#fff", margin: "0 0 0.5rem" }}>
            세션 키 / 모던(v3) 클라이언트 메타
          </h3>
          <ul className={styles.checkList}>
            <li>
              세션 키 형식: <code style={{ background: "rgba(255,255,255,0.06)", padding: "0.05em 0.35em", borderRadius: "4px" }}>agent:{`{agentId}`}:{`{sessionName}`}</code> — 동일 키로 재호출하면 같은 컨텍스트 영속.
            </li>
            <li>
              v3 메타: <code style={{ background: "rgba(255,255,255,0.06)", padding: "0.05em 0.35em", borderRadius: "4px" }}>client_id="cli"</code>, <code style={{ background: "rgba(255,255,255,0.06)", padding: "0.05em 0.35em", borderRadius: "4px" }}>client_mode="cli"</code>, <code style={{ background: "rgba(255,255,255,0.06)", padding: "0.05em 0.35em", borderRadius: "4px" }}>role="operator"</code>, scopes <code style={{ background: "rgba(255,255,255,0.06)", padding: "0.05em 0.35em", borderRadius: "4px" }}>operator.read/write/admin</code>.
            </li>
            <li>
              디바이스 키 보관: <code>~/.deskrpg/openclaw-devices/{`{sha256(identityKey)}`}.json</code> · 페어링 미완료 시 errorCode <code>PAIRING_REQUIRED</code> (HTTP 409).
            </li>
            <li>
              지원 모델: <code>openai-codex/gpt-5.5</code>, <code>openai-codex/gpt-5.4</code>, <code>claude-cli/claude-opus-4-6</code>, <code>ollama/qwen2.5:7b</code>.
            </li>
          </ul>
        </div>
      </section>

      {/* ───────── 5. 환경변수 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>5</span>
            환경변수 (전 프로젝트 표준)
          </h2>
          <p className={styles.sectionSub}>실제 값은 Orbitron secrets 만</p>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>변수</th>
                <th>의미</th>
                <th>값 예시</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>OPENCLAW_WS_URL</code>
                </td>
                <td>게이트웨이 WebSocket URL</td>
                <td>
                  <code>ws://192.168.219.117:18789</code> (Office)
                </td>
              </tr>
              <tr>
                <td>
                  <code>OPENCLAW_TOKEN</code>
                </td>
                <td>게이트웨이 인증 토큰 (인스턴스별)</td>
                <td>
                  <em>(Orbitron secrets)</em>
                </td>
              </tr>
              <tr>
                <td>
                  <code>OPENCLAW_MODEL</code>
                </td>
                <td>기본 에이전트 모델 (override 가능)</td>
                <td>
                  <code>openai-codex/gpt-5.5</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code>OLLAMA_URL</code>
                </td>
                <td>Ollama 직결 LLM</td>
                <td>
                  <code>http://192.168.219.117:11434</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code>AI_GPU_SERVER_URL</code>
                </td>
                <td>이미지 (Flux) 호스트</td>
                <td>
                  <code>http://192.168.219.117:8100</code>
                </td>
              </tr>
              <tr>
                <td>
                  <code>NPC_OLLAMA_MODEL</code>
                </td>
                <td>Office NPC 직결 단순 대화 모델</td>
                <td>
                  <code>gemma3:12b</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p style={{ marginTop: "0.85rem", color: "#a1a1aa", fontSize: "0.82rem" }}>
          값 형식 규칙: 항상 FQDN 또는 IP+포트, <code>localhost</code> 금지.
          Docker 컨테이너에서도 host IP 그대로 사용 가능 (twinverse-ai LAN 오픈).
        </p>
      </section>

      {/* ───────── 6. 활용 매트릭스 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>6</span>
            활용 매트릭스
          </h2>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>용도</th>
                <th>프로젝트</th>
                <th>1차 (메인)</th>
                <th>비상 보조</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              <tr className={styles.tableRowHi}>
                <td>Tier 2 에이전트 NPC (3D, 슬롯당 ≤3)</td>
                <td>TwinverseAI Office</td>
                <td>LAN twinverse-ai ⭐</td>
                <td>Hostinger (LAN 다운 시)</td>
                <td>✅ 운영 (Codex OAuth + Ollama 폴백)</td>
              </tr>
              <tr>
                <td>NPC 동료 (업무 위임, 2D, 채널별 n명)</td>
                <td>DeskRPG</td>
                <td>LAN twinverse-ai ⭐</td>
                <td>Hostinger (외부망 노출 필요 시)</td>
                <td>✅ 운영</td>
              </tr>
              <tr>
                <td>단순 NPC 대화 (말풍선 200자 이하)</td>
                <td>TwinverseAI Office</td>
                <td>Ollama gemma3:12b 직결</td>
                <td>—</td>
                <td>✅ OpenClaw 우회 (LAN Ollama)</td>
              </tr>
              <tr>
                <td>외부 자동화 워커</td>
                <td>(예정)</td>
                <td>LAN</td>
                <td>—</td>
                <td>📝 예약</td>
              </tr>
              <tr>
                <td>비용 차단 / 오프라인 폴백</td>
                <td>공용</td>
                <td>LAN Ollama</td>
                <td>—</td>
                <td>✅ 운영</td>
              </tr>
              <tr>
                <td>외부망 chat playground / 비상 콘솔</td>
                <td>관리·디버그</td>
                <td>—</td>
                <td>Hostinger Web UI</td>
                <td>✅ 대기 (필요 시 진입)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ───────── 7. 호출 예시 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>7</span>
            호출 예시 (Node.js)
          </h2>
          <p className={styles.sectionSub}>참조 클라이언트: deskrpg-master/src/lib/openclaw-gateway.js</p>
        </div>

        <pre className={styles.codeBlock}>
{`const gw = require("openclaw-gateway");
const client = gw.connect({
  url: process.env.OPENCLAW_WS_URL,    // ws://192.168.219.117:18789
  token: process.env.OPENCLAW_TOKEN,    // Orbitron secrets
});

// 세션 컨텍스트 유지하며 스트리밍 응답 받기
await client.chatSend(
  "agent_office_npc_01",
  "agent:agent_office_npc_01:greeting",   // sessionKey 영속
  "오늘 일정 요약해줘",
  (delta) => process.stdout.write(delta.text ?? "")
);`}
        </pre>
      </section>

      {/* ───────── 8. 빠른 진입 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>8</span>
            관리 진입점
          </h2>
          <p className={styles.sectionSub}>이 어드민에서 바로 운영</p>
        </div>

        <div className={styles.linkGrid}>
          <Link to="/admin/openclaw-console" className={styles.linkTile}>
            <span className={styles.linkTileTitle}>
              관리 콘솔 <span className={styles.linkTileArrow}>→</span>
            </span>
            <span className={styles.linkTileSub}>에이전트 · 플러그인 · 설정 · 채팅 · 로그</span>
          </Link>
          <Link to="/admin/openclaw-console/agents" className={styles.linkTile}>
            <span className={styles.linkTileTitle}>
              에이전트 <span className={styles.linkTileArrow}>→</span>
            </span>
            <span className={styles.linkTileSub}>CRUD · 모델 매핑 · 시스템 프롬프트</span>
          </Link>
          <Link to="/admin/openclaw-console/chat" className={styles.linkTile}>
            <span className={styles.linkTileTitle}>
              채팅 플레이그라운드 <span className={styles.linkTileArrow}>→</span>
            </span>
            <span className={styles.linkTileSub}>세션 영속 · 스트리밍 응답 테스트</span>
          </Link>
          <Link to="/admin/openclaw-console/config" className={styles.linkTile}>
            <span className={styles.linkTileTitle}>
              설정 <span className={styles.linkTileArrow}>→</span>
            </span>
            <span className={styles.linkTileSub}>config tree 직접 편집</span>
          </Link>
          <Link to="/admin/openclaw-console/token" className={styles.linkTile}>
            <span className={styles.linkTileTitle}>
              토큰 <span className={styles.linkTileArrow}>→</span>
            </span>
            <span className={styles.linkTileSub}>게이트웨이 토큰 회수/재발급</span>
          </Link>
          <Link to="/admin/openclaw-console/logs" className={styles.linkTile}>
            <span className={styles.linkTileTitle}>
              로그 <span className={styles.linkTileArrow}>→</span>
            </span>
            <span className={styles.linkTileSub}>stdout/stderr 실시간</span>
          </Link>
          <Link to="/admin/openclaw-devices" className={styles.linkTile}>
            <span className={styles.linkTileTitle}>
              디바이스 페어링 <span className={styles.linkTileArrow}>→</span>
            </span>
            <span className={styles.linkTileSub}>Ed25519 device key 등록·회수</span>
          </Link>
          <a
            href="https://openclaw-apco.srv1557851.hstgr.cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkTile}
          >
            <span className={styles.linkTileTitle}>
              DeskRPG Web UI <span className={styles.linkTileArrow}>↗</span>
            </span>
            <span className={styles.linkTileSub}>Hostinger 인스턴스 chat playground</span>
          </a>
        </div>
      </section>

      {/* ───────── 9. 주의사항 ───────── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionNum}>9</span>
            운영 시 주의
          </h2>
        </div>

        <div className={`${styles.note} ${styles.warn}`} style={{ marginBottom: "0.6rem" }}>
          <span className={styles.noteIcon}>⚠</span>
          <span>
            <strong>twinverse-ai 하드웨어 안정성</strong> — 연속 Flux 생성 중 전압 스파이크 추정 리부팅
            (커널 panic 없음). HW 미수리. 연속 생성 회피, 폴백 캐스케이드(Replicate/OpenAI) 상시 활성,
            <code> nvidia-smi -pl 280</code> 임시 적용 가능.
          </span>
        </div>
        <div className={`${styles.note} ${styles.warn}`} style={{ marginBottom: "0.6rem" }}>
          <span className={styles.noteIcon}>⚠</span>
          <span>
            에이전트 생성·일부 플러그인 변경은 게이트웨이 재시작을 유발할 수 있고, 재시작 시 페어링된
            기기의 토큰이 로테이트됩니다. <strong>야간 작업 회피</strong>.
          </span>
        </div>
        <div className={`${styles.note} ${styles.danger}`}>
          <span className={styles.noteIcon}>⛔</span>
          <span>
            <strong>비밀값 저장 금지</strong> — <code>OPENCLAW_TOKEN</code>, OAuth refresh token, device
            private key 는 코드/Wiki 평문 보관 절대 금지. Orbitron secrets 또는 인스턴스 내부
            <code> /data/.openclaw/openclaw.json</code> 만 사용.
          </span>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className={styles.footerMeta}>
        <span>
          SSOT: <code>infra-docs/ai-shared-registry.md §3.5</code>
        </span>
        <span>Last updated: 2026-04-26 · Steven Lim</span>
      </footer>
    </div>
  );
}
