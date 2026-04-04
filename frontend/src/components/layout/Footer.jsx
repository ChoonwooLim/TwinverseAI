import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.company}>TwinverseAI</span>
        <nav className={styles.links}>
          <a href="/about">회사정보</a>
          <span className={styles.sep}>|</span>
          <a href="#">이용약관</a>
          <span className={styles.sep}>|</span>
          <a href="#">개인정보처리방침</a>
        </nav>
        <span className={styles.copy}>&copy; 2026 TwinverseAI. All rights reserved.</span>
      </div>
    </footer>
  );
}
