import { CONTENT_REVIEWED_AT, TECHNOLOGY_REFERENCES } from "../data/platformContent";
import styles from "./Introduction.module.css";
import { Link } from "react-router-dom";

export function CapabilityLink({ item, className }) {
  let user = null;
  try {
    if (localStorage.getItem("token")) user = JSON.parse(localStorage.getItem("user") || "null");
  } catch { /* Treat an unavailable session as signed out. */ }
  const admin = ["admin", "superadmin"].includes(user?.role);
  if (item.privateTo && user && !admin) return <span className={styles.note}>관리자 권한이 필요한 기능입니다.</span>;
  return <Link className={className} to={admin && item.privateTo ? item.privateTo : item.to}>
    {admin && item.privateAction ? item.privateAction : item.action} →
  </Link>;
}

export function IntroHero({ eyebrow, title, children }) {
  return <header className={styles.hero}>
    <span className={styles.eyebrow}>{eyebrow}</span>
    <h1>{title}</h1>
    <div className={styles.lead}>{children}</div>
  </header>;
}

export function TechnologyReferences() {
  return <section className={styles.section} aria-labelledby="technology-references">
    <span className={styles.eyebrow}>TECHNOLOGY NOTES</span>
    <h2 id="technology-references">다음 확장을 준비하는 기술</h2>
    <p className={styles.intro}>현재 제품의 기반인 Pixel Streaming과, 도구 연결·3D 자산 협업의 확장을 위해 검토할 공개 기술을 소개합니다.</p>
    <div className={styles.referenceList}>
      {TECHNOLOGY_REFERENCES.map((reference) => <article key={reference.name}>
        <div><span className={styles.status}>{reference.label}</span><h3>{reference.name}</h3></div>
        <div><p>{reference.description}</p><a href={reference.url} target="_blank" rel="noopener noreferrer">{reference.publisher} ↗</a></div>
      </article>)}
    </div>
    <p className={styles.note}>내용·출처 확인: <time dateTime={CONTENT_REVIEWED_AT}>{CONTENT_REVIEWED_AT}</time></p>
  </section>;
}
