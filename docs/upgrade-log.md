# 업그레이드 로그

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |
|------|----------|----------|----------|
| 2026-04-04 | 프로젝트 초기 구조 생성 (FastAPI + React + JWT 인증 + 어드민) | feat | backend/, frontend/ |
| 2026-04-04 | 프로덕션급 UI 디자인 적용 (6개 페이지 + CSS 디자인 시스템) | feat | frontend/src/pages/, frontend/src/styles/ |
| 2026-04-04 | 프로젝트 문서 시스템 + 스킬 뷰어 + 플러그인 관리 | feat | docs/, routers/docs.py, routers/skills.py, routers/plugins.py |
| 2026-04-04 | 멀티스테이지 Dockerfile + SPA 정적파일 서빙 | infra | Dockerfile, backend/main.py |
| 2026-04-04 | 로그인 회원가입 탭 + 자동 admin 생성 + bcrypt | feat | frontend/src/pages/LoginPage.jsx, backend/main.py |
| 2026-04-04 | 게시판 시스템 (Post, Comment, File 모델 + CRUD API) | feat | backend/models/, backend/routers/ |
| 2026-04-04 | 포탈 레이아웃 + 16종 페이지/컴포넌트 구현 | feat | frontend/src/components/, frontend/src/pages/ |
| 2026-04-04 | Dark Glass Neon 디자인 전면 적용 (twinverse.org 스타일) | style | frontend/src/styles/, 22개 CSS 모듈 |
| 2026-04-04 | TwinverseDesk 메뉴 + 3개 서브페이지 (분석 보고서, 개발계획, 실행하기) | feat | TopBar.jsx, App.jsx, frontend/src/pages/twinversedesk/ |
| 2026-04-06 | TwinverseDesk 개발계획 전면 업그레이드 (KPI, Phase 확장, UE5 기술 8개, 비교표 15항목) | feat | DeskPlan.jsx, DeskPlan.module.css |
| 2026-04-06 | 어드민 사이드바 프로젝트 문서 서브메뉴 + AdminDocs 마크다운 뷰어 (remark-gfm) | feat | Sidebar.jsx, AdminDocs.jsx, AdminDocs.module.css |
