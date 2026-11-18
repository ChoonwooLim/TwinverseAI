import { Link, useParams } from "react-router-dom";
import { findPresetCategory } from "../../data/productPresets";
import styles from "./Product.module.css";

function PresetCard({ item }) {
  const hasTags = Array.isArray(item.tags) && item.tags.length > 0;
  const hasMeta = Boolean(item.tool || item.source || item.updatedAt);

  return (
    <li className={styles.presetCard}>
      {item.thumbnail && (
        <img
          className={styles.thumb}
          src={item.thumbnail}
          alt={`${item.name} 미리보기`}
          loading="lazy"
          decoding="async"
        />
      )}
      <div className={styles.presetBody}>
        <h3 className={styles.presetName}>{item.name}</h3>
        <p className={styles.presetSummary}>{item.summary}</p>

        {hasMeta && (
          <dl className={styles.meta}>
            {item.tool && (
              <div className={styles.metaRow}>
                <dt>도구</dt>
                <dd>{item.tool}</dd>
              </div>
            )}
            {item.source && (
              <div className={styles.metaRow}>
                <dt>원본</dt>
                {/* Displayed as text only; the asset is never fetched or executed here. */}
                <dd><code className={styles.source}>{item.source}</code></dd>
              </div>
            )}
            {item.updatedAt && (
              <div className={styles.metaRow}>
                <dt>수정일</dt>
                <dd><time dateTime={item.updatedAt}>{item.updatedAt}</time></dd>
              </div>
            )}
          </dl>
        )}

        {hasTags && (
          <ul className={styles.tags} aria-label="태그">
            {item.tags.map((tag) => (
              <li key={tag} className={styles.tag}>{tag}</li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function PresetCategoryPage() {
  const { category: slug } = useParams();
  const category = findPresetCategory(slug);

  if (!category) {
    return (
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.overline}>Product · Presets</span>
          <h1 className={styles.title}>찾을 수 없는 프리셋 분류입니다.</h1>
        </header>
        <Link to="/product" className={styles.textLink}>프리셋 라이브러리로 돌아가기</Link>
      </div>
    );
  }

  const { label, desc, holds, items } = category;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>Product · Presets</span>
        <h1 className={styles.title}>{label} ({items.length})</h1>
        <p className={styles.headerDesc}>{desc}</p>
      </header>

      <section className={styles.section} aria-labelledby="preset-holds">
        <h2 id="preset-holds" className={styles.sectionTitle}>이 분류에 담는 내용</h2>
        <ul className={styles.holdsList}>
          {holds.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="preset-items">
        <h2 id="preset-items" className={styles.sectionTitle}>프리셋</h2>
        {items.length > 0 ? (
          <ul className={styles.grid}>
            {items.map((item) => (
              <PresetCard key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>아직 등록된 프리셋이 없습니다.</p>
            <p className={styles.emptyText}>프리셋이 추가되면 이곳에 카드로 표시됩니다.</p>
          </div>
        )}
      </section>
    </div>
  );
}
