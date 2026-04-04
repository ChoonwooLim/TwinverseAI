import styles from "./ServicesPage.module.css";

const SERVICES = [
  { title: "AI 컨설팅", desc: "비즈니스 목표에 맞는 AI 도입 전략 수립부터 실행까지 전 과정을 지원합니다.", features: ["현황 분석", "ROI 예측", "실행 로드맵"] },
  { title: "커스텀 AI 개발", desc: "고객 데이터와 요구사항에 최적화된 AI 모델 및 애플리케이션을 개발합니다.", features: ["자연어 처리", "컴퓨터 비전", "예측 분석"] },
  { title: "AI 교육", desc: "조직의 AI 역량을 강화하는 맞춤형 교육 프로그램을 운영합니다.", features: ["워크숍", "핸즈온 실습", "온라인 과정"] },
  { title: "AI 인프라 구축", desc: "확장 가능하고 안정적인 AI 인프라를 설계하고 구축합니다.", features: ["클라우드 아키텍처", "MLOps 파이프라인", "모니터링"] },
];

export default function ServicesPage() {
  return (
    <div className={styles.services}>
      <h1 className={styles.title}>서비스</h1>
      <p className={styles.intro}>TwinverseAI는 AI 전략 수립부터 개발, 교육, 인프라까지 원스톱 솔루션을 제공합니다.</p>
      <div className={styles.grid}>
        {SERVICES.map((s) => (
          <div key={s.title} className={styles.card}>
            <h2 className={styles.cardTitle}>{s.title}</h2>
            <p className={styles.cardDesc}>{s.desc}</p>
            <ul className={styles.features}>{s.features.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}
