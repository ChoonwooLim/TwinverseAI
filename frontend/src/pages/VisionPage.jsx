import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./VisionPage.module.css";
import { TechnologyReferences } from "../components/Introduction";
import { CONTENT_REVIEWED_AT } from "../data/platformContent";

/* ── Data ── */
const PILLARS = [
  {
    num: "01",
    title: "Photorealistic Virtual Space",
    sub: "포토리얼리스틱 가상 공간",
    desc: "Unreal Engine 기반의 몰입형 공간을 작업과 창작의 무대로 발전시킵니다. 고해상도 표현은 장기 지향점이며, 실제 스트리밍 품질은 콘텐츠·서버·연결 환경을 기준으로 검증합니다.",
    accent: "var(--neon-cyan)",
  },
  {
    num: "02",
    title: "AI-Powered 1-Person Enterprise",
    sub: "AI 1인 기업 시스템",
    desc: "기획, 개발, 디자인, 마케팅 등 역할별 에이전트가 협업하는 1인 기업 환경을 목표로 합니다. 현재의 관리자용 에이전트 콘솔을 기반으로, 50종 전문가 역할과 공간 안의 작업 연결을 장기적으로 확장합니다.",
    accent: "var(--neon-violet)",
  },
  {
    num: "03",
    title: "Pixel Streaming Desktop",
    sub: "브라우저 기반 가상 데스크탑",
    desc: "TwinverseDesk는 Pixel Streaming을 활용한 가상 작업 공간입니다. 준비된 서버의 실행 화면을 브라우저에서 조작하며, 기기와 네트워크 조건에 맞는 접속 경험을 다듬어 갑니다.",
    accent: "var(--neon-green)",
  },
  {
    num: "04",
    title: "Digital Economy Ecosystem",
    sub: "디지털 경제 생태계",
    desc: "크리에이터의 자산과 서비스가 새로운 가치로 이어지는 생태계를 구상합니다. 디지털 자산의 유통, AI 서비스 협업과 수익화는 신뢰할 수 있는 운영 기반 위에서 단계적으로 검토할 장기 목표입니다.",
    accent: "var(--gold-500)",
  },
];

const STATS = [
  { value: "25M", label: "직접 사용자 목표", sub: "2034년 장기 비전" },
  { value: "100M", label: "간접 사용자 목표", sub: "2034년 장기 비전" },
  { value: "50", label: "AI 전문가 역할 목표", sub: "현재 제공 수량이 아닙니다" },
  { value: "4,770", label: "억원 매출 목표", sub: "2034년 장기 비전" },
];

const TIMELINE = [
  { phase: "Phase 1", year: "현재 기반", title: "웹 포털과 운영 도구", desc: "소개·디자인·커뮤니티와 관리자용 AI 콘솔, 이메일 보고서를 연결한 웹 기반", status: "active" },
  { phase: "Phase 2", year: "연동·검증 중", title: "브라우저 가상 공간", desc: "UE5 Solo 환경의 스트리밍 진입과 연결 경험을 검증하고 안정성 개선", status: "active" },
  { phase: "Phase 3", year: "다음 확장", title: "공간과 AI의 연결", desc: "기존 AI 연동 코드를 바탕으로 공간 안의 대화·업무 연결과 사용자별 권한 검증", status: "next" },
  { phase: "Phase 4", year: "계획", title: "함께 쓰는 가상 사무실", desc: "여러 사용자의 접속, 아바타, 소통과 공동 작업 경험을 단계별 검증", status: "future" },
  { phase: "Phase 5", year: "장기 목표", title: "AI 1인 기업", desc: "50종 전문가 역할과 비즈니스 도구가 이어지는 작업 체계 구축", status: "future" },
  { phase: "Phase 6", year: "장기 목표", title: "크리에이터 생태계", desc: "디지털 자산과 AI 서비스를 중심으로 협업·유통·수익화 모델 확장", status: "future" },
];

const TECH_STACK = [
  { category: "가상 공간", items: ["Unreal Engine", "Pixel Streaming 2", "WebRTC"] },
  { category: "AI 운영", items: ["OpenClaw", "역할별 에이전트", "Ollama · 외부 모델 연결"] },
  { category: "웹 애플리케이션", items: ["React", "FastAPI", "WebSocket"] },
  { category: "서비스 기반", items: ["Docker", "PostgreSQL", "Orbitron 배포"] },
];

/* ── Intersection Observer Hook ── */
function useReveal(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ── Components ── */

function StarField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animId;
    let stars = [];

    function resize() {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      initStars();
    }

    function initStars() {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      stars = Array.from({ length: 200 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        speed: Math.random() * 0.3 + 0.05,
        opacity: Math.random() * 0.7 + 0.3,
        pulse: Math.random() * Math.PI * 2,
      }));
    }

    function draw() {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.pulse += 0.01;
        s.y -= s.speed;
        if (s.y < -2) { s.y = h + 2; s.x = Math.random() * w; }
        const alpha = s.opacity * (0.6 + 0.4 * Math.sin(s.pulse));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }
      if (!reducedMotion.matches) animId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className={styles.starField} aria-hidden="true" />;
}

function StatBlock({ value, label, sub, delay }) {
  const [ref, visible] = useReveal(0.2);
  return (
    <div ref={ref} className={`${styles.stat} ${visible ? styles.statVisible : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statSub}>{sub}</span>
    </div>
  );
}

function PillarCard({ num, title, sub, desc, accent, index }) {
  const [ref, visible] = useReveal(0.12);
  const isEven = index % 2 === 0;
  return (
    <div
      ref={ref}
      className={`${styles.pillar} ${visible ? styles.pillarVisible : ""} ${isEven ? styles.pillarLeft : styles.pillarRight}`}
      style={{ transitionDelay: `${index * 120}ms` }}
    >
      <div className={styles.pillarNum} style={{ color: accent }}>{num}</div>
      <div className={styles.pillarContent}>
        <h3 className={styles.pillarTitle}>{title}</h3>
        <span className={styles.pillarSub}>{sub}</span>
        <p className={styles.pillarDesc}>{desc}</p>
      </div>
      <div className={styles.pillarAccent} style={{ background: accent }} />
    </div>
  );
}

function TimelineItem({ phase, year, title, desc, status, index }) {
  const [ref, visible] = useReveal(0.15);
  return (
    <div
      ref={ref}
      className={`${styles.tlItem} ${styles[`tl_${status}`]} ${visible ? styles.tlVisible : ""}`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className={styles.tlDot} />
      <div className={styles.tlCard}>
        <div className={styles.tlMeta}>
          <span className={styles.tlPhase}>{phase}</span>
          <span className={styles.tlYear}>{year}</span>
        </div>
        <h4 className={styles.tlTitle}>{title}</h4>
        <p className={styles.tlDesc}>{desc}</p>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function VisionPage() {
  const [heroRef, heroVisible] = useReveal(0.05);
  const [statsRef, statsVisible] = useReveal(0.1);
  const [techRef, techVisible] = useReveal(0.1);
  const [ctaRef, ctaVisible] = useReveal(0.1);

  return (
    <div className={styles.vision}>
      {/* ━━━ Hero ━━━ */}
      <section ref={heroRef} className={`${styles.hero} ${heroVisible ? styles.heroVisible : ""}`}>
        <StarField />
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <span className={styles.heroOverline}>THE WORLD WE ARE BUILDING</span>
          <h1 className={styles.heroTitle}>
            인간과 AI가<br />
            <span className={styles.heroGradient}>공존하는 세계</span>
          </h1>
          <p className={styles.heroDesc}>
            Twinverse Platform은 가상 공간과 AI 동료를 연결해<br className={styles.brDesktop} />
            누구나 일하고, 창조하고, 성장할 수 있는 생태계를 만들어 갑니다.
          </p>
          <div className={styles.heroActions}>
            <a href="#pillars" className={styles.heroPrimary}>비전 탐색하기</a>
            <Link to="/twinversedesk/analysis" className={styles.heroSecondary}>TwinverseDesk 보기</Link>
          </div>
        </div>
        <div className={styles.heroScroll}>
          <span>SCROLL</span>
          <div className={styles.scrollLine} />
        </div>
      </section>

      {/* ━━━ Stats Bar ━━━ */}
      <p className={styles.goalNote}>아래 수치는 2034년을 향한 장기 목표이며 현재 실적이나 제공 기능을 의미하지 않습니다.</p>
      <section ref={statsRef} aria-label="장기 비전 목표" className={`${styles.statsBar} ${statsVisible ? styles.statsBarVisible : ""}`}>
        {STATS.map((s, i) => (
          <StatBlock key={s.label} {...s} delay={i * 150} />
        ))}
      </section>

      {/* ━━━ Pillars ━━━ */}
      <section id="pillars" className={styles.pillarsSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.overline}>CORE PILLARS</span>
          <h2 className={styles.sectionTitle}>플랫폼의 4대 축</h2>
          <p className={styles.sectionDesc}>
            Twinverse Platform은 네 가지 핵심 기둥 위에 세워집니다.<br className={styles.brDesktop} />
            현재의 웹·스트리밍·AI 도구를 연결하며 이 방향으로 발전시킵니다.
          </p>
        </div>
        <div className={styles.pillarsGrid}>
          {PILLARS.map((p, i) => (
            <PillarCard key={p.num} {...p} index={i} />
          ))}
        </div>
      </section>

      {/* ━━━ TwinverseDesk Showcase ━━━ */}
      <section className={styles.showcase}>
        <div className={styles.showcaseInner}>
          <div className={styles.showcaseText}>
            <span className={styles.overline}>CORE PRODUCT</span>
            <h2 className={styles.showcaseTitle}>
              TwinverseDesk
            </h2>
            <p className={styles.showcaseDesc}>
              TwinverseDesk는 플랫폼의 핵심 진입점이자 미래의 작업 공간입니다.
              지금은 브라우저에서 UE5 Solo 환경에 접속하는 흐름을 검증하고,
              AI 동료와 협업하는 경험으로 확장하고 있습니다.
            </p>
            <ul className={styles.showcaseList}>
              <li>현재: 브라우저 스트리밍 실행 화면과 공간 선택</li>
              <li>이용 조건: 서버 가동, 사용 가능한 세션과 호환 브라우저</li>
              <li>다음 단계: 가상 공간과 AI 작업의 통합 검증</li>
              <li>장기 방향: 멀티유저 사무실과 역할별 전문가 협업</li>
            </ul>
            <Link to="/twinversedesk/launch" className={styles.showcaseCta}>
              TwinverseDesk 시작하기
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </Link>
          </div>
          <div className={styles.showcaseVisual}>
            <div className={styles.deskMockup}>
              <div className={styles.deskScreen}>
                <div className={styles.deskTopBar}>
                  <div className={styles.deskDots}><span /><span /><span /></div>
                  <span className={styles.deskTitle}>TwinverseDesk · 작업 공간 콘셉트</span>
                </div>
                <div className={styles.deskBody}>
                  <div className={styles.deskSidebar}>
                    <div className={styles.deskAvatar} />
                    <div className={styles.deskMenuItem} style={{ width: "80%" }} />
                    <div className={styles.deskMenuItem} style={{ width: "65%" }} />
                    <div className={styles.deskMenuItem} style={{ width: "75%" }} />
                    <div className={styles.deskMenuItem} style={{ width: "55%" }} />
                    <div className={styles.deskMenuDivider} />
                    <div className={styles.deskMenuItem} style={{ width: "70%" }} />
                    <div className={styles.deskMenuItem} style={{ width: "60%" }} />
                  </div>
                  <div className={styles.deskMain}>
                    <div className={styles.deskWidget} />
                    <div className={styles.deskWidget} />
                    <div className={styles.deskWidgetWide} />
                  </div>
                </div>
              </div>
              <div className={styles.deskReflection} />
            </div>
          </div>
        </div>
      </section>

      {/* ━━━ Timeline ━━━ */}
      <section className={styles.timelineSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.overline}>ROADMAP</span>
          <h2 className={styles.sectionTitle}>현재의 기반에서 다음 경험으로</h2>
          <p className={styles.sectionDesc}>
            공개된 기반과 진행 중인 검증, 장기 목표를 구분합니다.<br className={styles.brDesktop} />
            이후 단계는 기술·운영 검증에 따라 구체화하며 출시 일정을 확약하지 않습니다.
          </p>
        </div>
        <div className={styles.timeline}>
          <div className={styles.tlLine} />
          {TIMELINE.map((t, i) => (
            <TimelineItem key={t.phase} {...t} index={i} />
          ))}
        </div>
      </section>

      {/* ━━━ Tech Stack ━━━ */}
      <section ref={techRef} className={`${styles.techSection} ${techVisible ? styles.techVisible : ""}`}>
        <div className={styles.sectionIntro}>
          <span className={styles.overline}>TECHNOLOGY</span>
          <h2 className={styles.sectionTitle}>현재 제품을 이루는 기술</h2>
          <p className={styles.sectionDesc}>특정 모델의 이름보다 작업 적합성, 연결 안정성, 사용 경험을 기준으로 발전시킵니다.</p>
        </div>
        <div className={styles.techGrid}>
          {TECH_STACK.map((cat) => (
            <div key={cat.category} className={styles.techCategory}>
              <h4 className={styles.techCatTitle}>{cat.category}</h4>
              <div className={styles.techTags}>
                {cat.items.map((item) => (
                  <span key={item} className={styles.techTag}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ CTA ━━━ */}
      <TechnologyReferences />
      <section ref={ctaRef} className={`${styles.cta} ${ctaVisible ? styles.ctaVisible : ""}`}>
        <div className={styles.ctaGlow} />
        <h2 className={styles.ctaTitle}>다음 작업 방식을 함께 만드세요</h2>
        <p className={styles.ctaDesc}>
          지금 준비된 경험을 살펴보고, 앞으로 필요한 기능을 이야기해 주세요.<br className={styles.brDesktop} />
          소개·개발 현황 확인: {CONTENT_REVIEWED_AT}
        </p>
        <div className={styles.ctaActions}>
          <Link to="/twinversedesk/launch" className={styles.ctaPrimary}>TwinverseDesk 시작</Link>
          <Link to="/about" className={styles.ctaSecondaryLink}>더 알아보기</Link>
        </div>
      </section>
    </div>
  );
}
