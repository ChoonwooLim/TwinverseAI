// Public product descriptions reviewed against the repository on this date.
export const CONTENT_REVIEWED_AT = "2026-11-09";

export const CAPABILITIES = [
  {
    id: "desk", name: "TwinverseDesk", status: "실행 환경 확인 필요",
    summary: "브라우저를 입구로, Unreal Engine 기반 가상 공간을 경험합니다.",
    detail: "실행 페이지에서 제공되는 공간을 선택하고 스트리밍 서버에 연결합니다. 서버 가동 상태와 사용 가능한 세션에 따라 접속 여부가 달라집니다.",
    features: ["브라우저 스트리밍 진입", "공간 선택과 연결 상태 안내", "키보드·마우스 기반 조작"],
    to: "/twinversedesk/launch", action: "실행 환경 확인",
  },
  {
    id: "agents", name: "OpenClaw 에이전트", status: "관리자용",
    summary: "역할별 AI와 대화하고, 에이전트의 설정과 작업 흐름을 관리합니다.",
    detail: "관리 콘솔에서 에이전트, 대화, 플러그인, 설정, 로그를 다룹니다. 사이트 안에서 페이지를 이동해도 열린 콘솔과 대화 상태를 이어갈 수 있습니다.",
    features: ["에이전트별 대화와 대화 목록", "모델·플러그인 설정", "로그와 연결 상태 확인"],
    to: "/login", action: "관리자 계정으로 로그인", privateTo: "/admin/openclaw-console", privateAction: "에이전트 콘솔 열기",
  },
  {
    id: "reports", name: "이메일 보고서", status: "관리자용",
    summary: "수집된 메일의 요약과 조치할 내용을 보고서에서 확인합니다.",
    detail: "등록된 보고서를 읽고 중요 항목과 원문을 함께 살펴봅니다. 보고서 생성·등록에는 별도의 메일 연결과 수집 구성이 필요합니다.",
    features: ["일일 검토 요약", "중요 메일과 조치 항목", "원문 메일 열기·검색"],
    to: "/login", action: "관리자 계정으로 로그인", privateTo: "/admin/email-reports", privateAction: "이메일 보고서 열기",
  },
  {
    id: "design", name: "디자인 라이브러리", status: "공개 이용",
    summary: "디자인 참고안을 비교하고 프로젝트에 어울리는 방향을 정합니다.",
    detail: "색상, 타이포그래피와 레이아웃을 살펴보고 참고안을 브라우저에 저장합니다. 접근성·반응형 화면·디자인 토큰 가이드로 구현 기준도 함께 정리할 수 있습니다.",
    features: ["스타일 검색과 분류", "프로젝트별 참고안 선택", "실무 가이드와 원문 출처"],
    to: "/designs", action: "디자인 탐색",
  },
  {
    id: "community", name: "커뮤니티", status: "공개 열람 · 작성 시 로그인",
    summary: "진행 소식과 사용 경험을 나누며 플랫폼을 함께 발전시킵니다.",
    detail: "공지사항에서 소식을 확인하고 Q&A에서 질문을 남기세요. 구체적인 사용 상황과 피드백은 다음 개선의 출발점이 됩니다.",
    features: ["공지사항", "질문과 답변", "사용 경험 공유"],
    to: "/community/qna", action: "Q&A 둘러보기",
  },
];

export const TECHNOLOGY_REFERENCES = [
  {
    name: "Pixel Streaming", label: "현재 제품의 기반 기술",
    description: "서버에서 렌더링한 Unreal Engine 화면을 브라우저로 전송하고 사용자 입력을 돌려보내는 방식입니다. 실제 품질은 서버 성능과 네트워크 환경에 영향을 받습니다.",
    publisher: "Epic Games 공식 문서",
    url: "https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-pixel-streaming-in-unreal-engine",
  },
  {
    name: "MCP", label: "도구 연결 확장의 참고 기준",
    description: "AI 애플리케이션과 외부 데이터·도구를 연결하는 공개 프로토콜입니다. 연결할 서비스별 권한과 실행 범위를 검토하는 확장 방향에 참고합니다.",
    publisher: "Model Context Protocol 공식 문서",
    url: "https://modelcontextprotocol.io/docs/getting-started/intro",
  },
  {
    name: "OpenUSD", label: "3D 자산 협업의 검토 방향",
    description: "여러 도구에서 만든 3D 자산을 장면으로 구성하고 비파괴 방식으로 편집하는 기술입니다. 가상 공간의 자산 교환과 협업을 넓히기 위한 참고 방향입니다.",
    publisher: "OpenUSD 공식 문서",
    url: "https://openusd.org/release/intro.html",
  },
];
