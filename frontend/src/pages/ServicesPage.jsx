import { Link } from "react-router-dom";
import { CapabilityLink, IntroHero } from "../components/Introduction";
import { CAPABILITIES, CONTENT_REVIEWED_AT } from "../data/platformContent";
import styles from "../components/Introduction.module.css";

const FAQ = [
  ["어디서부터 시작하면 되나요?", "처음 방문했다면 디자인 라이브러리와 TwinverseDesk 소개를 살펴보세요. 커뮤니티에서 소식과 질문을 확인할 수 있습니다. 스트리밍 실행은 서버와 세션이 준비돼 있어야 합니다."],
  ["모든 기능을 일반 계정으로 이용할 수 있나요?", "공개 소개와 디자인 자료는 바로 볼 수 있습니다. OpenClaw 콘솔과 이메일 보고서는 현재 관리자용입니다. 일반 회원 가입만으로 해당 도구의 권한이 생기지는 않습니다."],
  ["가상 공간을 실행하려면 프로그램을 설치해야 하나요?", "Pixel Streaming은 서버의 Unreal Engine 실행 화면을 브라우저로 전달합니다. 웹 실행 화면을 이용할 때 별도 UE 클라이언트 설치는 필요하지 않지만, 서버 가동과 호환 브라우저·네트워크 연결이 필요합니다."],
  ["선택한 디자인이 사이트에 바로 적용되나요?", "디자인 페이지의 선택은 이 브라우저에 프로젝트별 참고안을 저장하는 기능입니다. 실제 제품의 색상과 레이아웃을 바꾸려면 별도 구현과 검토가 필요합니다."],
  ["페이지를 옮겨도 AI 작업을 이어갈 수 있나요?", "로그인한 상태에서 사이트 내부 메뉴로 이동하면 열린 OpenClaw 콘솔의 대화, 입력 내용과 방문한 탭 상태가 유지됩니다. 로그아웃·계정 변경·브라우저 새로고침은 별도 세션 경계이며, 네트워크 연결이 끊어지면 재연결이 필요할 수 있습니다."],
  ["50종 AI 전문가와 가상 사무실은 모두 제공되나요?", "50종 전문가 에이전트, 공간 안의 통합 협업과 플랫폼 경제는 장기 발전 방향입니다. 지금 제공하는 기능은 위의 이용 범위와 TwinverseDesk 개발계획에서 구분해 안내합니다."],
];

export default function ServicesPage() {
  return <div className={styles.page}>
    <IntroHero eyebrow="PRODUCTS & CAPABILITIES" title={<>일을 시작하고, 연결하고,<br />다음 단계로 이어가세요.</>}>
      <p>가상 작업 공간부터 AI 운영 도구까지. TwinverseAI에서 현재 이용할 수 있는 기능과 접속 조건을 한곳에 정리했습니다.</p>
      <p className={styles.note}>기능 안내 기준 <time dateTime={CONTENT_REVIEWED_AT}>{CONTENT_REVIEWED_AT}</time></p>
    </IntroHero>
    <section className={styles.section}>
      <h2>기능별 이용 안내</h2>
      <div className={styles.rows}>{CAPABILITIES.map((item) => <article id={item.id} key={item.id} className={styles.product}>
        <div><span className={styles.status}>{item.status}</span><h3>{item.name}</h3><p>{item.summary}</p></div>
        <div><p>{item.detail}</p><ul>{item.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><CapabilityLink className={styles.textLink} item={item} /></div>
      </article>)}</div>
    </section>
    <section className={styles.section}>
      <span className={styles.eyebrow}>WORK IN PRACTICE</span><h2>이런 작업에서 출발할 수 있습니다</h2>
      <ol className={styles.steps}>
        <li><h3>크리에이터의 기획</h3><p>디자인 참고안을 모으고 표현 방향을 비교합니다. 화면에 필요한 요소를 정리해 개발과 콘텐츠 작업의 기준으로 삼습니다.</p></li>
        <li><h3>운영자의 일일 검토</h3><p>관리자 계정에서 등록된 이메일 보고서의 중요 항목을 확인하고, 원문을 열어 후속 조치를 판단합니다.</p></li>
        <li><h3>팀의 공간 실험</h3><p>준비된 스트리밍 환경에서 브라우저 조작을 경험하고, 공간·장치·연결 조건별 개선점을 커뮤니티에 공유합니다.</p></li>
      </ol>
    </section>
    <section className={styles.section}>
      <h2>이용 전에 궁금한 점</h2>{FAQ.map(([question, answer]) => <details key={question} className={styles.faq}><summary>{question}</summary><p>{answer}</p></details>)}
    </section>
    <section className={styles.section}>
      <h2>다음 기능도 함께 살펴보세요</h2><p className={styles.intro}>공간 속 AI 협업, 멀티유저 경험, 크리에이터 수익화까지. 현재의 기능 위에 어떤 경험을 더할지 로드맵에서 확인할 수 있습니다.</p><div className={styles.actions}><Link className={styles.button} to="/twinversedesk/plan">TwinverseDesk 개발계획</Link><Link className={styles.textLink} to="/community/qna">이용 질문 남기기 →</Link></div>
    </section>
  </div>;
}
