import { Link } from "react-router-dom";
import s from "./HomePage.module.css";

const DOC_MENU = [
  { key: "dev-plan", label: "개발계획서", icon: "📋", desc: "프로젝트 마일스톤과 기능 목록", accent: s.cardAccent1 },
  { key: "bugfix-log", label: "버그수정 로그", icon: "🐛", desc: "발견 및 수정된 버그 기록", accent: s.cardAccent2 },
  { key: "upgrade-log", label: "업그레이드 로그", icon: "🚀", desc: "기능 추가 및 개선 이력", accent: s.cardAccent3 },
  { key: "work-log", label: "작업일지", icon: "📝", desc: "일별 작업 내역 및 진행 상황", accent: s.cardAccent4 },
];

const TOOL_MENU = [
  { path: "/skills", label: "AI 스킬", icon: "🧠", desc: "사용 가능한 Claude 스킬 목록 및 상세 설명" },
  { path: "/plugins", label: "플러그인 (MCP)", icon: "🔌", desc: "설치된 MCP 플러그인 조회, 설정, 추가" },
];

export default function HomePage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  return (
    <div>
      {/* ── Hero ── */}
      <header className={s.hero}>
        <div className={s.heroInner}>
          <div>
            <h1 className={`${s.heroTitle} ${s.animFadeUp}`}>TwinverseAI</h1>
            <hr className={`${s.heroSeparator} ${s.animFadeUp} ${s.animDelay1}`} />
            <p className={`${s.heroSubtitle} ${s.animFadeUp} ${s.animDelay2}`}>
              Project Hub
            </p>
          </div>

          <div className={`${s.heroAuth} ${s.animFadeUp} ${s.animDelay2}`}>
            {user ? (
              <>
                <span className={s.greeting}>{user.username}님 환영합니다</span>
                {(user.role === "admin" || user.role === "superadmin") && (
                  <Link to="/admin" className={s.adminLink}>
                    어드민 대시보드 &rarr;
                  </Link>
                )}
              </>
            ) : (
              <Link to="/login" className={s.loginLink}>로그인</Link>
            )}
          </div>
        </div>
      </header>

      <main className={s.main}>
        {/* ── Project Documents ── */}
        <section className={s.section}>
          <h2 className={`${s.sectionTitle} ${s.animFadeUp} ${s.animDelay1}`}>
            프로젝트 문서
          </h2>
          <div className={s.cardGrid}>
            {DOC_MENU.map((doc, i) => (
              <Link
                key={doc.key}
                to={`/docs/${doc.key}`}
                className={`${s.card} ${doc.accent} ${s.animFadeUp} ${s[`animDelay${i + 1}`]}`}
              >
                <span className={s.cardIcon}>{doc.icon}</span>
                <h3 className={s.cardTitle}>{doc.label}</h3>
                <p className={s.cardDesc}>{doc.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ── AI Tools ── */}
        <section className={s.section}>
          <h2 className={`${s.sectionTitle} ${s.animFadeUp} ${s.animDelay3}`}>
            AI 도구
          </h2>
          <div className={s.toolGrid}>
            {TOOL_MENU.map((tool, i) => (
              <Link
                key={tool.path}
                to={tool.path}
                className={`${s.toolCard} ${s.animFadeUp} ${s[`animDelay${i + 5}`]}`}
              >
                <span className={s.toolIcon}>{tool.icon}</span>
                <h3 className={s.toolTitle}>{tool.label}</h3>
                <p className={s.toolDesc}>{tool.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className={s.footer}>
        <p className={s.footerText}>TwinverseAI &middot; Built with React + Vite</p>
      </footer>
    </div>
  );
}
