import { Link } from "react-router-dom";
import styles from "./DeskAnalysis.module.css";

const PRODUCTS = [
  { name: "TVDesk · 2D 가상 오피스", role: "별도 웹 서비스", detail: "DeskRPG 기반의 픽셀아트 오피스입니다. 캐릭터, 공유 채널, 태스크 보드와 AI 회의 흐름을 갖추며, AI 기능은 해당 서비스의 계정·채널·연결 설정에 따라 이용합니다." },
  { name: "TwinverseDesk · UE5 공간", role: "브라우저 스트리밍 연동", detail: "로그인 후 Solo 환경의 세션을 요청하고, 별도 플레이어 창에서 UE5 공간을 조작합니다. 실행에는 스트리밍 서버와 여유 자원이 필요하며, 공유 3D 오피스는 개발 중입니다." },
  { name: "TwinverseAI · 운영 도구", role: "관리자 전용", detail: "OpenClaw 에이전트 관리·대화와 이메일 보고서 검토 화면이 구현되어 있습니다. 일반 사용자의 공간 내 AI 비서와는 접근 권한과 제공 범위가 다릅니다." },
];

const TECH_STACK = [
  { name: "Next.js + Phaser", role: "TVDesk의 2D 기반", detail: "원본 코드의 Next.js 16 계열과 Phaser 3가 웹 화면·타일맵·픽셀 캐릭터를 구성합니다. 현재 포털의 React + Vite 앱과는 별도입니다." },
  { name: "Socket.IO + Drizzle", role: "TVDesk의 실시간 상태와 저장", detail: "2D 오피스 채널의 실시간 상호작용과 데이터 저장을 담당합니다. 원본의 기능 목록은 실제 운영 서비스의 활성 설정과 구분해 확인합니다." },
  { name: "React + Vite", role: "TwinverseAI 웹 포털", detail: "현재 저장소의 React 19·Vite 8 기반 화면에서 소개, 로그인, 환경 선택, 세션 상태와 관리자 도구를 제공합니다." },
  { name: "FastAPI + PostgreSQL", role: "인증과 세션 관리", detail: "사용자별 세션 생성·조회·종료, 가용 용량 확인, 권한 검사와 운영 데이터 관리를 연결합니다." },
  { name: "UE5 + Pixel Streaming 2", role: "3D 실행과 브라우저 연결", detail: "서버에서 실행한 UE5 화면을 브라우저로 전달합니다. 프로젝트의 UE5 5.7.4 기반 구성과 공식 최신 문서의 버전은 별도로 관리합니다." },
  { name: "Ollama + OpenClaw", role: "AI 연동 기반", detail: "NPC 대화 API와 에이전트 연결 코드, 관리자 콘솔이 마련되어 있습니다. 공개 3D 공간에서의 통합 경험은 후속 검증과 공개가 필요합니다." },
];

const FEATURES = [
  {
    category: "TVDesk 원본에서 확인한 흐름",
    items: ["픽셀 캐릭터 꾸미기와 공유 오피스 채널 탐색", "OpenClaw 연결을 통한 NPC 대화·업무 위임", "태스크 보드에서 진행 상황과 보고 확인", "AI 회의와 회의록, 브라우저 맵 에디터", "서비스 운영 및 AI 연결 설정에 따라 실제 이용 범위 결정"],
  },
  {
    category: "현재 TwinverseDesk 실행 화면",
    items: ["로그인 사용자별 UE5 세션 요청과 상태 조회", "Modern Office / New York City Solo 환경 선택", "플레이어를 별도 창 또는 새 탭으로 열기", "세션 유지 신호와 세션 종료 버튼", "공유 3D Virtual Office는 개발 중으로 선택 비활성화"],
  },
  {
    category: "관리자가 사용하는 AI 도구",
    items: ["OpenClaw 에이전트·모델·대화 관리", "대화 기록과 응답 스트리밍을 갖춘 관리자 콘솔", "이메일 요약 보고서와 검토 결과 기록", "이메일 검토 선택은 기록이며 이 서비스에서 메일함을 직접 변경하지 않음", "일반 회원에게 동일한 관리자 기능이 자동 제공되지는 않음"],
  },
  {
    category: "다음 단계의 공간 경험",
    items: ["공유 오피스에서 여러 사람의 위치·입력 동기화 검증", "공간 내 AI 대화와 업무 결과를 연결하는 사용자 흐름", "음성·아바타·상호작용 콘텐츠의 실제 기기 검증", "AI 전문가 협업을 통한 1인 기업 업무 지원", "50종 전문가와 플랫폼 경제는 장기 비전"],
  },
];

const SCENARIOS = [
  { title: "가상 업무 공간을 먼저 살펴보고 싶다면", desc: "TVDesk에서 2D 오피스의 채널과 태스크 흐름을 확인하세요. AI NPC를 사용하려면 해당 채널의 AI 연결이 준비되어 있어야 합니다." },
  { title: "3D 공간의 분위기와 조작감을 확인하려면", desc: "TwinverseDesk 실행에서 Solo 환경을 선택하세요. 서버가 준비되면 브라우저 플레이어로 접속해 공간을 살펴볼 수 있습니다." },
  { title: "AI 업무 운영 방식을 검토하려면", desc: "공개 소개에서 AI 전문가의 역할과 개발 방향을 살펴보세요. OpenClaw 콘솔과 이메일 보고서는 관리자 권한이 있는 운영 도구입니다." },
];

const LIMITATIONS = [
  { title: "세션 생성과 영상 연결은 별도 단계", desc: "세션 요청이 성공해도 플레이어와 UE5 런타임 간 연결이 완료되어야 화면을 볼 수 있습니다. 서버 용량·네트워크·실행 콘텐츠가 함께 준비되어야 합니다." },
  { title: "화질과 반응 속도는 이용 환경에 따라 변화", desc: "해상도·프레임·입력 지연은 장면, 서버 GPU, 브라우저의 영상 처리와 네트워크 상태에 영향을 받습니다. 고정된 4K·120fps 서비스 수준을 보장하지 않습니다." },
  { title: "스트리밍과 멀티플레이는 다른 기능", desc: "여러 브라우저에 영상을 전달하는 것만으로 독립 아바타·공유 상태·동시 작업이 완성되지는 않습니다. 공유 오피스는 별도의 검증 단계가 필요합니다." },
  { title: "AI 연결 코드와 공개 서비스의 차이", desc: "NPC API와 관리자 콘솔은 통합의 기반입니다. 공간 내 업무 위임, 결과 확인과 50종 전문가의 협업은 실제 사용자 흐름을 완성하며 확장할 영역입니다." },
];

export default function DeskAnalysis() {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <span className={styles.overline}>TwinverseDesk · Product & Technology</span>
        <h1 className={styles.title}>가상 오피스에서 AI 작업 공간으로</h1>
        <p className={styles.subtitle}>
          TVDesk의 2D 업무 경험과 TwinverseDesk의 UE5 공간을 잇는 개발 방향을 소개합니다.
          현재 연결된 기능, 이용 조건, 앞으로 확장할 경험을 함께 확인하세요.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>세 가지 화면, 각자의 역할</h2>
        <div className={styles.techGrid}>
          {PRODUCTS.map((product) => (
            <article key={product.name} className={styles.techCard}>
              <h3 className={styles.techName}>{product.name}</h3>
              <span className={styles.techRole}>{product.role}</span>
              <p className={styles.techDetail}>{product.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>목적에 맞게 시작하기</h2>
        <div className={styles.techGrid}>
          {SCENARIOS.map((scenario) => (
            <article key={scenario.title} className={styles.techCard}>
              <h3 className={styles.techName}>{scenario.title}</h3>
              <p className={styles.techDetail}>{scenario.desc}</p>
            </article>
          ))}
        </div>
        <p className={styles.sectionDesc}>
          <Link to="/twinversedesk/run">TVDesk 2D 오피스 열기</Link>{" · "}
          <Link to="/twinversedesk/launch">TwinverseDesk 3D 실행</Link>
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>기능과 공개 범위</h2>
        <div className={styles.featureGrid}>
          {FEATURES.map((feature) => (
            <article key={feature.category} className={styles.featureCard}>
              <h3 className={styles.featureCategory}>{feature.category}</h3>
              <ul className={styles.featureList}>
                {feature.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>경험을 연결하는 기술</h2>
        <p className={styles.sectionDesc}>
          Pixel Streaming은 서버에서 렌더링한 영상과 오디오를 브라우저로 보내고,
          사용자의 입력을 UE5에 돌려보내는 방식입니다. 브라우저에 UE5를 설치하지 않아도
          공간을 체험할 수 있습니다.{" "}
          <a href="https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-pixel-streaming-in-unreal-engine" target="_blank" rel="noopener noreferrer">Epic Games 기술 개요</a>
        </p>
        <div className={styles.techGrid}>
          {TECH_STACK.map((tech) => (
            <article key={tech.name} className={styles.techCard}>
              <h3 className={styles.techName}>{tech.name}</h3>
              <span className={styles.techRole}>{tech.role}</span>
              <p className={styles.techDetail}>{tech.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>체험 전 알아둘 점</h2>
        <div className={styles.limitGrid}>
          {LIMITATIONS.map((limitation) => (
            <article key={limitation.title} className={styles.limitCard}>
              <h3 className={styles.limitTitle}>{limitation.title}</h3>
              <p className={styles.limitDesc}>{limitation.desc}</p>
            </article>
          ))}
        </div>
        <p className={styles.sectionDesc}>
          브라우저·인코더 조건과 네트워크 구성에 대한 기술 기준은 Epic Games의{" "}
          <a href="https://dev.epicgames.com/documentation/unreal-engine/unreal-engine-pixel-streaming-reference" target="_blank" rel="noopener noreferrer">Pixel Streaming Reference</a>와{" "}
          <a href="https://dev.epicgames.com/documentation/unreal-engine/hosting-and-networking-guide-for-pixel-streaming-in-unreal-engine" target="_blank" rel="noopener noreferrer">Hosting and Networking Guide</a>를 참고합니다.
        </p>
      </section>

      <section className={`${styles.section} ${styles.conclusion}`}>
        <h2 className={styles.sectionTitle}>TwinverseDesk가 지향하는 것</h2>
        <div className={styles.conclusionContent}>
          <p>
            <strong>공간을 둘러보는 경험에서 AI와 함께 일을 끝내는 경험으로 확장합니다.</strong>{" "}
            2D 오피스의 대화·업무·보고 흐름을 바탕으로, UE5 공간에서 사람과 AI가 협업하는
            Twinverse Platform의 진입점을 만드는 것이 목표입니다.
          </p>
          <p>
            현재 공개 실행 범위는 Solo 세션 연동이며, 공유 오피스와 공간 내 AI 업무는
            단계별로 검증합니다. <Link to="/twinversedesk/plan">개발계획과 공개 기준 보기 →</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
