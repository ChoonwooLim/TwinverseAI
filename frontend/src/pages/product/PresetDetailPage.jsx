import { Link, useParams } from "react-router-dom";
import { findPreset, findPresetCategory } from "../../data/productPresets";
import { canViewAdminMedia } from "../../data/presetMedia";
import { readToken, readUser } from "../../services/session";
import PresetMedia from "./PresetMedia";
import PresetNotes from "./PresetNotes";
import productStyles from "./Product.module.css";
import styles from "./PresetDetail.module.css";

const MEDIA_SECTION_ID = "preset-media";
const NOTES_SECTION_ID = "preset-notes";

const sectionAnchor = (id) => `preset-${id}`;

function NotFound({ category }) {
  return (
    <div className={productStyles.page}>
      <header className={productStyles.pageHeader}>
        <span className={productStyles.overline}>Product · Presets</span>
        <h1 className={productStyles.title}>찾을 수 없는 프리셋입니다.</h1>
      </header>
      {category ? (
        <Link to={`/product/${category.slug}`} className={productStyles.textLink}>
          {category.label} 목록으로 돌아가기
        </Link>
      ) : (
        <Link to="/product" className={productStyles.textLink}>프리셋 라이브러리로 돌아가기</Link>
      )}
    </div>
  );
}

function StepsSection({ section }) {
  return (
    <ol className={styles.steps} role="list">
      {section.items.map((step, index) => (
        <li key={`${section.id}-${index}`} className={styles.step}>
          <span className={styles.stepNumber}>{index + 1}</span>
          <div className={styles.stepBody}>
            <h3 className={styles.itemTitle}>{step.title}</h3>
            <p className={styles.itemText}>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ListSection({ section }) {
  return (
    <ul className={styles.cards} role="list">
      {section.items.map((entry, index) => (
        <li key={`${section.id}-${index}`} className={styles.card}>
          <h3 className={styles.itemTitle}>{entry.title}</h3>
          <p className={styles.itemText}>{entry.body}</p>
        </li>
      ))}
    </ul>
  );
}

function TableSection({ section, headingId }) {
  return (
    <>
      {/* Focusable so keyboard users can scroll the table sideways on narrow screens. */}
      <div className={styles.tableScroll} role="region" aria-labelledby={headingId} tabIndex={0}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>{section.title}</caption>
          <thead>
            <tr>
              {section.columns.map((column) => (
                <th key={column} scope="col">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {section.rows.map((row, rowIndex) => (
              <tr key={`${section.id}-${rowIndex}`}>
                {row.map((cell, cellIndex) =>
                  cellIndex === 0 ? (
                    <th key={cellIndex} scope="row">{cell}</th>
                  ) : (
                    <td key={cellIndex}>{cell}</td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.tableHint} aria-hidden="true">표를 옆으로 밀면 나머지 열이 보입니다.</p>
    </>
  );
}

const SECTION_KINDS = new Set(["steps", "list", "table"]);

function SectionBody({ section, headingId }) {
  if (section.kind === "steps") return <StepsSection section={section} />;
  if (section.kind === "list") return <ListSection section={section} />;
  return <TableSection section={section} headingId={headingId} />;
}

export default function PresetDetailPage() {
  const { category: slug, presetId } = useParams();
  const category = findPresetCategory(slug);
  const preset = findPreset(slug, presetId);
  const detail = preset?.detail;

  if (!category || !preset || !detail) return <NotFound category={category} />;

  const token = readToken();
  const canView = canViewAdminMedia(readUser(), token);
  const signedIn = Boolean(token);
  const hasTags = Array.isArray(preset.tags) && preset.tags.length > 0;
  const media = Array.isArray(detail.media) ? detail.media : [];
  const sections = (Array.isArray(detail.sections) ? detail.sections : []).filter((section) => SECTION_KINDS.has(section.kind));
  const showNotes = canView && Boolean(detail.privateNotes?.file);
  const categoryPath = `/product/${category.slug}`;

  const toc = [
    ...(media.length > 0 ? [{ id: MEDIA_SECTION_ID, title: "영상" }] : []),
    ...sections.map((section) => ({ id: sectionAnchor(section.id), title: section.title })),
    ...(showNotes ? [{ id: NOTES_SECTION_ID, title: detail.privateNotes.title }] : []),
  ];

  return (
    <article className={`${productStyles.page} ${styles.detail}`}>
      <nav className={styles.breadcrumb} aria-label="이동 경로">
        <ol role="list">
          <li><Link to="/product">프리셋 라이브러리</Link></li>
          <li><Link to={categoryPath}>{category.label}</Link></li>
        </ol>
      </nav>

      <header className={`${productStyles.pageHeader} ${styles.hero}`}>
        <div className={styles.heroText}>
          <span className={productStyles.overline}>Product · {category.label}</span>
          <h1 className={productStyles.title}>{preset.name}</h1>
          <p className={`${productStyles.headerDesc} ${styles.summary}`}>{preset.summary}</p>

          <dl className={`${productStyles.meta} ${styles.heroMeta}`}>
            {preset.tool && (
              <div className={productStyles.metaRow}>
                <dt>도구</dt>
                <dd>{preset.tool}</dd>
              </div>
            )}
            {preset.source && (
              <div className={productStyles.metaRow}>
                <dt>원본</dt>
                {/* Displayed as text only; the source is never fetched or linked here. */}
                <dd><code className={productStyles.source}>{preset.source}</code></dd>
              </div>
            )}
            {preset.updatedAt && (
              <div className={productStyles.metaRow}>
                <dt>수정일</dt>
                <dd><time dateTime={preset.updatedAt}>{preset.updatedAt}</time></dd>
              </div>
            )}
          </dl>

          {hasTags && (
            <ul className={productStyles.tags} aria-label="태그">
              {preset.tags.map((tag) => (
                <li key={tag} className={productStyles.tag}>{tag}</li>
              ))}
            </ul>
          )}
        </div>

        {preset.thumbnail && (
          <img
            className={styles.heroImage}
            src={preset.thumbnail}
            alt={`${preset.name} 대표 장면`}
            decoding="async"
          />
        )}
      </header>

      {detail.lead && <p className={styles.lead}>{detail.lead}</p>}

      {Array.isArray(detail.facts) && detail.facts.length > 0 && (
        <dl className={styles.facts}>
          {detail.facts.map((fact) => (
            <div key={fact.label} className={styles.fact}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {toc.length > 1 && (
        <nav className={styles.toc} aria-label="이 페이지의 내용">
          <span className={styles.tocLabel} aria-hidden="true">이 페이지의 내용</span>
          <ol className={styles.tocList} role="list">
            {toc.map((entry) => (
              <li key={entry.id}>
                <a href={`#${entry.id}`} className={styles.tocLink}>{entry.title}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {media.length > 0 && (
        <section
          id={MEDIA_SECTION_ID}
          className={`${productStyles.section} ${styles.anchorTarget}`}
          aria-labelledby={`${MEDIA_SECTION_ID}-title`}
        >
          <div className={styles.sectionHead}>
            <h2 id={`${MEDIA_SECTION_ID}-title`} className={productStyles.sectionTitle}>영상</h2>
            {!canView && media.some((item) => item.access !== "public") && (
              <p className={styles.sectionNote}>영상은 관리자 계정으로 로그인해야 볼 수 있습니다.</p>
            )}
          </div>
          <div className={styles.mediaStack}>
            {media.map((item) => (
              <PresetMedia key={item.id} presetId={preset.id} item={item} canView={canView} signedIn={signedIn} />
            ))}
          </div>
        </section>
      )}

      {sections.map((section) => {
        const anchor = sectionAnchor(section.id);
        const headingId = `${anchor}-title`;
        return (
          <section
            key={section.id}
            id={anchor}
            className={`${productStyles.section} ${styles.anchorTarget}`}
            aria-labelledby={headingId}
          >
            <h2 id={headingId} className={productStyles.sectionTitle}>{section.title}</h2>
            <SectionBody section={section} headingId={headingId} />
          </section>
        );
      })}

      {showNotes && <PresetNotes presetId={preset.id} notes={detail.privateNotes} sectionId={NOTES_SECTION_ID} />}

      <footer className={styles.detailFooter}>
        <Link to={categoryPath} className={productStyles.textLink}>{category.label} 목록으로 돌아가기</Link>
      </footer>
    </article>
  );
}
