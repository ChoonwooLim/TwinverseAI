import styles from "./Footer.module.css";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.row}>
          <Link to="/" className={styles.company}>TwinverseAI</Link>
          <nav className={styles.links} aria-label="사이트 안내">
            <Link to="/about">회사소개</Link><Link to="/vision">플랫폼 비전</Link>
            <Link to="/services">서비스 안내</Link><Link to="/designs">디자인 라이브러리</Link>
            <Link to="/community/qna">질문과 의견</Link>
          </nav>
        </div>
        <div className={styles.bottom}>
          <span className={styles.copy}>&copy; {new Date().getFullYear()} TwinverseAI. All rights reserved.</span>
          <span className={styles.tagline}>사람과 AI가 함께 일하는 새로운 작업 공간</span>
        </div>
      </div>
    </footer>
  );
}
