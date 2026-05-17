import { useState, useEffect, useMemo } from "react";
import designsData from "../data/designs.json";
import styles from "./DesignGallery.module.css";

const SOURCE_URL = designsData.sourceUrl;
const CATEGORIES = designsData.categories;

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

const rawPreviewUrl = (slug, dark = false) =>
  `https://htmlpreview.github.io/?${SOURCE_URL}/blob/main/design-md/${slug}/${dark ? "preview-dark.html" : "preview.html"}`;

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

      <button
        className={styles.cardApplyBtn}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(design);
        }}
      >
        {isSelected ? "선택 해제" : "이 프로젝트에 적용"}
      </button>
    </div>
  );
}

function DesignDetailModal({ design, project, onClose, onSelect, isSelected }) {
  if (!design) return null;
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
          <h3 className={styles.modalName}>{design.name}</h3>
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
              onClick={() => onSelect(design)}
            >
              {isSelected
                ? `${project}에서 선택 해제`
                : `${project} 프로젝트에 적용`}
            </button>
            <a
              href={rawDesignMdUrl(design.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkBtn}
            >
              DESIGN.md 원본 보기 ↗
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
            <strong>적용 방법:</strong> DESIGN.md 파일을 프로젝트 루트(<code>C:\WORK\{project}\DESIGN.md</code>)에 저장한 뒤,
            AI 에이전트에게 "이 디자인으로 UI를 만들어줘"라고 지시하면 됩니다.
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
    } catch {}
    return DEFAULT_PROJECTS;
  });
  const [currentProject, setCurrentProject] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_PROJECTS) || "null");
      if (Array.isArray(saved) && saved.length) return saved[0];
    } catch {}
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
        <span className={styles.overline}>DESIGN.md Gallery</span>
        <h1 className={styles.title}>디자인 ({ALL_DESIGNS.length})</h1>
        <p className={styles.headerDesc}>
          유명 브랜드의 디자인 시스템을 <code>DESIGN.md</code> 형식으로 정리한 컬렉션입니다.
          프로젝트별로 디자인을 선택해 AI 에이전트가 일관된 UI를 만들도록 사용하세요.
          출처: <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer">VoltAgent/awesome-design-md ↗</a>
        </p>
      </div>

      {/* 프로젝트 선택기 */}
      <div className={styles.projectBar}>
        <div className={styles.projectLabel}>프로젝트:</div>
        <div className={styles.projectTabs}>
          {projects.map((p) => (
            <button
              key={p}
              className={`${styles.projectTab} ${p === currentProject ? styles.projectTabActive : ""}`}
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
            <strong>{currentProject}</strong>의 현재 디자인
          </div>
          <div
            className={styles.currentSelChip}
            style={{
              background: selectedDesign.bg,
              borderColor: selectedDesign.border,
              color: selectedDesign.text,
            }}
            onClick={() => setModalDesign(selectedDesign)}
          >
            <div className={styles.currentSelDot} style={{ background: selectedDesign.accent }} />
            <span>{selectedDesign.name}</span>
            <span className={styles.currentSelDesc} style={{ color: selectedDesign.subtext }}>
              {selectedDesign.tagline}
            </span>
          </div>
        </div>
      )}

      {/* 검색 + 카테고리 필터 */}
      <div className={styles.controls}>
        <input
          type="text"
          placeholder="이름, 태그라인, 설명으로 검색…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <div className={styles.catTabs}>
          <button
            className={`${styles.catTab} ${activeCategory === "all" ? styles.catTabActive : ""}`}
            onClick={() => setActiveCategory("all")}
          >
            전체 ({ALL_DESIGNS.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.title}
              className={`${styles.catTab} ${activeCategory === cat.title ? styles.catTabActive : ""}`}
              onClick={() => setActiveCategory(cat.title)}
            >
              {cat.title} ({cat.designs.length})
            </button>
          ))}
        </div>
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
          <div className={styles.empty}>검색 결과가 없습니다.</div>
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
