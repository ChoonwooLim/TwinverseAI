import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./VisionPage.module.css";

/* ── Data ── */
const PILLARS = [
  {
    num: "01",
    title: "Photorealistic Virtual Space",
    sub: "포토리얼리스틱 가상 공간",
    desc: "Unreal Engine 5의 Nanite, Lumen, Ray Tracing으로 현실과 구별할 수 없는 가상 세계를 구현합니다. 4K~16K 해상도, 120fps의 극한 몰입 경험.",
    accent: "var(--neon-cyan)",
  },
  {
    num: "02",
    title: "AI-Powered 1-Person Enterprise",
    sub: "AI 1인 기업 시스템",
    desc: "50명의 AI 전문가 에이전트가 당신의 가상 사무실에서 함께 일합니다. 기획, 개발, 디자인, 마케팅, 법률, 재무 — 혼자서도 세계적 기업을 운영하세요.",
    accent: "var(--neon-violet)",
  },
  {
    num: "03",
    title: "Pixel Streaming Desktop",
    sub: "브라우저 기반 가상 데스크탑",
    desc: "TwinverseDesk는 브라우저만으로 접속하는 UE5 가상 데스크탑입니다. 설치 없이, 어디서든, 어떤 기기에서든 당신만의 디지털 세계에 접속하세요.",
    accent: "var(--neon-green)",
  },
  {
    num: "04",
    title: "Digital Economy Ecosystem",
    sub: "디지털 경제 생태계",
    desc: "크리에이터, 기업, AI가 함께 만드는 새로운 경제. 디지털 자산 마켓, AI 서비스 거래, 가상 부동산 — 무한한 기회의 플랫폼.",
    accent: "var(--gold-500)",
  },
];

const STATS = [
  { value: "25M", label: "목표 사용자", sub: "2034년 직접 사용자" },
  { value: "100M", label: "간접 사용자", sub: "글로벌 영향 범위" },
  { value: "50", label: "AI 전문가", sub: "1인 기업당 에이전트" },
  { value: "4,770", label: "억원 매출", sub: "2034년 목표" },
];

const TIMELINE = [
  { phase: "Phase 1", year: "2026", title: "Foundation", desc: "웹 포탈 구축 + UE5 기반 TwinverseDesk 프로토타입", status: "active" },
  { phase: "Phase 2", year: "2026–27", title: "Streaming", desc: "Pixel Streaming 연동 — 브라우저에서 UE5 가상 공간 접속", status: "next" },
  { phase: "Phase 3", year: "2027–28", title: "AI Integration", desc: "TwinverseDesk 내 AI 비서 50종 에이전트 통합", status: "future" },
  { phase: "Phase 4", year: "2028–30", title: "Metaverse", desc: "멀티유저 가상 공간, 아바타, 소셜 네트워크 구축", status: "future" },
  { phase: "Phase 5", year: "2030–32", title: "AI Enterprise", desc: "AI 1인 기업 시스템 — 12만 기업, 평균 매출 3억원", status: "future" },
  { phase: "Phase 6", year: "2032–34", title: "Platform Economy", desc: "디지털 자산 마켓, 크리에이터 수익화, 글로벌 확장", status: "future" },
];

const TECH_STACK = [
  { category: "렌더링", items: ["UE5 Nanite", "Lumen GI", "Ray Tracing", "World Partition"] },
  { category: "AI", items: ["GPT-4o", "Claude Opus", "Gemini", "DALL-E 3", "Veo 3"] },
  { category: "스트리밍", items: ["Pixel Streaming 2", "WebRTC", "NVENC", "Edge CDN"] },
  { category: "인프라", items: ["Docker GPU", "Kubernetes", "PostgreSQL", "Zero-Trust"] },
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
      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className={styles.starField} />;
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
          <span className={styles.heroOverline}>THE FUTURE IS HERE</span>
          <h1 className={styles.heroTitle}>
            인간과 AI가<br />
            <span className={styles.heroGradient}>공존하는 세계</span>
          </h1>
          <p className={styles.heroDesc}>
            Twinverse Platform은 포토리얼리스틱 가상 공간에서<br className={styles.brDesktop} />
            50명의 AI 전문가와 함께 일하고, 창조하고, 성장하는 차세대 플랫폼입니다.
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
      <section ref={statsRef} className={`${styles.statsBar} ${statsVisible ? styles.statsBarVisible : ""}`}>
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
            각각이 독립적인 혁신이며, 함께 결합하면 전에 없던 생태계가 탄생합니다.
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
              브라우저를 열면 당신만의 가상 사무실이 펼쳐집니다.
              UE5 Pixel Streaming으로 구현된 포토리얼리스틱 데스크탑에서
              50명의 AI 전문가가 대기하고 있습니다.
            </p>
            <ul className={styles.showcaseList}>
              <li>설치 없음 — 브라우저만으로 접속</li>
              <li>50종 AI 에이전트 — 기획부터 법률까지</li>
              <li>4K 120fps — 현실과 구별 불가능한 품질</li>
              <li>어디서든 — PC, 태블릿, 모바일</li>
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
                  <span className={styles.deskTitle}>TwinverseDesk v1.0</span>
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
          <h2 className={styles.sectionTitle}>여정의 시작</h2>
          <p className={styles.sectionDesc}>
            2026년 첫 발걸음부터 2034년 글로벌 플랫폼까지 —<br className={styles.brDesktop} />
            매 단계가 새로운 가능성의 문을 엽니다.
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
          <h2 className={styles.sectionTitle}>최전선의 기술</h2>
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
      <section ref={ctaRef} className={`${styles.cta} ${ctaVisible ? styles.ctaVisible : ""}`}>
        <div className={styles.ctaGlow} />
        <h2 className={styles.ctaTitle}>미래는 기다려주지 않습니다</h2>
        <p className={styles.ctaDesc}>
          Twinverse Platform에서 당신의 AI 파트너 50명이 기다리고 있습니다.<br className={styles.brDesktop} />
          지금 시작하세요.
        </p>
        <div className={styles.ctaActions}>
          <Link to="/twinversedesk/launch" className={styles.ctaPrimary}>TwinverseDesk 시작</Link>
          <Link to="/about" className={styles.ctaSecondaryLink}>더 알아보기</Link>
        </div>
      </section>
    </div>
  );
}
