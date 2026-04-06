# 작업일지

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

## 2026-04-04

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 프로젝트 초기 구조 생성 | 완료 |
| feat | 프로덕션급 UI 디자인 적용 (frontend-design) | 완료 |
| infra | GitHub 리포지토리 생성 + gh CLI 설정 | 완료 |
| infra | Git 기본 브랜치 main으로 변경 | 완료 |
| docs | CLAUDE.md Git 규칙 추가 | 완료 |
| infra | Dockerfile 추가 + 프론트엔드 정적파일 서빙 | 완료 |
| infra | Dockerfile 필수 규칙 CLAUDE.md + /init 스킬에 반영 | 완료 |

### 세부 내용

- 프로젝트 초기 세팅 완료 (FastAPI + React + Vite)
- 인증 시스템 (JWT) 구현
- 어드민 대시보드 기본 구조 생성
- 프로젝트 문서 시스템 구성
- 스킬 뷰어 + 플러그인 관리 페이지 생성
- /frontend-design 스킬로 프로덕션급 UI 디자인 적용 (6개 페이지 + CSS 디자인 시스템)
- GitHub 리포지토리 생성 및 푸시 (ChoonwooLim/TwinverseAI, public)
- gh CLI 설치 및 인증 설정
- Git 기본 브랜치 master → main 변경 (Orbitron 배포 호환)
- CLAUDE.md에 Git 규칙 추가 (기본 브랜치 main 필수)
- /init 스킬에 `git init -b main` 반영
- 멀티스테이지 Dockerfile 추가 (Orbitron 자동 생성 Dockerfile 파싱 오류 해결)
- backend/main.py에 SPA 정적파일 서빙 코드 추가
- CLAUDE.md + /init 스킬에 Dockerfile 필수 생성 규칙 반영

---

### 작업 요약 (세션 2)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 로그인 회원가입 탭 + 자동 admin 생성 + bcrypt | 완료 |
| feat | 게시판 시스템 (Post, Comment, FileRecord 모델 + CRUD API) | 완료 |
| feat | 레이아웃 컴포넌트 (TopBar, Sidebar, Footer, MainLayout) | 완료 |
| feat | 게시판 컴포넌트 (PostList, PostDetail, PostForm, CommentSection, FileUpload) | 완료 |
| feat | 공개 페이지 (HomePage, AboutPage, ServicesPage) | 완료 |
| feat | 커뮤니티 페이지 (BoardPage, PostPage) | 완료 |
| feat | 어드민 페이지 (Dashboard, Users, Boards, Docs, Skills, Plugins) | 완료 |
| feat | App.jsx 포탈 레이아웃 + 라우팅 전면 재구성 | 완료 |
| fix | 로그인 후 다시 로그인 화면 표시되는 버그 수정 | 완료 |
| fix | JWT sub 클레임 문자열 변환 (python-jose 호환) | 완료 |
| style | Architectural Futurism 디자인 적용 (board, pages, design system) | 완료 |
| style | Dark Glass Neon 디자인으로 전면 변경 (twinverse.org 스타일 매칭) | 완료 |
| docs | /init 스킬 전면 업데이트 (현재 포탈 전체 코드 반영) | 완료 |

### 세부 내용 (세션 2)

- 로그인 페이지에 회원가입 탭 추가, bcrypt 직접 사용
- 앱 시작 시 자동 admin 계정 생성 (admin/admin1234)
- Post, Comment, FileRecord 모델 + boards, comments, files 라우터 구현
- 어드민 라우터 확장 (통계, 사용자 관리, 게시판 관리)
- TopBar (glassmorphism), Sidebar, Footer, MainLayout 레이아웃 구현
- 게시판 컴포넌트 5종 + 커뮤니티 페이지 2종 + 공개 페이지 3종 + 어드민 페이지 6종 구현
- JWT sub 클레임을 문자열로 변환하여 python-jose 호환 버그 수정
- 로그인 후 redirect loop 버그 수정 (401 인터셉터 로직 개선)
- **디자인 전면 변경**: Architectural Futurism → Dark Glass Neon (twinverse.org 스타일)
  - 22개 CSS 파일 전면 재작성
  - 폰트: Syne + Plus Jakarta Sans → Noto Sans KR + Inter
  - 컬러: 크림/울트라마린 → 다크 배경(#0a0e27) + 네온 액센트(#667eea, #00d4ff)
  - 글래스모피즘: backdrop-filter blur, rgba 반투명 표면
  - 카드: 15px border-radius, glow shadow hover
  - 그라디언트 버튼: #667eea → #764ba2

---

### 작업 요약 (세션 3)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | TwinverseDesk 메뉴 + 3개 서브페이지 구현 | 완료 |

### 세부 내용 (세션 3)

- TopBar에 TwinverseDesk 드롭다운 메뉴 추가 (3개 서브메뉴)
- DeskRPG 분석 보고서 페이지 작성 (기술 스택, 규모, 핵심 기능, DB 구조, 한계점 분석)
- TwinverseDesk 개발계획 페이지 작성 (비전, DeskRPG 비교표, 시스템 아키텍처, UE5 핵심 기술, 5단계 로드맵)
- TwinverseDesk 실행하기 페이지 작성 (히어로, 기능 프리뷰, 시스템 요구사항, 개발 진행 현황)
- 3개 페이지 모두 Dark Glass Neon 디자인 시스템 적용
- App.jsx에 TwinverseDesk 라우트 추가

---

## 2026-04-05

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | TVDesk Socket.IO 실시간 연결 실패 — 쿠키 Secure 플래그 문제 해결 | 완료 |
| fix | TVDesk 리눅스 브라우저 소켓 인증 실패 — 프록시 토큰 자동 주입 | 완료 |
| infra | TVDesk 서버 프록시 업그레이드 (twinverse_token → DeskRPG token 변환) | 완료 |
| infra | TVDesk start.sh 영구 설정 (COOKIE_SECURE=false, JWT_SECRET 등) | 완료 |

### 세부 내용

- TVDesk NPC 호출/대화 기능 "연결끊김" 디버깅 및 해결
  - 원인 1: DeskRPG 쿠키에 `Secure` 플래그 → Cloudflare Tunnel 내부 HTTP에서 브라우저가 쿠키 저장 거부
  - 해결: `COOKIE_SECURE=false` 환경변수로 Secure 플래그 제거
- 리눅스 브라우저 소켓 인증 실패 디버깅 및 해결
  - 원인 2: 리눅스 브라우저에 DeskRPG `token` 쿠키가 설정되지 않고 `twinverse_token`만 존재
  - 해결: 프록시(proxy.js)에서 `twinverse_token`을 감지하여 DeskRPG 호환 JWT를 자동 생성/주입
- 프록시(~/.deskrpg/proxy.js) 업그레이드 — jose 라이브러리로 JWT 재서명, 유저 매핑 테이블 내장
- start.sh 영구 설정 파일 생성 (COOKIE_SECURE, JWT_SECRET, INTERNAL_HOSTNAME 포함)
- 멀티유저 동작 확인 (Windows + Linux 동시 접속, 캐릭터 표시, 채널 채팅 동작)

---

## 2026-04-06

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | TwinverseDesk 개발계획 전면 업그레이드 (KPI, Phase 확장, UE5 기술 추가) | 완료 |
| style | TVDesk 실행하기 → TwinverseDesk 실행하기 메뉴명 변경 | 완료 |
| fix | Cloudflare Tunnel 충돌 해결 (중복 프로세스 정리) | 완료 |

### 세부 내용

- TwinverseDesk 개발계획 페이지 전면 업그레이드
  - KPI 성능 목표 섹션 신규 추가 (동시접속 200+, 60 FPS, 지연 <50ms 등 6개 지표)
  - Phase 1 상태를 "진행 중"으로 변경 (펄스 애니메이션 추가)
  - 5개 Phase 내용 대폭 확장 (OAuth SSO, AI 코드 리뷰어 NPC, 마켓플레이스 등)
  - 비교표 15개 항목 (기존 12개 → 인증/업무관리/지식베이스 추가)
  - 아키텍처 7개 레이어 (기존 6개 → 인프라 레이어 추가)
  - UE5 핵심 기술 8개 (기존 6개 → Mass Entity ECS, Niagara VFX 추가)
- 메뉴명 "TVDesk 개발계획" → "TwinverseDesk 개발계획", "TVDesk 실행하기" → "TwinverseDesk 실행하기" 변경
- TVDesk 외부 접속 불가 — Cloudflare Tunnel 중복 프로세스 정리로 해결

---
