import { Link } from "react-router-dom";
import { PRESET_CATEGORIES } from "../../data/productPresets";
import styles from "./Product.module.css";

export default function ProductOverview() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>Product</span>
        <h1 className={styles.title}>프리셋 라이브러리</h1>
        <p className={styles.headerDesc}>
          영상 제작과 웹사이트 구축에 반복해서 쓰는 프리셋을 종류별로 모아 두는 공간입니다.
        </p>
      </header>

      <ul className={styles.grid}>
        {PRESET_CATEGORIES.map((category) => (
          <li key={category.slug} className={styles.gridItem}>
            <Link to={`/product/${category.slug}`} className={styles.categoryCard}>
              <h2 className={styles.cardTitle}>{category.label}</h2>
              <p className={styles.cardDesc}>{category.desc}</p>
              <span className={styles.count}>{category.items.length}개</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
