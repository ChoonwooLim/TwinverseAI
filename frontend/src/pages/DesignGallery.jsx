import { useState, useEffect, useMemo, useRef } from "react";
import designsData from "../data/designs.json";
import styles from "./DesignGallery.module.css";

const SOURCE_URL = designsData.sourceUrl;
const CATEGORIES = designsData.categories;
const CHECKED_DATE = "2026-11-09";

const DESIGN_GUIDES = [
  {
    id: "responsive",
    title: "화면이 달라져도, 작업은 이어지게",
    topic: "반응형 레이아웃",
    summary: "모바일부터 넓은 작업 화면까지, 콘텐츠와 행동의 우선순위를 유지합니다.",
    checks: [
      "기기 이름보다 실제 콘텐츠가 들어갈 너비를 기준으로 레이아웃 전환점을 정합니다.",
      "유연한 그리드와 이미지, 읽기 편한 본문 폭을 사용하고 긴 한국어 제목과 확대된 글자도 확인합니다.",
      "작은 화면에서도 주요 작업을 찾을 수 있도록 버튼과 탐색을 재배치합니다.",
    ],
    sources: [{ label: "MDN · Responsive web design", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design" }],
  },
  {
    id: "accessibility",
    title: "접근성을 기본 품질로",
    topic: "WCAG 2.2",
    summary: "색상, 키보드, 포커스와 입력 방식을 함께 검토합니다.",
    checks: [
      "일반 텍스트 4.5:1, 큰 텍스트 3:1 이상의 명도 대비를 확인하고 상태를 색상만으로 구분하지 않습니다.",
      "키보드로 모든 주요 작업을 수행하고, 포커스가 보이며 다른 콘텐츠에 완전히 가려지지 않도록 합니다.",
      "WCAG 2.2 AA의 포인터 대상 크기 기준은 24×24 CSS px 또는 명시된 간격·예외 조건입니다. 실제 터치 사용성도 별도로 확인합니다.",
    ],
    sources: [{ label: "W3C · WCAG 2.2 Recommendation", url: "https://www.w3.org/TR/WCAG22/" }],
  },
  {
    id: "tokens",
    title: "화면 사이의 일관성을 만드는 토큰",
    topic: "Design Tokens 2025.10",
    summary: "색상·간격·타이포그래피에 역할을 부여해 디자인과 구현이 같은 언어를 쓰게 합니다.",
    checks: [
      "배경, 본문, 강조, 오류처럼 의미가 드러나는 이름으로 값을 정리하고 테마별 차이를 관리합니다.",
      "DTCG 2025.10의 Format·Color·Resolver 모듈을 도구 간 토큰 교환의 기준으로 검토합니다.",
      "DTCG 문서는 커뮤니티 그룹 최종 보고서입니다. W3C 표준이나 W3C Recommendation이 아니며, 도구별 지원 여부는 따로 확인합니다.",
    ],
    sources: [{ label: "DTCG · Technical Reports 2025.10", url: "https://www.designtokens.org/tr/2025.10/" }],
  },
  {
    id: "motion",
    title: "움직임에는 분명한 이유를",
    topic: "목적 있는 모션",
    summary: "전환과 피드백은 작업의 흐름을 설명하고, 사용자의 동작 줄이기 설정을 존중합니다.",
    checks: [
      "어디에서 무엇이 바뀌었는지 알 수 있는 전환을 설계하고 반복되는 장식적 움직임은 줄입니다.",
      "prefers-reduced-motion 설정에서는 큰 이동·확대 효과를 제거하거나 차분한 피드백으로 바꿉니다.",
      "애니메이션을 꺼도 완료, 오류, 선택 상태가 텍스트와 형태로 전달되는지 확인합니다.",
    ],
    sources: [{ label: "MDN · prefers-reduced-motion", url: "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion" }],
  },
  {
    id: "ai",
    title: "AI가 하는 일과 사용자가 할 일을 명확히",
    topic: "AI 인터페이스",
    summary: "생성 여부와 진행 상태를 드러내고 결과를 검토할 수 있는 흐름을 설계합니다.",
    checks: [
      "AI가 만든 내용에는 식별 가능한 표시를 두고, 사용자가 결과와 관련 설명에 접근하게 합니다.",
      "대기·생성 중·완료·실패를 구분하고, 오래 걸리는 작업에는 현재 진행 상황을 알립니다.",
      "Twinverse의 검토 기준으로 중단, 재시도, 결과 수정과 확인 동선을 설계합니다. 표시만으로 결과의 정확성을 보증하지 않습니다.",
    ],
    sources: [
      { label: "IBM Carbon · AI label", url: "https://www.carbondesignsystem.com/building-blocks/core/components/ai-label/guidelines" },
      { label: "IBM Carbon · Loading", url: "https://www.carbondesignsystem.com/building-blocks/core/components/loading/guidelines" },
    ],
  },
  {
    id: "spatial",
    title: "공간 속에서도 읽기 쉽고 조작하기 편하게",
    topic: "TwinverseDesk 설계 방향",
    summary: "깊이는 정보의 위계를 돕고, 핵심 작업은 안정적인 위치에서 수행하게 합니다.",
    checks: [
      "Apple의 공간 레이아웃 지침을 참고해 깊이 단서의 일관성과 시각적 편안함을 검토합니다.",
      "TwinverseDesk에는 읽기 쉬운 패널, 구분되는 조작 대상, 예측 가능한 작업 위치를 설계 방향으로 적용합니다.",
      "웹·마우스·터치와 공간 입력의 차이를 검증합니다. 이 가이드는 visionOS 지원이나 공간 접근성 구현 완료를 뜻하지 않습니다.",
    ],
    sources: [{ label: "Apple HIG · Spatial layout", url: "https://developer.apple.com/design/human-interface-guidelines/spatial-layout/" }],
  },
];

// 사용자가 추가/관리하는 프로젝트 목록 (localStorage에 저장)
const DEFAULT_PROJECTS = ["TwinverseAI", "SodamFN"];
const LS_PROJECTS = "designGallery.projects";
const LS_SELECTIONS = "designGallery.selections"; // { [projectName]: designSlug }

// 카테고리별 디자인을 평탄화한 배열 (필터/검색용)
const ALL_DESIGNS = CATEGORIES.flatMap((cat) =>
  cat.designs.map((d) => ({ ...d, category: cat.title }))
);

const fontFamily = (font) => {
  if (font === "mono") return "'JetBrains Mono', 'SF Mono', ui-monospace, monospace";
  if (font === "serif") return "'Tiempos', Georgia, 'Noto Serif KR', serif";
  return "'Inter', 'Noto Sans KR', system-ui, sans-serif";
};

const githubUrl = (slug) =>
  `${SOURCE_URL}/tree/main/design-md/${slug}/`;

const rawDesignMdUrl = (slug) =>
  `${SOURCE_URL}/blob/main/design-md/${slug}/DESIGN.md`;

function DesignCard({ design, isSelected, onSelect, onOpen }) {
  return (
    <div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
      style={{
        background: design.bg,
        color: design.text,
        borderColor: design.border,
        fontFamily: fontFamily(design.font),
      }}
      onClick={() => onOpen(design)}
    >
      <div className={styles.cardOverline} style={{ color: design.subtext }}>
        {design.category} · {design.name}
      </div>
      <div
        className={styles.cardTagline}
        style={{
          letterSpacing: design.font === "serif" ? "-0.015em" : "-0.02em",
          fontWeight: design.font === "serif" ? 500 : 600,
        }}
      >
        {design.tagline}
      </div>
      <div className={styles.cardSubtitle} style={{ color: design.subtext }}>
        {design.subtitle}
      </div>

      <div className={styles.cardButtons}>
        <span
          className={styles.btnPrimary}
          style={{
            background: design.accent,
            color: design.theme === "dark" && design.accent === "#FFFFFF" ? "#000" : (design.bg === design.accent ? design.text : "#fff"),
            borderRadius: design.btnRadius,
          }}
        >
          {design.btnText}
        </span>
        <span
          className={styles.btnSecondary}
          style={{
            color: design.text,
            borderColor: design.border,
            borderRadius: design.btnRadius,
          }}
        >
          {design.btnText2}
        </span>
      </div>

      <div className={styles.cardSwatches}>
        <div style={{ background: design.accent }} title="accent" />
        <div style={{ background: design.bg, border: `1px solid ${design.border}` }} title="bg" />
        <div style={{ background: design.surface }} title="surface" />
        <div style={{ background: design.subtext }} title="subtext" />
        <div style={{ background: design.text }} title="text" />
      </div>

      {isSelected && <div className={styles.selectedBadge}>● 선택됨</div>}

      <div className={styles.cardActions}>
        <button
          className={styles.cardApplyBtn}
          onClick={(e) => { e.stopPropagation(); onOpen(design); }}
          aria-label={`${design.name} 디자인 상세 보기`}
        >
          상세 보기
        </button>
        <button
          className={styles.cardApplyBtn}
          aria-pressed={isSelected}
          aria-label={`${design.name} 참고 디자인 ${isSelected ? "선택 해제" : "선택"}`}
          onClick={(e) => { e.stopPropagation(); onSelect(design); }}
        >
          {isSelected ? "선택 해제" : "참고 디자인 선택"}
        </button>
      </div>
    </div>
  );
}

function DesignDetailModal({ design, project, onClose, onSelect, isSelected }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!design) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modalRef.current?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [design]);

  if (!design) return null;

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    if (event.key !== "Tab") return;
    const focusable = modalRef.current.querySelectorAll("button:not([disabled]), a[href]");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-modal-title"
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <button className={styles.modalClose} onClick={onClose} aria-label="닫기">×</button>

        <div
          className={styles.modalPreview}
          style={{
            background: design.bg,
            color: design.text,
            fontFamily: fontFamily(design.font),
            borderColor: design.border,
          }}
        >
          <div className={styles.modalOverline} style={{ color: design.subtext }}>
            {design.category}
          </div>
          <h2 className={styles.modalTagline}>{design.tagline}</h2>
          <p className={styles.modalSubtitle} style={{ color: design.subtext }}>
            {design.subtitle}
          </p>
          <div className={styles.modalButtons}>
            <span
              className={styles.btnPrimary}
              style={{
                background: design.accent,
                color: design.theme === "dark" && design.accent === "#FFFFFF" ? "#000" : "#fff",
                borderRadius: design.btnRadius,
                padding: "10px 20px",
                fontSize: "14px",
              }}
            >
              {design.btnText}
            </span>
            <span
              className={styles.btnSecondary}
              style={{
                color: design.text,
                borderColor: design.border,
                borderRadius: design.btnRadius,
                padding: "10px 20px",
                fontSize: "14px",
              }}
            >
              {design.btnText2}
            </span>
          </div>
          <div className={styles.modalSwatchRow}>
            {[
              ["accent", design.accent],
              ["bg", design.bg],
              ["surface", design.surface],
              ["text", design.text],
              ["subtext", design.subtext],
              ["border", design.border],
            ].map(([label, color]) => (
              <div key={label} className={styles.swatchItem}>
                <div
                  className={styles.swatchChip}
                  style={{ background: color, border: `1px solid ${design.border}` }}
                />
                <div className={styles.swatchLabel} style={{ color: design.subtext }}>
                  {label}
                </div>
                <div className={styles.swatchHex} style={{ color: design.text }}>
                  {color}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.modalMeta}>
          <h3 id="design-modal-title" className={styles.modalName}>{design.name}</h3>
          <p className={styles.modalDesc}>{design.desc}</p>

          <div className={styles.metaGrid}>
            <div>
              <span className={styles.metaLabel}>테마</span>
              <span className={styles.metaValue}>{design.theme === "dark" ? "다크" : "라이트"}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>폰트</span>
              <span className={styles.metaValue}>
                {design.font === "mono" ? "모노스페이스" : design.font === "serif" ? "세리프" : "산세리프"}
              </span>
            </div>
            <div>
              <span className={styles.metaLabel}>버튼 라운딩</span>
              <span className={styles.metaValue}>{design.btnRadius}</span>
            </div>
            <div>
              <span className={styles.metaLabel}>액센트</span>
              <span className={styles.metaValue} style={{ color: design.accent }}>
                {design.accent}
              </span>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              className={`${styles.applyBtn} ${isSelected ? styles.applyBtnUnselect : ""}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(design)}
            >
              {isSelected
                ? `${project}에서 선택 해제`
                : `${project} 참고 디자인으로 선택`}
            </button>
            <a
              href={rawDesignMdUrl(design.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkBtn}
            >
              컬렉션의 DESIGN.md 보기 ↗
            </a>
            <a
              href={githubUrl(design.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkBtn}
            >
              GitHub 폴더 열기 ↗
            </a>
          </div>

          <div className={styles.dropInstruction}>
            <strong>참고 디자인 선택은 이 브라우저에만 저장됩니다.</strong> 사이트 테마나 프로젝트 파일은 변경되지 않습니다.
            실제 활용 시 출처의 <code>DESIGN.md</code>를 검토하고 브랜드·접근성 요구를 더해 AI 에이전트에게 구현을 요청하세요.
            일부 원문은 GitHub에서 getdesign.md로 안내합니다.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DesignGallery() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [modalDesign, setModalDesign] = useState(null);

  const [projects, setProjects] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_PROJECTS) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch { /* 저장된 목록을 읽을 수 없으면 기본 프로젝트를 사용합니다. */ }
    return DEFAULT_PROJECTS;
  });
  const [currentProject, setCurrentProject] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_PROJECTS) || "null");
      if (Array.isArray(saved) && saved.length) return saved[0];
    } catch { /* 저장된 목록을 읽을 수 없으면 기본 프로젝트를 사용합니다. */ }
    return DEFAULT_PROJECTS[0];
  });
  const [selections, setSelections] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_SELECTIONS) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(LS_SELECTIONS, JSON.stringify(selections));
  }, [selections]);

  const currentSelection = selections[currentProject] || null;

  const toggleSelect = (design) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[currentProject] === design.slug) {
        delete next[currentProject];
      } else {
        next[currentProject] = design.slug;
      }
      return next;
    });
  };

  const addProject = () => {
    const name = window.prompt("새 프로젝트 이름을 입력하세요:");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (projects.includes(trimmed)) {
      alert("이미 존재하는 프로젝트입니다.");
      return;
    }
    setProjects([...projects, trimmed]);
    setCurrentProject(trimmed);
  };

  const removeProject = () => {
    if (projects.length <= 1) {
      alert("최소 1개의 프로젝트는 유지해야 합니다.");
      return;
    }
    if (!window.confirm(`'${currentProject}' 프로젝트를 제거하시겠어요? 선택된 디자인 정보도 함께 삭제됩니다.`)) return;
    const next = projects.filter((p) => p !== currentProject);
    setProjects(next);
    setSelections((prev) => {
      const n = { ...prev };
      delete n[currentProject];
      return n;
    });
    setCurrentProject(next[0]);
  };

  const filtered = useMemo(() => {
    let list = ALL_DESIGNS;
    if (activeCategory !== "all") {
      list = list.filter((d) => d.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.tagline.toLowerCase().includes(q) ||
          d.desc.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, activeCategory]);

  const selectedDesign = useMemo(
    () => ALL_DESIGNS.find((d) => d.slug === currentSelection),
    [currentSelection]
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <span className={styles.overline}>Design Library · Twinverse Platform</span>
        <h1 className={styles.title}>영감을 찾고, 제품의 기준을 세우세요.</h1>
        <p className={styles.headerDesc}>
          웹 포털부터 AI와 함께 일하는 TwinverseDesk까지, 좋은 디자인은 사용자가 다음 행동을 이해하는 데서 시작합니다.
          브랜드별 시각적 참고자료를 비교하고, 반응형·접근성·AI 경험을 함께 검토해 프로젝트만의 디자인 언어를 만드세요.
        </p>
        <div className={styles.headerMeta}>
          <span>가이드·출처 확인 <time dateTime={CHECKED_DATE}>{CHECKED_DATE}</time></span>
          <span>로컬 참고 디자인 {ALL_DESIGNS.length}종</span>
        </div>
        <nav className={styles.sectionNav} aria-label="디자인 페이지 바로가기">
          <a href="#design-catalog">디자인 둘러보기 ↓</a>
          <a href="#design-guide">설계 가이드 읽기 ↓</a>
        </nav>
      </div>

      <section className={styles.workflow} aria-labelledby="design-workflow-title">
        <h2 id="design-workflow-title">참고자료에서 실제 화면까지</h2>
        <ol className={styles.workflowSteps}>
          <li><span>01</span><div><strong>비교하고 선택</strong><p>색상·서체·밀도를 살펴보고 프로젝트의 참고 디자인을 선택합니다.</p></div></li>
          <li><span>02</span><div><strong>우리의 기준으로 정리</strong><p>원문의 DESIGN.md를 검토해 브랜드, 사용자, 주요 작업에 맞게 구체화합니다.</p></div></li>
          <li><span>03</span><div><strong>구현하고 검증</strong><p>AI와 화면을 구현한 뒤 작은 화면, 키보드 조작, 상태별 피드백을 확인합니다.</p></div></li>
        </ol>
      </section>

      <section className={styles.guideSection} aria-labelledby="design-guide">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.overline}>Practical Design Guide</span>
            <h2 id="design-guide">보기 좋은 화면을 넘어, 쓰기 좋은 경험으로</h2>
          </div>
          <p>공식 문서를 바탕으로 정리한 설계·검토 지침입니다. 각 항목은 Twinverse 전체의 구현 완료나 접근성 인증을 의미하지 않습니다.</p>
        </div>
        <div className={styles.guideList}>
          {DESIGN_GUIDES.map((guide, index) => (
            <details key={guide.id} className={styles.guideItem}>
              <summary>
                <span className={styles.guideNumber}>{String(index + 1).padStart(2, "0")}</span>
                <span className={styles.guideTitle}><span>{guide.topic}</span><strong>{guide.title}</strong></span>
                <span className={styles.guideToggle} aria-hidden="true">+</span>
              </summary>
              <div className={styles.guideBody}>
                <p>{guide.summary}</p>
                <ul>{guide.checks.map((check) => <li key={check}>{check}</li>)}</ul>
                <div className={styles.guideSources}>
                  {guide.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>)}
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>

      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.overline}>Reference Collection</span>
          <h2 id="design-catalog">디자인 라이브러리 <span className={styles.catalogCount}>{ALL_DESIGNS.length}</span></h2>
        </div>
        <p>
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">VoltAgent/awesome-design-md ↗</a>의 공개 웹사이트 분석을 참고한 로컬 카탈로그입니다.
          각 브랜드의 공식 가이드가 아니며, 원본 컬렉션의 변경이 자동으로 반영되지는 않습니다.
        </p>
      </div>
      <p className={styles.selectionNotice}>
        <strong>이곳에서는 참고 디자인을 선택합니다.</strong> 프로젝트 목록과 선택은 현재 브라우저에 저장되며, 계정·다른 기기와 동기화되거나 실제 사이트 테마에 자동 적용되지 않습니다.
      </p>

      {/* 프로젝트 선택기 */}
      <div className={styles.projectBar}>
        <div className={styles.projectLabel}>프로젝트:</div>
        <div className={styles.projectTabs}>
          {projects.map((p) => (
            <button
              key={p}
              className={`${styles.projectTab} ${p === currentProject ? styles.projectTabActive : ""}`}
              aria-pressed={p === currentProject}
              onClick={() => setCurrentProject(p)}
            >
              {p}
              {selections[p] && <span className={styles.projectTabMark}>●</span>}
            </button>
          ))}
          <button className={styles.projectAddBtn} onClick={addProject}>+ 추가</button>
          {projects.length > 1 && (
            <button className={styles.projectRemoveBtn} onClick={removeProject}>− 제거</button>
          )}
        </div>
      </div>

      {/* 현재 선택 표시 */}
      {selectedDesign && (
        <div className={styles.currentSelection}>
          <div className={styles.currentSelLabel}>
            <strong>{currentProject}</strong>의 참고 디자인
          </div>
          <button
            className={styles.currentSelChip}
            aria-label={`${selectedDesign.name} 참고 디자인 상세 보기`}
            style={{
              background: selectedDesign.bg,
              borderColor: selectedDesign.border,
              color: selectedDesign.text,
            }}
            onClick={() => setModalDesign(selectedDesign)}
          >
            <span className={styles.currentSelDot} style={{ background: selectedDesign.accent }} />
            <span>{selectedDesign.name}</span>
            <span className={styles.currentSelDesc} style={{ color: selectedDesign.subtext }}>
              {selectedDesign.tagline}
            </span>
          </button>
        </div>
      )}

      {/* 검색 + 카테고리 필터 */}
      <div className={styles.controls}>
        <input
          type="search"
          aria-label="디자인 이름, 태그라인, 설명 검색"
          placeholder="이름, 태그라인, 설명으로 검색…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.catTabs}>
          <button
            className={`${styles.catTab} ${activeCategory === "all" ? styles.catTabActive : ""}`}
            aria-pressed={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
          >
            전체 ({ALL_DESIGNS.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.title}
              className={`${styles.catTab} ${activeCategory === cat.title ? styles.catTabActive : ""}`}
              aria-pressed={activeCategory === cat.title}
              onClick={() => setActiveCategory(cat.title)}
            >
              {cat.title} ({cat.designs.length})
            </button>
          ))}
        </div>
        <p className={styles.resultCount} role="status">{filtered.length}개의 참고 디자인</p>
      </div>

      {/* 그리드 */}
      <div className={styles.grid}>
        {filtered.map((design) => (
          <DesignCard
            key={design.slug}
            design={design}
            isSelected={currentSelection === design.slug}
            onSelect={toggleSelect}
            onOpen={setModalDesign}
          />
        ))}
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <p>조건에 맞는 디자인이 없습니다. 검색어를 바꾸거나 전체 카테고리를 확인해 보세요.</p>
            <button className={styles.projectAddBtn} onClick={() => { setSearch(""); setActiveCategory("all"); }}>검색·필터 초기화</button>
          </div>
        )}
      </div>

      <DesignDetailModal
        design={modalDesign}
        project={currentProject}
        isSelected={modalDesign && currentSelection === modalDesign.slug}
        onClose={() => setModalDesign(null)}
        onSelect={(d) => {
          toggleSelect(d);
        }}
      />
    </div>
  );
}
