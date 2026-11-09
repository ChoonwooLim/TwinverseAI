import { Link } from "react-router-dom";
import styles from "./DeskPlan.module.css";

const CAPABILITIES = [
  { feature: "브라우저 접속", current: "로그인·환경 선택·Solo 세션 시작/종료 흐름 구현", next: "기기별 연결 품질과 재접속 경험 개선" },
  { feature: "3D 콘텐츠", current: "Modern Office / New York City 선택 제공, 서버 준비 필요", next: "일과 회의를 위한 공유 오피스 콘텐츠" },
  { feature: "여러 사람의 협업", current: "공유 3D Virtual Office는 개발 중으로 비활성화", next: "독립된 입력·아바타·공유 상태와 음성 검증" },
  { feature: "AI 연결", current: "NPC 대화·에이전트 연결 API, 관리자 OpenClaw 콘솔", next: "공간 내 대화 → 업무 요청 → 결과 확인을 하나의 흐름으로 연결" },
  { feature: "이메일 업무", current: "관리자 보고서 검토와 판단 기록", next: "권한과 승인 범위가 명확한 업무 도구 확장" },
  { feature: "AI 1인 기업", current: "전문가 역할과 활용 방향 소개", next: "50종 AI 전문가 협업, 개인·팀 작업 공간으로 확장" },
];

const ARCHITECTURE = [
  { layer: "사용자가 여는 웹 포털", tech: "React 19 · Vite 8", desc: "소개와 계정, 실행할 환경, 세션 상태를 한곳에서 안내합니다. 운영 도구에는 역할에 따른 접근 제한을 적용합니다." },
  { layer: "사용자와 세션을 연결하는 API", tech: "FastAPI · PostgreSQL", desc: "로그인 사용자의 세션을 만들고 조회·유지·종료합니다. 가용 인스턴스 수와 오류를 실행 화면에 전달합니다." },
  { layer: "화면을 만드는 실행 환경", tech: "UE5 · Pixel Streaming 2", desc: "UE5 런타임, 연결을 중개하는 서버와 브라우저 플레이어가 함께 동작합니다. 영상 연결 성공과 실제 입력 응답까지 검증합니다." },
  { layer: "대화와 업무를 처리하는 AI", tech: "Ollama · OpenClaw", desc: "AI 컴퓨트와 3D 스트리밍의 역할을 분리합니다. 현재 AI 연결 코드를 바탕으로 사용자 권한, 대화 맥락과 결과 확인 경험을 확장합니다." },
];

const PHASES = [
  {
    phase: "01 · 현재 기반", title: "브라우저에서 UE5 공간에 접속", status: "현재 연동", active: true,
    tasks: ["로그인, Solo 환경 선택, 세션 생성·조회·유지·종료 흐름 구현", "서버 응답과 가용 용량 안내, 별도 플레이어 창 연결", "공개 기준: 운영 서버에서 영상·입력·종료까지 실제 접속 확인"],
  },
  {
    phase: "02 · 다음 검증", title: "안정적으로 다시 찾는 작업 공간", status: "검증·고도화",
    tasks: ["세션 시작 실패, 연결 끊김, 용량 부족 상황의 복구 경험 정리", "브라우저·네트워크별 화질, 입력 지연과 세션 유지 시간 측정", "공개 기준: 재접속·장시간 사용·자원 반환의 반복 검증"],
  },
  {
    phase: "03 · 공간 속 AI", title: "대화에서 업무 결과까지 연결", status: "통합 계획",
    tasks: ["NPC 대화와 OpenClaw 에이전트 연결을 실제 공간의 사용자 경험에 통합", "업무 요청·진행 상황·결과 확인·중단 흐름을 일관되게 구성", "공개 기준: 권한별 도구 범위와 사람의 확인이 필요한 작업을 구분"],
  },
  {
    phase: "04 · 공유 공간", title: "여러 사람이 함께 쓰는 3D 오피스", status: "개발 계획",
    tasks: ["현재 비활성화된 공유 오피스를 위한 캐릭터·입력·공유 상태 완성", "채팅, 공간 음성, 좌석과 오브젝트 상호작용 검증", "공개 기준: 동시 접속 부하와 사용자별 조작 분리, 재입장 확인"],
  },
  {
    phase: "05 · 1인 기업", title: "분야별 전문가와 함께하는 업무", status: "장기 확장",
    tasks: ["기획·개발·디자인·마케팅 등 50종 AI 전문가 협업을 목표로 확대", "개인과 팀의 작업 공간, 자료, 결과물을 연결하는 업무 흐름 설계", "공개 기준: 역할별 결과 품질·비용·사용자 통제의 검증"],
  },
  {
    phase: "06 · 플랫폼 생태계", title: "사람과 AI가 함께 만드는 Twinverse", status: "장기 비전",
    tasks: ["디지털 트윈, 교육, 콘텐츠 제작과 비즈니스 공간으로 활용 확장", "창작자·개발자 참여와 디지털 자산 유통 모델 검토", "공개 기준: 이용 정책, 운영 안정성, 지속 가능한 사업 모델 확보"],
  },
];

const QUALITY_GATES = [
  { title: "접속 품질", desc: "로그인부터 첫 영상과 입력 응답까지의 시간, 끊김과 재접속 성공률을 실제 환경에서 측정합니다. 회선 속도만으로 체감 품질을 판단하지 않습니다." },
  { title: "공간의 일관성", desc: "동시에 접속한 사용자의 위치·대화·조작이 의도대로 공유되는지 확인합니다. 영상 시청자 수와 독립적으로 활동하는 사용자 수를 구분합니다." },
  { title: "AI 작업의 완결성", desc: "무엇을 요청했고 어디까지 실행되었는지, 결과를 어디서 확인하고 어떻게 중단하는지 사용자가 이해할 수 있는 흐름을 검증합니다." },
  { title: "자원과 운영", desc: "장면별 GPU·인코더·네트워크 비용과 세션 종료 후 자원 반환을 확인한 뒤 동시 사용 범위를 정합니다. 가용성과 성능 수치는 실측에 기반해 공개합니다." },
];

export default function DeskPlan() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>TwinverseDesk · Development Roadmap</span>
        <h1 className={styles.title}>공간과 AI를 연결하는 개발계획</h1>
        <p className={styles.subtitle}>
          브라우저로 여는 UE5 공간에서 시작해, 사람과 AI 전문가가 함께 일하는 작업 환경으로 확장합니다.
          현재 구현된 연결과 앞으로 공개할 경험을 구분하고, 실제 사용 검증을 다음 단계의 기준으로 삼습니다.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>하나의 공간에서 이어지는 업무</h2>
        <div className={styles.visionBox}>
          <blockquote className={styles.vision}>
            아이디어를 나누고, AI 전문가와 실행하고,<br />
            결과를 함께 확인하는 작업 공간.<br />
            <strong>TwinverseDesk는 Twinverse Platform의 핵심 진입점</strong>을 지향합니다.
          </blockquote>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>현재 구현과 다음 목표</h2>
        <p className={styles.sectionDesc}>
          구현된 연결도 운영 서버와 자원이 준비되어야 이용할 수 있습니다.
          다음 목표는 공개 예정 범위이며, 확정 출시일이나 제공 완료를 뜻하지 않습니다.
        </p>
        <div className={styles.compareTable} role="table" aria-label="현재 구현과 다음 목표 비교">
          <div className={`${styles.compareRow} ${styles.compareHeader}`} role="row">
            <span role="columnheader">영역</span>
            <span role="columnheader">현재 구현·공개 범위</span>
            <span role="columnheader">다음 목표</span>
          </div>
          {CAPABILITIES.map((capability) => (
            <div key={capability.feature} className={styles.compareRow} role="row">
              <span className={styles.compareFeature} role="cell">{capability.feature}</span>
              <span className={styles.comparOld} role="cell">{capability.current}</span>
              <span className={styles.compareNew} role="cell">{capability.next}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>경험을 구성하는 네 가지 역할</h2>
        <div className={styles.archGrid}>
          {ARCHITECTURE.map((layer) => (
            <article key={layer.layer} className={styles.archCard}>
              <div className={styles.archHeader}>
                <h3 className={styles.archLayer}>{layer.layer}</h3>
                <span className={styles.archTech}>{layer.tech}</span>
              </div>
              <p className={styles.archDesc}>{layer.desc}</p>
            </article>
          ))}
        </div>
        <p className={styles.sectionDesc}>
          Pixel Streaming은 원격 실행 화면과 사용자 입력을 연결하는 기반 기술입니다.
          공유 오피스의 협업 규칙과 AI 업무 흐름은 그 위에서 별도로 구현·검증합니다.{" "}
          <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-pixel-streaming-in-unreal-engine" target="_blank" rel="noopener noreferrer">Epic Games 기술 개요</a>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>단계별 로드맵</h2>
        <p className={styles.sectionDesc}>
          달력상의 주차나 완료율 대신 다음 경험을 공개하기 위한 기준을 표시합니다.
          공유 공간과 공간 내 AI 업무는 검증 결과에 따라 공개 범위가 정해집니다.
        </p>
        <div className={styles.timeline}>
          {PHASES.map((phase, index) => (
            <article key={phase.phase} className={`${styles.phase} ${phase.active ? styles.phaseActive : ""}`}>
              <div className={styles.phaseMarker} aria-hidden="true">
                <div className={`${styles.phaseDot} ${phase.active ? styles.phaseDotActive : ""}`} />
                {index < PHASES.length - 1 && <div className={styles.phaseLine} />}
              </div>
              <div className={styles.phaseContent}>
                <div className={styles.phaseMeta}>
                  <span className={styles.phaseLabel}>{phase.phase}</span>
                  <span className={styles.phasePeriod}>{phase.status}</span>
                </div>
                <h3 className={styles.phaseTitle}>{phase.title}</h3>
                <ul className={styles.phaseTasks}>
                  {phase.tasks.map((task) => <li key={task}>{task}</li>)}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>공개 전 확인할 품질 기준</h2>
        <div className={styles.ueGrid}>
          {QUALITY_GATES.map((gate) => (
            <article key={gate.title} className={styles.ueCard}>
              <h3 className={styles.ueTitle}>{gate.title}</h3>
              <p className={styles.ueDesc}>{gate.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>기술 선택과 현재 체험</h2>
        <p className={styles.sectionDesc}>
          프로젝트의 UE5 5.7.4 기반 구성은 공식 배포 버전과 호환성을 확인하며 관리합니다.
          Epic은 엔진 버전에 맞는 스트리밍 서버·플레이어 버전 사용을 안내합니다.
          최신 문서의 기능이 프로젝트에 모두 적용되었다는 의미는 아닙니다.{" "}
          <a href="https://github.com/EpicGames/PixelStreamingInfrastructure" target="_blank" rel="noopener noreferrer">공식 Pixel Streaming Infrastructure</a>
        </p>
        <p className={styles.sectionDesc}>
          <Link to="/twinversedesk/launch">현재 3D 실행 환경 확인</Link>{" · "}
          <Link to="/twinversedesk/analysis">제품과 기술 분석</Link>{" · "}
          <Link to="/twinversedesk/run">TVDesk 2D 오피스</Link>
        </p>
      </section>
    </div>
  );
}
