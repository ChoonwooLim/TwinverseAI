import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import styles from "./HomePage.module.css";
import { CAPABILITIES, CONTENT_REVIEWED_AT } from "../data/platformContent";
import intro from "../components/Introduction.module.css";
import { CapabilityLink } from "../components/Introduction";

export default function HomePage() {
  const [notices, setNotices] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    let active = true;
    api.get("/api/boards/notice?size=3").then((r) => { if (active) setNotices(Array.isArray(r.data.items) ? r.data.items : []); }).catch(() => {});
    api.get("/api/boards/qna?size=5").then((r) => { if (active) setRecentPosts(Array.isArray(r.data.items) ? r.data.items : []); }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <span className={styles.heroOverline}>TWINVERSE PLATFORM · HUMAN × AI</span>
        <h1 className={styles.heroTitle}>당신의 아이디어에<br />AI 동료와<br />새로운 작업 공간을.</h1>
        <p className={styles.heroSub}>TwinverseAI는 사람과 AI가 함께 일하는 플랫폼을 만듭니다. 브라우저로 여는 TwinverseDesk, 역할별 에이전트, 디자인과 커뮤니티를 연결해 혼자 시작한 일이 더 크게 자랄 수 있도록.</p>
        <div className={styles.heroCta}>
          <Link to="/services" className={styles.primaryBtn}>지금 가능한 일 살펴보기</Link>
          <Link to="/vision" className={styles.secondaryBtn}>플랫폼 비전 보기</Link>
        </div>
        <p className={intro.note}>개발·운영 현황 기준 <time dateTime={CONTENT_REVIEWED_AT}>{CONTENT_REVIEWED_AT}</time> · 기능별 이용 범위는 서비스 페이지에서 확인할 수 있습니다.</p>
      </section>

      <section className={intro.section}>
        <span className={intro.eyebrow}>YOUR WORK, CONNECTED</span>
        <div className={intro.columns}>
          <div><h2>대화에서 실행으로,<br />도구에서 작업 공간으로.</h2><p className={intro.intro}>기획안을 다듬고, 디자인 방향을 찾고, 반복 업무를 검토하는 과정. Twinverse는 이 흐름을 하나의 작업 경험으로 연결하는 데 집중합니다.</p><Link className={intro.textLink} to="/about">TwinverseAI가 만드는 변화 →</Link></div>
          <article className={intro.feature}><span className={intro.status}>핵심 제품 · 스트리밍 환경 필요</span><h3>TwinverseDesk</h3><p>GPU 서버가 그리는 가상 공간을 브라우저에서 만나세요. 실행 화면에서 공간과 연결 상태를 확인하고, 웹 기반 작업 공간의 다음 모습을 살펴볼 수 있습니다.</p><Link className={intro.textLink} to="/twinversedesk/launch">TwinverseDesk 실행 안내 →</Link></article>
        </div>
      </section>
      <section className={intro.section}>
        <span className={intro.eyebrow}>EXPLORE THE PLATFORM</span><h2>지금 만날 수 있는 Twinverse</h2>
        <p className={intro.intro}>공개 콘텐츠부터 운영자를 위한 AI 도구까지, 필요한 곳에서 시작하세요.</p>
        <div className={intro.rows}>{CAPABILITIES.filter((item) => item.id !== "desk").map((item) => <article key={item.id} className={intro.product}>
          <div><span className={intro.status}>{item.status}</span><h3>{item.name}</h3></div>
          <div><p>{item.summary}</p><CapabilityLink className={intro.textLink} item={item} /></div>
        </article>)}</div>
      </section>
      <section className={intro.section}>
        <span className={intro.eyebrow}>A PLACE TO START</span><h2>작은 아이디어를 구체적인 다음 단계로</h2>
        <ol className={intro.steps}>
          <li><h3>방향을 찾고</h3><p>디자인 라이브러리에서 참고안을 비교해 브랜드와 화면의 방향을 정합니다.</p></li>
          <li><h3>환경을 경험하고</h3><p>TwinverseDesk 실행 안내와 개발계획을 통해 현재 경험과 다음 단계를 확인합니다.</p></li>
          <li><h3>경험을 나누세요</h3><p>커뮤니티에 필요한 기능과 사용 경험을 남겨 다음 개선에 참여합니다.</p></li>
        </ol>
      </section>

      {notices.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>공지사항</h2>
            <Link to="/community/notice" className={styles.moreLink}>더보기</Link>
          </div>
          <ul className={styles.noticeList}>
            {notices.map((n) => (
              <li key={n.id}>
                <Link to={`/community/notice/${n.id}`} className={styles.noticeItem}>
                  <span className={styles.noticeTitle}>{n.title}</span>
                  <span className={styles.noticeDate}>{new Date(n.created_at).toLocaleDateString("ko-KR")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentPosts.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>최신 Q&A</h2>
            <Link to="/community/qna" className={styles.moreLink}>더보기</Link>
          </div>
          <ul className={styles.postList}>
            {recentPosts.map((p) => (
              <li key={p.id}>
                <Link to={`/community/qna/${p.id}`} className={styles.postItem}>
                  <span>{p.title}</span>
                  <span className={styles.postMeta}>{p.author} | {new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={intro.section}><h2>함께 만드는 다음 작업 방식</h2><p className={intro.intro}>AI 1인 기업, 협업하는 가상 사무실, 크리에이터 경제까지. 현재의 작은 경험을 연결하며 더 큰 생태계를 준비합니다.</p><div className={intro.actions}><Link className={intro.button} to="/vision">비전과 로드맵</Link><Link className={intro.textLink} to="/community/qna">질문·의견 남기기 →</Link></div></section>
    </div>
  );
}
