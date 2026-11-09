import { Link } from "react-router-dom";
import { IntroHero } from "../components/Introduction";
import { CONTENT_REVIEWED_AT } from "../data/platformContent";
import styles from "../components/Introduction.module.css";

export default function AboutPage() {
  return <div className={styles.page}>
    <IntroHero eyebrow="ABOUT TWINVERSEAI" title={<>사람의 가능성을 넓히는<br />AI 생태계를 만듭니다.</>}>
      <p>TwinverseAI는 인간과 AI가 공존하는 Twinverse Platform을 만드는 프로젝트입니다. 중심에는 누구나 브라우저로 접근할 수 있는 가상 작업 공간, TwinverseDesk가 있습니다.</p>
    </IntroHero>
    <section className={styles.section}>
      <span className={styles.eyebrow}>OUR PURPOSE</span>
      <div className={styles.columns}><h2>아이디어를 가진 사람이<br />실행의 주체가 되도록.</h2><div><p>좋은 아이디어를 실행하려면 기획, 개발, 디자인, 운영처럼 여러 역할이 필요합니다. 우리는 AI를 함께 일하는 동료로 연결하고, 그 작업이 이어지는 공간을 만들어 개인과 작은 팀의 실행 범위를 넓히려 합니다.</p><p>1인 사업자와 크리에이터의 작업에서 출발해, 팀의 협업과 가상 공간의 새로운 경험까지 확장하는 것이 우리의 방향입니다.</p></div></div>
    </section>
    <section className={styles.section}>
      <span className={styles.eyebrow}>HOW WE BUILD</span><h2>사람이 방향을 정하고, AI와 함께 완성합니다</h2>
      <ol className={styles.steps}>
        <li><h3>문제에서 출발</h3><p>사용자가 끝내려는 일을 먼저 정의합니다. 도구와 모델은 그 일을 더 잘하기 위한 선택입니다.</p></li>
        <li><h3>작게 연결하고 검증</h3><p>브라우저, 가상 공간, AI 작업을 연결하고 실제 화면과 동작을 확인하며 개선합니다.</p></li>
        <li><h3>경험을 축적</h3><p>사용 중 발견한 불편과 결과를 다음 설계에 반영합니다. 새로운 기술은 제품에 주는 가치와 함께 평가합니다.</p></li>
      </ol>
    </section>
    <section className={styles.section}>
      <span className={styles.eyebrow}>WHERE WE ARE</span><h2>현재의 기반, 앞으로의 연결</h2>
      <div className={styles.columns}>
        <article><span className={styles.status}>현재 구축된 기반</span><h3>웹 포털과 운영 도구</h3><p>소개·디자인·커뮤니티를 위한 포털, TwinverseDesk 스트리밍 진입 화면, 관리자용 OpenClaw 콘솔과 이메일 보고서를 갖추고 있습니다. 각 기능의 접속 조건은 다릅니다.</p><Link className={styles.textLink} to="/services">기능별 이용 범위 확인 →</Link></article>
        <article><span className={styles.status}>개발·검증을 이어갈 방향</span><h3>가상 공간 속 AI 협업</h3><p>역할별 에이전트를 작업 공간과 연결하고, 여러 사람이 함께 활동하는 공간과 1인 기업 도구로 발전시키려 합니다. 50종 전문가 에이전트와 플랫폼 경제는 장기 목표입니다.</p><Link className={styles.textLink} to="/vision">장기 비전과 단계별 목표 →</Link></article>
      </div>
      <p className={styles.note}>소개 내용 확인: <time dateTime={CONTENT_REVIEWED_AT}>{CONTENT_REVIEWED_AT}</time></p>
    </section>
    <section className={styles.section}>
      <h2>더 좋은 작업 방식을 함께 발견하세요</h2><p className={styles.intro}>어떤 일을 하고 싶은지, 어디에서 막혔는지 알려주세요. 실제 사용 경험과 구체적인 질문은 플랫폼을 발전시키는 가장 좋은 출발점입니다.</p>
      <div className={styles.actions}><Link className={styles.button} to="/community/qna">커뮤니티에서 이야기하기</Link><Link className={styles.textLink} to="/community/notice">새로운 소식 확인 →</Link></div>
    </section>
  </div>;
}
