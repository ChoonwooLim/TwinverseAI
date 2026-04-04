import styles from "./AboutPage.module.css";

export default function AboutPage() {
  return (
    <div className={styles.about}>
      <h1 className={styles.title}>회사소개</h1>
      <section className={styles.section}>
        <h2>비전</h2>
        <p>TwinverseAI는 인공지능 기술을 통해 기업과 개인의 디지털 전환을 가속화하는 것을 목표로 합니다. 모든 사람이 AI의 혜택을 누릴 수 있는 세상을 만들어갑니다.</p>
      </section>
      <section className={styles.section}>
        <h2>미션</h2>
        <p>복잡한 AI 기술을 누구나 쉽게 활용할 수 있도록 직관적인 솔루션을 제공합니다. 고객의 비즈니스 문제를 AI로 해결하여 실질적인 가치를 창출합니다.</p>
      </section>
      <section className={styles.section}>
        <h2>팀</h2>
        <p>AI 연구, 소프트웨어 엔지니어링, 비즈니스 전략 분야의 전문가들로 구성된 팀이 최고의 솔루션을 제공합니다.</p>
      </section>
      <section className={styles.section}>
        <h2>연혁</h2>
        <ul className={styles.timeline}>
          <li><strong>2026</strong> — TwinverseAI 설립</li>
          <li><strong>2026</strong> — AI 컨설팅 서비스 런칭</li>
        </ul>
      </section>
    </div>
  );
}
