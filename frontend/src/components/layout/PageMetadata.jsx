import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const PAGES = {
  "/": ["사람과 AI가 함께 일하는 공간", "사람과 AI가 함께 일하는 Twinverse Platform. TwinverseDesk 가상 작업 공간, AI 운영 도구, 디자인 라이브러리와 커뮤니티를 만나보세요."],
  "/vision": ["플랫폼 비전", "Twinverse Platform의 현재 기반과 장기 비전. 가상 공간, AI 1인 기업, 브라우저 작업 환경과 크리에이터 생태계의 발전 방향을 소개합니다."],
  "/about": ["회사소개", "사람의 가능성을 넓히는 AI 생태계를 만드는 TwinverseAI. 프로젝트의 목적, 만드는 방식과 현재 개발 방향을 소개합니다."],
  "/services": ["서비스와 이용 안내", "TwinverseDesk, OpenClaw 에이전트, 이메일 보고서, 디자인 라이브러리와 커뮤니티의 기능별 이용 범위와 접속 조건을 확인하세요."],
  "/designs": ["디자인 라이브러리", "디자인 참고안을 비교하고 프로젝트별 방향을 정하세요. 반응형 화면, 접근성, 디자인 토큰과 AI 인터페이스 실무 가이드를 함께 제공합니다."],
  "/twinversedesk/analysis": ["TwinverseDesk 소개와 분석", "기존 2D TVDesk와 UE5 TwinverseDesk의 차이, 현재 구현과 스트리밍 이용 조건을 살펴보세요."],
  "/twinversedesk/plan": ["TwinverseDesk 개발계획", "TwinverseDesk의 현재 구현, 다음 목표와 단계별 검증 기준을 안내합니다."],
  "/twinversedesk/launch": ["TwinverseDesk 실행", "브라우저에서 TwinverseDesk를 시작하기 위한 로그인, 공간 선택, 서버 연결과 종료 방법을 확인하세요."],
  "/twinversedesk/run": ["TVDesk 실행", "별도로 운영되는 2D TVDesk의 접속 방법과 계정·AI 연결 조건을 확인하세요."],
};

export default function PageMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const [title, description] = PAGES[pathname] || ["Twinverse Platform", PAGES["/"][1]];
    document.title = `TwinverseAI · ${title}`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [pathname]);
  return null;
}
