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

### 작업 요약 (세션 2)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 어드민 사이드바 프로젝트 문서 서브메뉴 구현 | 완료 |
| feat | AdminDocs 마크다운 뷰어 리팩토링 (remark-gfm, DOC_TITLES) | 완료 |
| docs | /init 스킬 업데이트 (Sidebar groups 패턴, AdminDocs 템플릿, remark-gfm 의존성) | 완료 |

### 세부 내용 (세션 2)

- Sidebar.jsx에 `groups` 패턴 추가 — admin 섹션에 "프로젝트 문서" 서브메뉴 그룹 (개발계획, 버그수정 로그, 업그레이드 로그, 작업일지)
- AdminDocs.jsx 전면 리팩토링 — 리스트 뷰 제거, 사이드바 기반 docKey 라우팅, ReactMarkdown + remark-gfm으로 GFM 테이블 렌더링
- AdminDocs.module.css에 마크다운 prose 스타일 추가 (table, blockquote, hr, code, pre 등)
- remark-gfm 패키지 의존성 추가 (package.json)
- /init 스킬(SKILL.md)에 Sidebar groups 패턴, AdminDocs 컴포넌트 템플릿, remark-gfm 의존성 반영

### 작업 요약 (세션 3)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | AI 스킬/플러그인 페이지에 실제 상세 내용 추가 (25개 스킬, 14개 플러그인) | 완료 |
| feat | 프로젝트 문서를 PostgreSQL 기반으로 전환 (filesystem → DB) | 완료 |
| feat | /init 스킬 전면 업그레이드 — 현재 사이트와 동일한 프로젝트 자동 생성 | 완료 |
| feat | 스킬/플러그인 목록 JSON 분리 + /end 자동 동기화 로직 추가 | 완료 |
| feat | 게시판별 샘플 게시글 5개씩 자동 생성 (총 20개) | 완료 |
| feat | /code-review 스킬 신규 생성 (5차원 점검, 등급별 리포트) | 완료 |
| fix | Docker 환경 docs/ 경로 불일치 수정 (404 해결) | 완료 |
| fix | docs 경로 자동 탐색 (환경변수 → Docker → 로컬 순서) | 완료 |
| style | 프로젝트 문서/Claude Code 메인메뉴 + 서브메뉴 구조 변경 | 완료 |
| refactor | Cascade Delete 적용 + Response Model 추가 (코드 리뷰 반영) | 완료 |
| refactor | 프론트엔드 성능 최적화 (코드 스플리팅, 폰트 최적화, Vite 청크 분리) | 완료 |

### 세부 내용 (세션 3)

- AI 스킬 페이지: 25개 스킬을 3카테고리(프로젝트 관리, 디자인&UX, 코드 품질)로 정리, 클릭 시 주요기능/사용법 펼침
- AI 플러그인 페이지: 14개 플러그인을 2카테고리(공식 플러그인, MCP 서버)로 정리, 카드 UI
- 프로젝트 문서 PostgreSQL 전환: Document 모델 추가, _seed_docs() 시작 시 docs/ → DB 동기화
- Docker docs 404 수정: Path 해석 문제 → DOCS_DIR 환경변수 + 자동 탐색 로직
- 사이드바 children 패턴: groups → children 방식으로 리팩토링 (프로젝트 문서, Claude Code 서브메뉴)
- /init 스킬: {{PROJECT_NAME}} 변수, Document 모델, DB 기반 docs, children 사이드바 패턴 반영
- /end 스킬: 2.5단계 스킬/플러그인 자동 동기화 로직 추가
- 샘플 게시글: _seed_sample_posts()로 공지/QnA/갤러리/비디오 각 5개 (AI/메타버스 테마)
- Cascade Delete: Post 모델에 Relationship cascade 설정, boards.py에서 N+1 삭제 루프 제거
- 성능 최적화: React.lazy() 16개 페이지 코드 스플리팅, 중복 폰트 import 제거, 폰트 웨이트 10→7개 축소, Suspense를 MainLayout 내부 Outlet으로 이동, Vite manualChunks(vendor/markdown 분리)
- /code-review 스킬: 보안/성능/코드품질/베스트프랙티스/유지보수성 5차원 점검, P0-P3 등급 리포트

### 작업 요약 (세션 4)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 이미지 갤러리 전면 업그레이드 (썸네일 카드, 라이트박스 뷰어, 샘플 이미지 생성) | 완료 |

### 세부 내용 (세션 4)

- Pillow로 5개 샘플 갤러리 이미지 생성 (Dark Glass Neon 테마 - 포탈, 대시보드, 개발계획, 디자인시스템, 스킬목록)
- 백엔드 갤러리 목록 API에 thumbnail 필드 추가 (첫 번째 이미지 경로, FileRecord JOIN)
- _seed_gallery_images() 함수로 갤러리 게시글에 이미지 FileRecord 자동 연결
- PostList 갤러리 그리드 업그레이드: 썸네일 이미지 카드 + 호버 줌 효과 + SVG placeholder
- PostDetail 갤러리 뷰어: 이미지 그리드 + 클릭 시 라이트박스 (이전/다음 네비게이션, 파일명 캡션, 키보드 접근성)
- 이미지와 일반 첨부파일 분리 표시

### 작업 요약 (세션 5)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | 갤러리 이미지 배포 404 — Docker VOLUME이 uploads 덮어씀 | 완료 |
| fix | 갤러리 이미지 로컬 깨짐 — Vite 프록시 미설정 | 완료 |
| fix | UPLOAD_DIR 빈 문자열 → Path("") = CWD(.) 해석 문제 | 완료 |
| fix | StaticFiles mount → Docker VOLUME 충돌 | 완료 |
| fix | 갤러리 샘플 이미지 Git 미추적 → Docker 빌드 실패 (502) | 완료 |
| infra | Orbitron.yaml 환경변수/헬스체크/배포 체크리스트 업그레이드 | 완료 |
| infra | .dockerignore .env 차단 + Dockerfile ENV 기본값 추가 | 완료 |
| docs | /init 스킬 전면 업그레이드 — 이미지/업로드 배포 버그 재발 방지 (12개 섹션) | 완료 |

### 세부 내용 (세션 5)

- 배포 사이트 갤러리 이미지 404 근본 원인 추적 및 해결 (5단계 디버깅):
  1. Docker VOLUME `/app/uploads`가 Orbitron 빈 볼륨으로 마운트 → COPY한 이미지 덮어씀
  2. `.gitignore`에 `uploads/` → Git에 이미지 없음 → Docker 빌드 실패 (502)
  3. `UPLOAD_DIR=""` (Orbitron override) → `Path("")` = CWD(.) → 소스 폴더를 uploads로 착각
  4. `StaticFiles` mount → Docker VOLUME과 충돌하여 파일 미검색
  5. Vite 프록시 미설정 → `<img src="/uploads/...">` 요청이 SPA HTML 반환
- 해결책: 갤러리 이미지를 `backend/gallery_defaults/`에 포함, 시작 시 uploads로 복사
- `/uploads` 서빙을 StaticFiles mount → 명시적 `@app.get("/uploads/{filename}")` 라우트로 변경
- `/health` 엔드포인트에 `uploads_dir`, `uploads_files` 디버그 정보 추가
- `vite.config.js`에 `/api`, `/uploads`, `/health` 프록시 추가
- `api.js` baseURL을 `""` (same-origin)으로 통일
- `/init` 스킬에 위 모든 수정사항 반영 (12개 섹션, 버그픽스 5~9번 추가)

---

## 2026-04-08

### 작업 요약 (세션 8)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Claude Code 최근정보 메뉴 + AdminNews 페이지 추가 | 완료 |
| feat | /ultraplan 스킬 신규 생성 (멀티 에이전트 심층 계획 수립) | 완료 |
| feat | 프로젝트 비전 페이지 추가 — 시네마틱 디자인, 상단 메뉴 연동 | 완료 |
| docs | 프로젝트 비전 문서 작성 (docs/vision.md + CLAUDE.md 방침) | 완료 |

### 세부 내용 (세션 8)

- **최근정보 시스템**: AdminNews 페이지 + ClaudeNews DB 모델 + /api/news API
  - 5개 초기 뉴스 시드 (Ultra Plan, Pixel Streaming 2, Opus 4.6, NVIDIA Toolkit, MCP)
  - 아코디언 UI + 카테고리 배지 (컬러 코딩) + ReactMarkdown 렌더링
  - 사이드바 Claude Code 하위 "최근정보" 메뉴 추가
- **/ultraplan 스킬**: 4-Phase 프로세스 (Explore → Plan → Review → Execute)
  - 3개 모드 (Simple/Standard/Deep), 병렬 Explore 에이전트 최대 3개
  - 리스크 평가 (P0-P3), 롤백 계획, 검증 체크리스트
  - skills.json에 등록
- **비전 페이지** (`/vision`): 시네마틱 몰입형 디자인
  - 100vh 히어로 + Canvas 별빛 파티클 애니메이션 + 그라디언트 시머 타이틀
  - 4대 축 (포토리얼 가상공간, AI 1인기업, Pixel Streaming, 디지털 경제)
  - TwinverseDesk 3D perspective 목업 쇼케이스
  - Phase 1~6 타임라인 로드맵 (2026→2034)
  - 기술 스택 섹션 + CTA
  - IntersectionObserver 기반 스크롤 reveal 애니메이션
  - TopBar에 "비전" 메뉴 추가
- **비전 문서**: docs/vision.md (5대 원칙, 아키텍처, 로드맵, AI 행동지침)
  - CLAUDE.md에 비전 방침 섹션 추가 (모든 AI 세션 자동 적용)
  - dev-plan.md에 마일스톤 4~6 + 비전/울트라플랜/최근정보 기능 추가

### 작업 요약 (세션 9)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | /ultraplan Deep Mode — Twinverse Platform 전체 청사진 수립 | 완료 |

### 세부 내용 (세션 9)

- **Ultra Plan Deep Mode** 실행 — 3개 병렬 Explore 에이전트 + Plan 에이전트
  - 에이전트 1: 영향 범위 분석 (백엔드 6모델, 9라우터, 프론트엔드 30페이지 전수 스캔)
  - 에이전트 2: 아키텍처 분석 (데이터 흐름, 인증, DB, 배포 구조 심층 분석)
  - 에이전트 3: 리스크 & 의존성 분석 (보안, GPU, 디스크, 확장성 리스크 매트릭스)
- 16개 Step, 40+ 파일, 6개월 로드맵으로 구성된 청사진 완성
  - **Phase 1 마무리** (1-2주): 보안 강화, Alembic, 의존성 고정, 디스크 정리, 성능 최적화
  - **Phase 2 Pixel Streaming** (5-6주): 로컬 테스트 → Linux 패키징 → Docker GPU → WebRTC → 인증
  - **Phase 3 AI 에이전트** (5-6주): AI 게이트웨이 → 에이전트 프레임워크 → 채팅 UI → UE5 통신
  - **인프라 DevOps** (지속): CI/CD, 모니터링, DB 백업, GPU 스케일링
- P0 리스크 3건 식별: 디스크 86%, JWT 하드코딩, DB 마이그레이션 부재

---

## 2026-04-07

### 작업 요약 (세션 6)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Orbitron 서버 사양 문서 + 관리자 메뉴 추가 | 완료 |
| feat | TwinverseDesk UE5 C++ 프로젝트 초기화 (별도 리포) | 완료 |
| infra | Orbitron 서버 nvidia-container-toolkit 설치 (Docker GPU) | 완료 |
| infra | TwinverseDesk Dedicated Server 빌드 타겟 + Pixel Streaming 패키징 설정 | 완료 |
| infra | SSH 키 인증 등록 (Windows PC → Orbitron 서버) | 완료 |
| docs | /start, /end 스킬 업데이트 (Orbitron 서버 상태 확인/동기화) | 완료 |

### 세부 내용 (세션 6)

- TwinverseDesk UE5 5.7.4 C++ Third Person 프로젝트 생성 (`C:\WORK\TwinverseDesk`)
  - GitHub 리포 생성: ChoonwooLim/TwinverseDesk (Private, Git LFS 744파일 141MB)
  - `.gitignore` UE5 전용, `.gitattributes` LFS (uasset, umap, 텍스처, 오디오, 3D모델 등)
  - Pixel Streaming + Pixel Streaming 2 + PixelStreamingPlayer 플러그인 활성화
  - Dedicated Server 빌드 타겟 (`TwinverseDeskServer.Target.cs`) 추가
  - 패키징 설정 (Shipping, 맵/디렉토리 쿡, Pixel Streaming 기본 설정)
- Orbitron 서버 GPU 환경 확인 및 설정:
  - GTX 1080 x 2장 (각 8GB VRAM), NVIDIA Driver 580.126.09, CUDA 13.0
  - nvidia-container-toolkit v1.19.0 설치 → Docker 컨테이너에서 GPU 접근 가능
  - Docker GPU Runtime 등록 및 검증 완료
- `docs/orbitron-server.md` 신규 생성 (하드웨어/소프트웨어/GPU/컨테이너/Pixel Streaming 준비 상태)
- 백엔드 `_seed_docs()`에 orbitron-server 키 추가 → DB 자동 동기화
- 프론트엔드 사이드바에 "Orbitron 서버" 서브메뉴 추가
- SSH 키 인증 등록 (비밀번호 없이 Orbitron 접속 가능)
- /start 스킬: 세션 시작 시 SSH로 서버 상태(GPU/컨테이너/디스크) 자동 확인
- /end 스킬: 세션 종료 시 서버 상태 변경 감지 → 문서 자동 업데이트

---

## 2026-04-09

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Claw Code 분석 페이지 (01_instructkr 프로젝트 정밀 분석 보고서) | 완료 |
| feat | Claude Code 공식 레포 분석 페이지 (02_anthropics 프로젝트 정밀 분석 보고서) | 완료 |
| feat | 프론트엔드 npm run dev 시 백엔드 자동 실행 (concurrently) | 완료 |

### 세부 내용

- **Claw Code 분석 페이지** (`/admin/claw-code`):
  - D:\00_AI_ALL\01_instructkr 프로젝트 완전 분석 (Rust 재구현 Claude Code CLI)
  - 10개 섹션: 개요, 아키텍처 흐름, 10개 크레이트 상세, 9개 기능 카테고리, 기술 스택(12 라이브러리 + 7 프로토콜), Python 참조 구현, 빌드 커맨드, 패리티 상태, 프로젝트 철학, CI/CD
  - AdminClawCode.jsx + AdminClawCode.module.css (Dark Glass Neon 테마)
  - 사이드바 Claude Code > "Claw Code 분석" 서브메뉴 추가

- **Claude Code 공식 레포 분석 페이지** (`/admin/claude-code-repo`):
  - D:\00_AI_ALL\02_anthropics 프로젝트 완전 분석 (Anthropic 공식 Claude Code CLI)
  - 10개 섹션: 개요(설치 방법 4종), 아키텍처 흐름, 디렉토리 구조, 12개 공식 플러그인 상세, 14개 에이전트 테이블, 6종 훅 시스템(hookify 규칙 예시), 13개 슬래시 커맨드, 기술 스택, 4종 보안 기능, 11개 GitHub Actions
  - AdminClaudeCodeRepo.jsx + AdminClaudeCodeRepo.module.css (Dark Glass Neon 테마)
  - 사이드바 Claude Code > "공식 레포 분석" 서브메뉴 추가

- **백엔드 자동 실행**:
  - concurrently 패키지 설치 (devDependencies)
  - `npm run dev` → 백엔드(uvicorn) + 프론트엔드(vite) 동시 실행
  - `npm run dev:front` / `npm run dev:back` 개별 실행 스크립트 추가

### 작업 요약 (세션 2)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Phase 1 보안 강화 + Alembic + TVDeskRun PS2 스트리밍 연동 | 완료 |
| feat | PS2 Spawner — 유저별 독립 UE5 인스턴스 자동 생성/관리 | 완료 |
| feat | PS2 GPU 서버 외부 접근 — Cloudflare Tunnel + 독립 Spawner API | 완료 |
| feat | PS2 서버 자동 시작 (Wilbur + Spawner 자동 실행) | 완료 |
| feat | PS2 패키지 빌드 자동 감지 (packaged exe 우선, 에디터 fallback) | 완료 |
| feat | Pixel Streaming 2 DeskLaunch UI 컴포넌트 | 완료 |
| feat | PS2 외부 접근 — Cloudflare Tunnel + GPU 서버 통합 | 완료 |
| feat | 멀티 레벨 선택 UI + 백엔드 맵 파라미터 지원 | 완료 |
| feat | 어드민 Unreal Engine 문서 섹션 (5개 기술 문서 + 사이드바 메뉴) | 완료 |
| fix | TVDeskRun 원래 2D 가상오피스 페이지 복원 | 완료 |
| fix | subprocess.CREATE_NEW_PROCESS_GROUP Windows 전용 분기 | 완료 |
| fix | 프론트엔드 .env.production PS2 API URL 빌드 반영 | 완료 |
| fix | PS2 API URL 프로덕션 fallback 하드코딩 | 완료 |
| style | TopBar 메뉴명 'TwinverseDesk 실행하기' → 'TwinverseDesk 실행' | 완료 |

### 세부 내용 (세션 2)

- **PS2 Spawner 시스템 전체 구현**:
  - `backend/services/ps2_service.py` — UE5 인스턴스 생성/관리 핵심 서비스 (spawn, heartbeat, terminate, 좀비 정리)
  - `backend/routers/ps2_spawner.py` — 6개 사용자 API + 4개 관리자 API 엔드포인트
  - `backend/models/ps2_session.py` — PS2Session DB 모델 (session_id, pid, map_path, heartbeat 등)
  - 유저별 독립 UE5 인스턴스: 최대 3개 동시, 90초 heartbeat 타임아웃, psutil 기반 좀비 정리

- **UE5 맵 전환 (GameInstance 방식)**:
  - `TwinverseDeskGameInstance.cpp` — `-MapOverride=` CLI 인자 읽어서 `OpenLevel()` 호출
  - UE5 패키지 빌드에서 positional arg, ExecCmds, GameMode BeginPlay 모두 실패 → GameInstance::OnStart()가 유일한 해법
  - spawn 시 맵이 다르면 기존 세션 종료 후 새 세션 생성 (idempotent + map comparison)

- **DeskLaunch 멀티 레벨 UI**:
  - LEVELS 배열 (Modern Office, New York City) + 썸네일 카드 선택 UI
  - spawn 요청 시 선택된 맵 전송: `ps2api.post("/api/ps2/spawn", { map: selectedLevel.map })`

- **Cloudflare Tunnel**: ps2-api.twinverse.org → localhost:8000, ps2.twinverse.org → localhost:8080

- **어드민 UE 문서 5개**: Pixel Streaming 2, PS2 Spawner API, GPU 호스팅, EOS Framework, UE5 프로젝트 설정
  - `backend/main.py` _seed_docs()에 등록, 사이드바 "Unreal Engine" 드롭다운 메뉴 추가

---

### 작업 요약 (세션 3 — Ultra Plan: DeskRPG 2D→3D 재구현)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | Phase 1: UE5 Office 기반 구조 — GameMode, Character, Controller, Furniture, Minimap | 완료 |
| feat | Phase 2: 멀티플레이어 + MetaHuman — GameState, PlayerState, AnimInstance, AvatarTypes, DedicatedServer | 완료 |
| feat | Phase 3: AI NPC 시스템 — NPC, Conversation(LLM), NPCManager, TaskBoard, MeetingRoom | 완료 |
| feat | Phase 4: 프론트엔드 연동 — DeskLaunch Office 모드, ChatWidget, MapEditor, HUD, NPC API | 완료 |
| feat | PS2 Dedicated Server 모델 + 서비스 (멀티플레이어 아키텍처) | 완료 |
| feat | NPC Chat API (/api/npc/chat — Anthropic/OpenAI LLM) | 완료 |

### 세부 내용 (세션 3)

- **Ultra Plan Deep Mode 실행**: DeskRPG 2D 가상 오피스를 UE5 3D 메타버스 오피스로 100% 재구현
  - 4 Phase, 22 Step, 17개 C++ 클래스 (34파일) + 3개 백엔드 파일 + 2개 프론트엔드 수정

- **Phase 1 — UE5 기반 구조** (Office/ 서브폴더, 기존 코드 무수정):
  - `Build.cs` +6 모듈 (NavigationSystem, NetCore, HTTP, Json, JsonUtilities, Niagara)
  - `TwinverseDeskGameMode` AGameModeBase→AGameMode (ServerTravel, PostLogin/Logout)
  - `OfficeCharacter` 리플리케이션, FAvatarAppearance, 클릭이동+WASD, 300 UU/s
  - `OfficePlayerController` Enhanced Input, 마우스커서, 줌(400~1500)
  - `OfficeGameMode` Office 전용 (Desk 스폰, HUD/GameState/PlayerState 연결)
  - `OfficeFurniture` 8종 가구 타입, 오버랩 상호작용
  - `OfficeMinimap` SceneCapture2D 직교 투영 10FPS

- **Phase 2 — 멀티플레이어 + MetaHuman**:
  - `OfficeGameState` 채팅 히스토리 + Multicast RPC (Socket.IO 대체)
  - `OfficePlayerState` 아바타/상태/데스크 리플리케이션
  - `OfficeAvatarTypes` MetaHuman 커스터마이징 (LPC 7그룹→MetaHuman 매핑)
  - `OfficeAnimInstance` Speed/Direction/ActionState 동기화
  - `PS2DedicatedServer` 모델 + `ps2_dedicated_service.py` (포트 자동 할당, 자동 종료)
  - PS2 Spawner API 4개 Office 엔드포인트 추가

- **Phase 3 — AI NPC 시스템**:
  - `OfficeNPC` 6 행동 상태, NavMesh 이동, 3초 재탐색, 홈 복귀
  - `OfficeNPCConversation` HTTP Async → /api/npc/chat → LLM (2초 쿨다운)
  - `OfficeNPCManager` 고용/해고, 데스크 할당, 5종 프리셋 페르소나
  - `OfficeTaskBoard` 5단계 상태, 60초 자동스캔, 5분 stall 감지
  - `OfficeMeetingRoom` 3모드(auto/manual/directed), 투표, 회의록 내보내기
  - `backend/routers/npc.py` NPC Chat API (Anthropic Claude / OpenAI 지원)

- **Phase 4 — 프론트엔드 연동**:
  - `ps2api.js` officeApi.join/status 추가
  - `DeskLaunch.jsx` Office 멀티플레이어 레벨 + Multiplayer 뱃지 + 진행률 업데이트
  - `OfficeChatWidget` UMG 채팅 (4채널, NPC 1:1, 500자 제한)
  - `OfficeMapEditor` 런타임 가구 배치 (그리드 스냅 50UU, 회전, Server RPC)
  - `OfficeHUD` 7개 위젯 통합 관리

---

### 작업 요약 (세션 4 — UE5 플러그인 + 이주 문제 해결 + 컴파일 에러 수정)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | TwinverseDesk.uproject에 ChaosVehiclesPlugin 활성화 | 완료 |
| fix | TwinverseDesk.uproject에 PCG 플러그인 5종 활성화 | 완료 |
| fix | ABP_Dashboard 이주 후 Cast/VehicleMovementComponent 에러 해결 가이드 | 완료 |
| fix | OfficeCharacter.cpp C4458 — 로컬 변수 Mesh가 ACharacter::Mesh 숨김 | 완료 |
| fix | OfficeNPC.cpp C4458 — 동일 Mesh 이름 충돌 | 완료 |

### 세부 내용 (세션 4)

- **PCG_Study_Modern 레벨 이주 문제 진단**:
  - 소스(A01_UE5_contents) vs 대상(TwinverseDesk) 프로젝트 구조 비교
  - 원인: ChaosVehiclesPlugin 미활성화 + 에셋 폴더 누락 (Vehicles/ 1,154파일, Car_Dealership/ 334파일)
  - TwinverseDesk.uproject에 ChaosVehiclesPlugin, PCG 관련 플러그인 5종 추가

- **ABP_Dashboard 블루프린트 에러 해결**:
  - Parent Class를 AnimInstance → VehicleAnimationInstance로 변경
  - Bad cast node 삭제 → 새 Cast To BP_Farton 노드 생성
  - As BP Farton에서 Vehicle Movement Component, Fuel, Get Forward Speed 노드 재생성/연결

- **UE5 패키징 C++ 컴파일 에러 수정**:
  - OfficeCharacter.cpp:133, OfficeNPC.cpp:217 — `USkeletalMeshComponent* Mesh` → `CharMesh`로 변수명 변경
  - `ACharacter::Mesh` 멤버와 이름 충돌 해결 (error C4458)

---

## 2026-04-10

### 작업 요약 (세션 1 — 배포 안정성)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | Dockerfile SECRET_KEY/DATABASE_URL 기본값 + HEALTHCHECK 추가 | 완료 |
| fix | lifespan 시작 작업 try-catch — 개별 실패 시에도 서버 기동 (크래시 루프 방지) | 완료 |
| fix | database.py pool_pre_ping=True — DB 연결 끊김 자동 복구 | 완료 |

### 작업 요약 (세션 2 — Office 맵 빌드 사양서)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | Office/ C++ 17 클래스 정밀 분석 → 맵 요구사항 추출 | 완료 |
| docs | docs/office-map-spec.md 신규 작성 — UE5 OfficeMain 13단계 빌드 가이드 | 완료 |

### 세부 내용 (세션 2)

- **C++ 코드 분석**: OfficeGameMode, OfficeCharacter, OfficeFurniture, OfficeMeetingRoom, OfficeNPCManager, OfficeMapEditor, OfficeTaskBoard 등 핵심 클래스 정독
- **핵심 발견**:
  - `DefaultEngine.ini:15`에 `ServerDefaultMap=/Game/Maps/Office/OfficeMain.OfficeMain` 이미 등록됨 → 맵을 정확히 이 경로에 만들면 DS 자동 로드
  - `OfficeGameMode::ChoosePlayerStart_Implementation`이 PlayerStartTag = "Desk" 액터만 round-robin 사용
  - `GlobalDefaultGameMode`가 아직 GM_SuperheroFlight → 전역 변경 금지, World Settings로만 override
  - Content/Office/, Content/Maps/Office/ 둘 다 미생성 (깨끗한 출발선)
- **사양서 13단계**: 디렉토리 → BP wrapper 12개 (BP_OfficeGameMode, BP_OfficeCharacter, BP_OfficeNPC, BP_Desk/Chair/Whiteboard/MeetingTable/Bookshelf/Plant/Monitor, BP_OfficeMeetingRoom) → World Settings → Geometry → PlayerStart 20개 (Desk 태그) → 데스크/의자/모니터 → MeetingRoom ×2 (Auto/Manual) → TaskBoard/장식 → NPC Home Points ×10 → 라이팅(Rect Light + 네온 톤) → NavMesh(Dynamic) → Pixel Streaming(Forward Shading) → PIE 검증
- **검증 체크리스트 9개 항목** + **후속 작업 6개** (MetaHuman, DS 패키징, BehaviorTree, TaskBoard UMG, MapEditor UI, 에셋 폴리싱) 명시

### 작업 요약 (세션 3 — DeskLaunch "플랫폼 연결오류" 긴급 수정)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | GPU PC 백엔드가 .env 한글 주석 → cp949 UnicodeDecodeError로 기동 실패 진단 | 완료 |
| fix | backend/.env 한글 주석 2줄 제거 (.env 규칙 위반이기도 함) | 완료 |
| fix | scripts/start_gpu_server.bat에 `set PYTHONUTF8=1` 추가 (영구 방어) | 완료 |

### 세부 내용 (세션 3)

- **증상**: `https://twinverseai.twinverse.org/twinversedesk/launch` 에서 "Start My Session" 클릭 시 CORS 에러 + ERR_FAILED로 "플랫폼 연결오류" 표시
- **진단 단계**:
  - 1차: `curl http://localhost:8000/health` → HTTP 000 (응답 없음)
  - 2차: `curl https://ps2-api.twinverse.org/health` → HTTP 502 (Cloudflare Tunnel은 살아있는데 upstream 죽음)
  - 3차: `netstat` 포트 8000 LISTENING 없음, `tasklist`에 python.exe 0개 (Wilbur/cloudflared만 생존)
  - 4차: `python -c "from main import app"` → `UnicodeDecodeError: 'cp949' codec can't decode byte 0xec in position 684` from starlette/config.py
- **근본 원인**: `backend/.env` line 24의 `# OpenClaw 서버` (UTF-8 한글) → slowapi Limiter 초기화 시 starlette Config가 .env를 읽는데 Windows 기본 cp949로 open → 즉시 크래시 → uvicorn 기동 실패
- **왜 CORS 에러로 보였나**: 서버가 응답 자체를 못 해서 preflight OPTIONS에 ACAO 헤더가 없음 → 브라우저가 "CORS policy에 의해 차단됨" 메시지 표시. 실제로는 CORS 코드(`main.py:461-466`)는 이미 올바르게 `twinverseai.twinverse.org` 포함 중이었음 (b8a8a24 커밋)
- **수정**:
  1. `backend/.env` — 한글 주석 `# https://hpanel.hostinger.com/ ---> VPS Hosting` + `# OpenClaw 서버` 제거 (.env는 local-only, gitignore됨)
  2. `scripts/start_gpu_server.bat:25` — `start "TwinverseAI Backend" /min cmd /c "set PYTHONUTF8=1&& cd /d ... && uvicorn ..."` — Python 전역 UTF-8 모드 강제
- **검증**: `start_gpu_server.bat` 재실행 후
  - `http://localhost:8000/health` → HTTP 200 (python.exe PID 60820 신규 기동)

### 작업 요약 (세션 4 — DeskLaunch "Invalid token" 후속 조치)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | ps2api.js에 401 response interceptor 추가 — stale 토큰 자동 로그아웃 | 완료 |

### 세부 내용 (세션 4)

- **증상**: CORS 해결 직후 새 에러 — 401 Unauthorized "Invalid token" (GET/POST /api/ps2/*)
- **크로스 검증**:
  - Orbitron docker exec env → `SECRET_KEY=orbitron-twinverseai-secret-key-2026` (GPU PC .env와 동일)
  - Orbitron 로그인 API로 방금 발급받은 토큰을 GPU PC 로컬/터널 양쪽 엔드포인트에 전송 → HTTP 200 ✓
  - 즉 양쪽 서버 완벽 호환, 서버 측 문제 아님
- **근본 원인**: 사용자 브라우저 localStorage의 토큰이 stale
  - ef6784c(2026-04-10 오전 SECRET_KEY 기본값 추가) 이전에 발급된 토큰이거나
  - 8시간 만료(ACCESS_TOKEN_EXPIRE_MINUTES = 60*8)
- **재발 방지**: [frontend/src/services/ps2api.js](frontend/src/services/ps2api.js)에 401 response interceptor 추가
  - api.js와 동일한 패턴: 401 → localStorage clear → /login 리다이렉트
  - 기존에 ps2api는 request interceptor만 있고 response interceptor가 없어서 stale 토큰으로 영원히 막혀 있었음
- **사용자 즉시 해결법**: 로그아웃 → 재로그인 (또는 Orbitron 재배포 후 자동 리다이렉트)

---

## 2026-04-12

### 작업 요약 (2026-04-10 인시던트 재발 방지 하드닝 + UI 상태 반영)

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | backend load_dotenv 4곳에 `encoding="utf-8"` 명시 (defense-in-depth) | 완료 |
| fix | scripts/check_backend_ready.py 신규 — .env UTF-8+ASCII 검증 + backend import 테스트 + /health 폴링 | 완료 |
| fix | start_gpu_server.bat: pre-flight + post-launch health poll 연동, 실패 시 fail-loud | 완료 |
| style | DeskLaunch: 3D Virtual Office 카드 disabled + "개발중 / 실행 불가" 오버레이 | 완료 |
| fix | DeskLaunch: 헬스체크 실패를 silent catch에서 visible 오프라인 배너로 전환 | 완료 |
| docs | CLAUDE.md: .env ASCII-only 강제 규칙 + GPU 서버 기동 규칙 섹션 신설 | 완료 |

### 세부 내용

- **배경**: 2026-04-10 인시던트(.env cp949 크래시 → 터널 502 → 브라우저 CORS 오류) 재발 방지. 당일 즉시 수정은 이미 완료됐지만 사용자 지시 "다시는 재발하지 않게 단단히 조치"에 따라 3중 방어 + 가시성 강화.
- **3중 방어**:
  1. **Python 수준**: `load_dotenv(encoding="utf-8")` — [backend/main.py:7](backend/main.py#L7), [backend/ps2_server.py:21](backend/ps2_server.py#L21), [backend/alembic/env.py:11](backend/alembic/env.py#L11), [backend/seed_admin.py:4](backend/seed_admin.py#L4). 이제 PYTHONUTF8 미설정 환경에서도 .env는 UTF-8로 읽힘.
  2. **프로세스 수준**: `start_gpu_server.bat`가 `set PYTHONUTF8=1` 먼저 설정 후 pre-flight 실행 (이전부터 있던 방어).
  3. **사전 검증**: [scripts/check_backend_ready.py](scripts/check_backend_ready.py) — .env 바이트를 직접 읽어 UTF-8 검증 + 비-ASCII 바이트 발견 시 줄번호와 함께 거부. 이어서 `backend.main` import까지 수행해 startup-time 크래시를 uvicorn 띄우기 전에 포착.
- **fail-loud 기동**: [scripts/start_gpu_server.bat](scripts/start_gpu_server.bat) 흐름 재설계 — `[0/3] pre-flight` → `[1/3] uvicorn` → `[1/3 verify] /health 30초 폴링`. 어느 단계든 실패하면 `pause + exit /b 1`로 즉시 중단하고 에러 메시지 표시. 이제 silent crash가 원천적으로 불가능.
- **Office 카드 비활성화**: 사용자 지적 — OfficeMain.umap + Dedicated Server 모두 미구축 상태인데 카드는 클릭 가능했음. [DeskLaunch.jsx:11-25](frontend/src/pages/twinversedesk/DeskLaunch.jsx#L11-L25)에 `disabled: true`, `statusLabel: "개발중"`, `statusNote: "OfficeMain 맵 + Dedicated Server 구축 중"` 추가. 그레이스케일 필터 + 반투명 오버레이 + 주황색 "개발중 / 실행 불가" 배지. `useState` 기본값을 `LEVELS.find(l => !l.disabled)`로 변경해 Modern Office (Solo)가 기본 선택. `handleSpawn` 진입부에서 disabled 레벨이면 즉시 error + 안내 메시지.
- **가시성 강화**: DeskLaunch가 `catch { /* spawner unavailable */ }`로 헬스체크 실패를 삼키던 것을 `healthError` state + `offlineBanner` 컴포넌트로 대체. HTTP 상태 코드가 있으면 "HTTP 502"를, 네트워크 오류면 "GPU 서버 연결 불가 — 서버가 꺼져 있거나 Cloudflare 터널이 끊어졌습니다"를 표시. 2026-04-10처럼 사용자가 "플랫폼 연결오류"라는 모호한 문구만 보고 고생할 일 없음.
- **문서화**: [CLAUDE.md](CLAUDE.md) `.env 규칙` 섹션에 ASCII-only 강제 + 2026-04-10 인시던트 요약 + 3중 방어 명시. 신규 `GPU 서버 기동 규칙` 섹션에 "start_gpu_server.bat 사용 필수 / pre-flight 우회 금지 / CORS 오류 → 먼저 curl /health" 가이드 추가.
- **검증**: `python scripts/check_backend_ready.py` → 3개 체크 OK. `npm run build` → 프론트 클린 빌드 (DeskLaunch 청크 18.37kB).
- **커밋**: `9404cb2 fix: GPU 서버 기동 하드닝 + 3D Virtual Office 개발중 표시` → origin/main 푸시 완료.

### 현재 상태 (다음 세션 참고)

- **Office 메타버스 (Milestone 6)**: 코드/사양서는 완성, 실제 자산은 아직 없음.
  - ✅ [docs/office-map-spec.md](docs/office-map-spec.md) — UE5 에디터에서 `/Game/Maps/Office/OfficeMain` 빌드하는 13단계 가이드
  - ✅ `DefaultEngine.ini:15`에 `ServerDefaultMap=/Game/Maps/Office/OfficeMain.OfficeMain` 설정됨
  - ✅ C++ 17 클래스 (OfficeGameMode/Character/NPC/Furniture/MeetingRoom/TaskBoard 등) 컴파일 준비 완료
  - ❌ OfficeMain.umap 자체가 미존재 → 사양서대로 에디터 작업 필요
  - ❌ Dedicated Server 빌드/배포 미완 → PS2 backend의 `officeApi.join`이 아직 실행 불가
  - ❌ GPU PC의 UE5 패키지 빌드(Office 포함)도 미갱신
- **프론트 UI**: DeskLaunch에서 "3D Virtual Office" 카드는 명시적 개발중 상태. 위 3개 블로커 해소 후 [DeskLaunch.jsx:20](frontend/src/pages/twinversedesk/DeskLaunch.jsx#L20)의 `disabled: true` 제거하면 재활성화.
- **배포/운영 안정성**: 2026-04-10 인시던트 3중 방어 완료. GPU PC 재부팅 시 `start_gpu_server.bat`가 전부 자동 검증.
- **Next session 우선순위 제안**:
  1. 사용자가 UE5 에디터에서 OfficeMain.umap 실제 제작 (사양서 13단계 따라가기)
  2. Dedicated Server 빌드 파이프라인 구축
  3. GPU PC PS2 패키지에 Office 맵 포함 → `officeApi.join` 동작 확인
  4. DeskLaunch 카드 재활성화 + 실제 멀티플레이어 테스트

---

## 2026-04-13 (추가 세션 — PS2 GPU 서버 이전 + 고급 영상 앱 사양)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | 고급 영상 애플리케이션 기술 사양서 추가 (`.claude/specs/2026-04-13-high-end-video-app-spec.md`) | 완료 |
| infra | **별도 리포지토리 `TwinversePS2-Deploy` 에서 UE5 GPU 서버 twinverse-ai 이전** | 진행중 |

### 세부 내용

- **고급 영상 앱 사양**: 별도 스펙 문서 97줄 추가. 향후 UE5 Pixel Streaming 기반 영상 편집/협업
  애플리케이션 설계 근거.
- **PS2-Deploy 세션 (주 작업, 별도 리포)**: 상세 내역은 `C:\WORK\TwinversePS2-Deploy\docs\work-log.md`
  참고. 요약 — 자동 로그아웃 루프 해결(JWT), 컨테이너 non-root 전환, UE5 패키지 레이아웃 보존,
  최종 블로커: Linux cook 에 `/Game/PCG` 누락으로 맵 로드 실패. Windows Editor 에서 재패키지 필요.

### 다음 세션 참고

- **크로스 프로젝트 의존성**: TwinversePS2-Deploy 의 UE5 빌드가 재패키지되면 GPU 서버가 완전 동작.
  DeskLaunch 페이지의 Solo / Office 카드 둘 다 영향받음.
- Office 메타버스(Milestone 6) 작업은 여전히 위 3개 블로커 유지.

---

## 2026-04-14

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| infra | **UE5 Linux cook 근본 원인 규명** (`TwinverseDesk/Config/DefaultGame.ini`) | 진행중 |
| chore | 포트포워딩 가이드(`iiff.twinverse.org`) 논의 — 진행 보류 | 보류 |

### 세부 내용

- **Linux cook 미동작 근본 원인 2건 식별 (별도 리포 TwinverseDesk)**:
  1. `+DirectoriesToNeverCook=(Path="")` — **빈 문자열이 "모든 경로"로 해석**되어 /Game/ 전체가
     쿡에서 제외되던 버그. 빈 항목 제거로 해결.
  2. `ServerDefaultMap=/Game/Maps/Office/OfficeMain` 이 존재하지 않는 맵을 가리켜 실패.
     `PCG_Study_Modern` 으로 교정(이전 세션).
- **효과 검증**: Cook 결과 594 packages(전부 Engine) → **3816 packages(/Game/ 전부 포함)**.
  PCG_Study_Modern 본체와 의존 에셋 정상 쿡 확인.
- **남은 이슈**: PCG 제너레이터가 `RainforestPack/NeoDubai/Fab` 를 하드 레퍼런스함 → 해당 디렉토리
  NeverCook 지정 시 "Content is missing from cook" 에러. NeverCook 목록에서 제거 필요.
  또한 `Variant_*` UE5 템플릿이 누락된 `/Script/TP_ThirdPerson` C++ 모듈을 참조해 StateTree 컴파일
  실패. Variant_* 는 NeverCook 유지 대상.
- **네트워크 작업 보류**: LG U+ 공유기(192.168.219.1) 에 `iiff.twinverse.org → 192.168.219.101:443`
  포트포워딩 가이드 제시했으나 사용자 판단으로 중단.

### 다음 세션 참고

- **TwinverseDesk `DefaultGame.ini` 최종 정리 필요**: NeverCook 에서 RainforestPack/NeoDubai/Fab
  제거, Variant_* / Maps 만 유지. 재패키지 → Linux pak 에 .umap 실존 확인.
- **이후 TwinversePS2-Deploy 배포**: 새 pak 으로 `build/` 덮어쓰기 → commit → `twinverse-ai`
  에서 `docker compose` 재기동 → Pixel Streaming 엔드투엔드 검증 (PS2-Deploy Milestone 5→6).
- **iiff 도메인 노출 방식 결정 필요**: Cloudflare Tunnel(ps2 방식) vs 직접 포트포워딩 — 보안/DDNS
  관점에서 터널 권장.

---

## 2026-04-15

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | TwinverseFolder 공유 드라이브(Z:) 설정/복구 가이드 작성 | 완료 |
| docs | Orbitron Pixel Streaming 플랫폼 설계 스펙 작성 | 완료 |
| docs | Orbitron Pixel Streaming 구현 계획서 작성 (7 Phase, ~35 tasks) | 완료 |
| infra | Orbitron 대시보드 프로젝트 27 `twinverse-ps2` start_command 복구 | 완료 |
| docs | 개발 AI 핸드오프 패키지 `Z:\OrbitronHandoff\` 배포 (README + spec + plan) | 완료 |

### 세부 내용

- **공유 드라이브 가이드** (`docs/shared-drive-setup.md`, commit 3fcfa93): Orbitron Samba
  + Windows `cmdkey`/`net use` 영구 매핑 절차. 2026-04-15 자격증명 소실 재발 방지 목적.
- **Pixel Streaming 플랫폼 설계** (`docs/superpowers/specs/...-design.md`, commit b7af68c):
  TwinverseAI 프로젝트 내부에 멀티 슬롯(Phase B) + 향후 멀티테넌트(Phase C) 진화 경로를
  포함한 전체 설계. 스키마(`ps_slots`, `ps_versions`), tus 업로드, 원격 배포, Cloudflare DNS/
  tunnel ingress 자동화, on-demand 컨테이너 수명 제어, 3-version 롤백, 보안(path traversal/
  command injection 방어) 모두 명세.
- **구현 계획서** (`docs/superpowers/plans/...-platform.md`, commit f8a95b2): Phase 0 사전
  조사 → Phase 1 DB/CRUD → Phase 2 업로드·추출 → Phase 3 이미지 빌드·전송 → Phase 4 활성화·
  롤백·DNS → Phase 5 런타임 제어·idle sweeper → Phase 6 UI → Phase 7 기존 `/opt/twinverse-ps2/`
  마이그레이션. TDD bite-sized task, 정확한 파일 경로/코드/커밋 메시지 포함.
- **Orbitron 대시보드**: project id 27 `twinverse-ps2` 가 이미 등록되어 있었으나 `start_command`
  가 `npm startdocker compose up -d` 로 파손되어 있어 SSH→psql 로 직접 UPDATE. build_command 도
  `docker build -t twinverse/ps2:latest .` 로 정정. 실제 배포는 repo orbitron.yaml 이 override.
- **핸드오프 패키지**: 외부 Orbitron 개발 AI 전달용으로 Z:\OrbitronHandoff\ 에 spec + plan +
  `README-handoff.md` 배치. README는 읽는 순서, Phase 0 게이트, 환경 정보(Orbitron/GPU 서버/
  Cloudflare), 기존 임시 구축본 정리 대상, 범위 경계(Phase B vs C) 명시.

### 다음 세션 참고

- **Phase 0 착수 대기**: Orbitron 개발 AI가 핸드오프 패키지 수령 → Phase 0 사전 조사(Orbitron
  내부 배포 파이프라인·Wilbur admin API·Cloudflare 토큰 범위) 결과 보고 기다림. 승인 후 Phase 1.
- **Phase 7 정리 대상**: 새 시스템 안정화 후 기존 project id 27 `twinverse-ps2` 및 GPU 서버
  `/opt/twinverse-ps2/` 철거. 현재는 임시 운영.
- **스펙 열린 질문**: spec 섹션 11 에 미해결 질문 목록 있음 — Phase 0 조사와 함께 해소.

---

## 2026-04-15 (추가 세션 — Office NPC OpenClaw LAN 이관 + 어드민 UI)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | NPC Tier 2 OpenClaw 게이트웨이를 Hostinger(Codex)에서 LAN twinverse-ai(Ollama qwen2.5:7b)로 이관 | 완료 |
| feat | LAN OpenClaw 를 Cloudflare Tunnel 로 `wss://openclaw.twinverse.org` 공개, DeskRPG 연결 성공 | 완료 |
| feat | TwinverseAI 어드민에 OpenClaw 디바이스 페어링 승인 UI + API 프록시 추가 (superadmin/admin 전용) | 완료 |
| docs | 메모리 `reference_openclaw_instances.md` 에 `docker restart` 금지 + agents.create 재시작 이슈 기록 | 완료 |

### 세부 내용

- **Hostinger Codex OAuth 고장 우회**: `OAuth token refresh failed for openai-codex` 에러
  (refresh token reuse) 때문에 DeskRPG NPC 응답 불가. Hostinger 인스턴스는 그대로 두고
  LAN twinverse-ai(192.168.219.117)에 두 번째 OpenClaw 컨테이너를 독립 기동
  (`ghcr.io/hostinger/hvps-openclaw:latest`, host network, `/srv/openclaw/data` 볼륨).
- **Ollama provider + qwen2.5:7b**: `gemma3:12b` / `gemma4:*` 는 Ollama tools 미지원이라
  Agent 용도 불가. `ollama/qwen2.5:7b` 로 전환, `contextWindow: 32768`, thinkingDefault=off.
- **Cloudflare Tunnel**: twinverse-ai `/etc/cloudflared/config.yml` 에
  `openclaw.twinverse.org → http://localhost:18789` ingress rule 추가. `systemctl restart
  cloudflared` 로 반영 (SIGHUP 미지원).
- **페어링 디버깅 절차**: Origin not allowed → `gateway.controlUi.allowedOrigins` 에
  `tvdesk.twinverse.org` 추가 / token_mismatch → `gateway.remote.token = gateway.auth.token` /
  pairing auto-approve 실패 → `openclaw devices approve <requestId>` 수동 승인.
- **어드민 UI (커밋 087b8e1)**: `backend/routers/admin_openclaw.py` 신규 (paramiko SSH →
  `docker exec openclaw openclaw devices list/approve`), `frontend/src/pages/admin/
  AdminOpenClawDevices.jsx` 신규, 사이드바 "OpenClaw 디바이스" 메뉴 추가. 앞으로 SSH 없이
  웹에서 페어링 승인 가능.
- **DeskRPG NPC 생성 이슈**: `agents.create` RPC 가 per-agent 플러그인 slot(`plugins.entries.
  browser.config`, `ollama.config`, `memory-core`)을 추가해 SIGUSR1 전체 재시작을 유발 →
  DeskRPG 의 follow-up `agents.files.set` 이 끊어져 "네트워크 오류"로 보임. 완화책으로
  `browser.enabled=false`, `memory-core.enabled=false` 로 전환.
- **`docker restart openclaw` 금지 규칙 확립**: 컨테이너 entrypoint 의 "Fixing data
  permissions" 단계가 EACCES 경합으로 `openclaw.json` 을 재생성 → 토큰 로테이트. 앞으로는
  `openclaw config set ...` CLI 만 사용 (내부 SIGUSR1 으로 토큰 보존).

### 다음 세션 참고

- **NPC 생성 재테스트 대기**: 새 토큰 `c96fc3c6148057…` 반영 후 DeskRPG 에서 NPC 생성 재시도.
  rate-limit(5분 창) 해제 기다리고 저장 → 에이전트 생성 성공 여부 확인.
- **browser/memory-core 비활성화 검증**: 이 설정으로 agents.create 재시작이 실제로 발생하지
  않는지(또는 빈도 감소) 확인. 여전히 재시작한다면 DeskRPG 의 create-agent flow 자체를 재시도
  tolerant 하게 바꾸는 것도 검토.
- **토큰 로테이트 대응**: LAN OpenClaw 는 docker restart 가 토큰 로테이트를 유발하므로,
  admin UI 에 "현재 토큰 조회" / ".env 자동 갱신" 기능 추가 검토.
- **Orbitron 배포본 동기화**: 지금 변경은 GPU PC 로컬 backend/.env 기반. Orbitron 배포본
  재빌드 시 어드민 UI 와 paramiko 의존성이 포함되는지 확인(`requirements.txt` 에 paramiko
  3.5.0 추가 완료).

---

## 2026-04-16 (OpenClaw 풀 콘솔 + 채팅 안정화 + Phase 1 멀티모달 첨부)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 어드민 OpenClaw 풀 콘솔 (Agents / Plugins / Config / Chat / Logs 5 탭, admin 전용) | 완료 |
| feat | 채팅 탭 — 에이전트 썸네일 카드 + 자동 WS 연결 + 세션 자동 생성 + 모델 동적 목록 | 완료 |
| feat | Phase 1 멀티모달 — 이미지(base64→vision 모델 attachments) + 문서(inline 텍스트) 첨부 UI | 완료 |
| fix | OpenClaw CLI 래퍼 실제 문법 반영 (agents list 500 해결, publickey SSH, 채팅 WS 연결) | 완료 |
| fix | Gateway 네이티브 프레임 프로토콜 (type:req/res/event) + payload unwrap + 5 operator scope + TUI 식별 | 완료 |
| fix | agents.update agentId / agent model 변경 시 타 에이전트 설정 보존 · 채팅 히스토리 per-agent | 완료 |
| fix | TwinverseDesk 실행 자동 로그아웃 방지 — PS2 헬스체크 401 에서 토큰 삭제 금지 | 완료 |
| fix | admin select 드롭다운 흰바탕+흰글씨 · WS 공개 엔드포인트 · 파일 읽기 폴백 · 새 agent 디렉터리 chown | 완료 |
| chore | `.claude/` 로컬 상태 파일을 git 추적에서 제외 | 완료 |

### 세부 내용

- **OpenClaw 풀 콘솔 (커밋 `82f2074`)**: admin 전용 페이지 `/admin/openclaw` 에 5 탭
  (Agents / Plugins / Config / Chat / Logs) 전면 도입. backend 는 `paramiko` SSH 로
  twinverse-ai 에 접속해 `openclaw <subcmd> --json` CLI 를 호출하고, Chat·Logs 는 gateway
  WS 를 릴레이 (`ws://localhost:18789` ↔ 프런트). 재시작 회피를 위해 `config set` CLI 만
  사용 (docker restart 금지 규칙 준수).
- **채팅 탭 진화 (3 단계)**:
  1. `fc893fa` — 에이전트 썸네일 카드형 목록 + 연결/세션 자동화.
  2. `4f41edc` — `models.list` RPC 로 모델 드롭다운 동적화, 전송 안정화.
  3. `0e0142a` (**Phase 1 멀티모달**) — 📎 버튼 / 파일 입력. 이미지는 base64 로 읽어
     `sessions.send(..., attachments=[{type:image,mimeType,fileName,content}])` 로
     전달, 문서 (.txt/.md/.json/.log/.csv) 는 `--- 첨부 문서: NAME ---` 블록으로 inline
     첨부. non-vision 모델에 이미지를 붙이면 경고 배너. backend WS frame size 8MB →
     16MB 상향.
- **Gateway 프로토콜 디버깅 14 연속 fix**: OpenClaw 게이트웨이의 실제 프레임 형식이 docs 와
  달라 다단계 수정. `type:req/res/event` + `payload`(not `result`), `session.message`
  (not `sessions.messages.*`), 5 operator scope (gateway.connect 핸드셰이크), TUI 식별
  (`dangerouslyDisableDeviceAuth` 가 scope 유지하도록), `agents.update` 가 `agentId`
  요구 (`id` 거부), CLI 문법 차이 (`agents list --json`), publickey SSH, WS 공개
  엔드포인트, 파일 읽기 폴백, chown node:node.
- **채팅 히스토리 per-agent (`2900c3b`)**: 에이전트 모델 변경 시 전체 에이전트 설정이
  wipe 되던 버그 수정 + 히스토리를 에이전트별 분리.
- **TwinverseDesk 자동 로그아웃 방지 (`310c3a4`)**: PS2 헬스체크가 401 반환할 때 api.js
  response interceptor 가 토큰 삭제 → 유저 로그아웃. PS2 헬스는 인증 정책 상 정상 401
  이므로 특정 경로는 interceptor 에서 스킵.
- **8 종 벤치 에이전트 IDENTITY (사전 준비)**: 이전 세션에서 bench-qwen25-7b/05b,
  bench-gemma4-e4b/26b/31b, bench-gemma3-12b, bench-mistral-7b, bench-llava-7b 8 개의
  `IDENTITY.md` 를 korean-only directive 와 역할 설명과 함께 작성, gateway agents list
  에 `identitySource: "identity"` 로 반영 확인.
- **미커밋 남은 변경**: `backend/routers/npc.py` (NPC 메시지 role 교대 + Claude fallback
  모델 ID 업데이트), `scripts/update_openclaw_token.js` (Orbitron 대시보드 토큰 갱신 헬퍼).
  오늘 OpenClaw 풀 콘솔 작업과 직접 관련 없어 이번 docs 커밋에서는 제외.

### 다음 세션 참고

- **사용자 스모크 테스트 대기**:
  1. 벤치 에이전트 8 종이 한국어로만 응답하는지 (한자 누출 없음) 확인.
  2. 첨부 UI 검증 — 문서 inline 전달, 이미지 → llava 분기.
- **`agents.files.get` 'unknown agent id' 로그 노이즈**: gateway CLI 에서 특정 상황에
  뜨는 에러 추적 (재시작 중 타이밍 이슈 가능).
- **남은 미커밋 변경 처리**: `backend/routers/npc.py` (NPC 메시지 role 교대) 는 다음
  세션에 별도 fix 커밋으로 분리. `scripts/update_openclaw_token.js` 는 `.gitignore`
  대상인지 판단 (실제 토큰이 하드코딩된 1 회성 스크립트).
- **Phase 2 멀티모달 설계**: 이미지/동영상 생성 (Flux/SD) 는 AI registry 에 별도 서비스로
  등록한 뒤 gateway 와 연결할지, TwinverseAI 백엔드에 직접 프록시할지 결정 필요.
- **Codex + Anthropic API 통합 문서화**: LAN(Ollama)·Hostinger(Codex) 구도에서
  Anthropic API 를 3rd provider 로 붙일 때의 키 분리·쿼터·라우팅 정책 정리.

---

## 2026-04-18 (OpenClaw 채팅 지속화 + 토큰 리셋 UI + Claude Max OAuth 복구)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | OpenClaw 콘솔 채팅 대화 지속화 — DB 테이블 + gateway `chat`/final → `session.message` alias | 완료 |
| feat | OpenClaw 토큰 리셋 UI — 게이트웨이 재시작 후 `/token/reset` 엔드포인트 + 볼륨 override | 완료 |
| feat | `claude-cli/*` 모델 프리셋 optgroup — 드롭다운에서 바로 선택 (전역 스키마 거부되는 프로바이더) | 완료 |
| feat | OpenClaw 에이전트 카드 설명 파싱 개선 (IDENTITY.md 역할 섹션 우선 · 디자인 정리) | 완료 |
| fix | 채팅 탭 502 — 에이전트 목록 N+1 `files.get` 페치 제거, 서버 응답에 description 포함 | 완료 |
| fix | IDENTITY.md 설명 추출 — 한국어 지시문/템플릿 주석 블록 배제, `## 역할` 섹션 우선 + 라벨 필드 폴백 | 완료 |
| fix | 채팅 어시스턴트 답변 중복 렌더링 — `chat` final 프레임과 `session.message` 이중 emit 중복 제거 | 완료 |
| fix | 에이전트 모델 변경 시 채팅 세션 캐시 무효화 (`openclaw:agent-model-changed` 이벤트) | 완료 |
| fix | TwinverseDesk 실행 401 자동 로그아웃 — api interceptor 에서 PS2 헬스 경로 스킵 (재발) | 완료 |
| fix | NPC 채팅 — 연속된 같은 role 메시지 자동 병합 + Claude fallback 모델 ID 교정 | 완료 |
| ops | Claude Max OAuth 만료 → 401 복구: 컨테이너 TTY `claude login` 후 `auth-profiles.json` 4 에이전트 싱크 | 완료 |

### 세부 내용

- **채팅 대화 지속화 (`37dd926`)**: `openclaw_chat_sessions` / `openclaw_chat_messages`
  Alembic 마이그레이션 (`3f2e455e`) 추가, `ChatTab.jsx` 가 에이전트별 히스토리를 DB 에
  영속. OpenClaw gateway 가 `session.message` 대신 `chat` + state=final 로 어시스턴트
  최종 메시지를 보내는 변경에 대응, 백엔드 `pump_gw_to_client` 가 `chat` final 프레임을
  `session.message` 별칭으로 한번 더 emit 하여 프론트 기존 렌더 경로 호환.
- **토큰 리셋 UI (`c52257c`)**: `docker restart openclaw` 가 `gateway.auth.token` 을
  새로 생성하는 문제 해결. `POST /api/admin/openclaw/console/token/reset` 가 SSH 로
  `/data/.openclaw/openclaw.json` 을 읽어 새 토큰을 `/app/data/.openclaw_token_override`
  볼륨 파일로 영속화 → 재배포 없이 `OPENCLAW_TOKEN` 즉시 갱신. 채팅 탭 "토큰 리셋" 버튼이
  WS 재연결까지 자동 수행.
- **`claude-cli/*` 프리셋 optgroup**: 전역 스키마가 `claude-cli` 프로바이더를
  거부(auth:"cli" / baseUrl 없음)하여 `/models` API 응답에서 빠지는 점을 회피 —
  `AgentsTab.jsx` 에 `EXTRA_PRESET_MODELS` 하드코딩으로 `claude-cli/claude-opus-4-7`
  등 4 개 ID 를 optgroup "Claude CLI (구독·프리셋)" 으로 항상 노출.
- **IDENTITY.md 설명 파서 3 단계 진화 (`b406ed9` → `3fc495f`)**: 카드 설명이
  "너는 한국어로만 답한다" 같은 지시문으로 오염되던 문제. (1) 한국어 지시문/템플릿 주석
  영역 정규식으로 배제, (2) `## 역할` 섹션을 1 순위로, (3) `Role:` / `역할:` 라벨 필드를
  폴백으로 추출.
- **채팅 중복 렌더 (`502f199`)**: `chat` final alias 도입 후 백엔드가 같은 어시스턴트
  메시지를 `chat` + `session.message` 로 2 회 emit 하여 UI 에 2 개 말풍선 표시. 서버측
  `emitted_message_ids` 세트로 dedupe.
- **모델 변경 캐시 무효화 (`59aabe1`)**: 에이전트 편집에서 모델만 바꿨을 때 기존 세션이
  과거 모델로 계속 동작. `openclaw:agent-model-changed` CustomEvent 를 `AgentsTab` 에서
  dispatch → `ChatTab` 이 수신 시 해당 에이전트의 세션/WS 를 재생성.
- **Claude Max OAuth 만료 인시던트**: 게이트웨이 재시작 이후 `claude-max` 응답이 중국어/
  한국어 혼용 + 가짜 "Think: off / token 18k/20k" 상태 메시지. 원인은 Anthropic OAuth
  access token 8 h 만료 + `/data/.openclaw/agents/*/agent/auth-profiles.json` 에 남은
  STALE 토큰 (`expires: 1776502083158`). TTY 로 `claude login` 재실행 후 node 스크립트로
  4 개 에이전트(claude-max/claude-opus/main/codex-pro) auth-profiles 를
  `/data/.claude/.credentials.json` 의 fresh 토큰과 싱크 + `managedBy:"claude-cli"`
  태그 추가. `openclaw agent --agent claude-max -m "hi"` → "hello from claude-max" 응답
  확인. **다음 만료**: 2026-04-18 17:20 UTC (한국 새벽 2:20). 그 이후 자동 갱신
  (refresh→access) 동작 여부가 남은 관찰 포인트.
- **NPC 메시지 role 교대 병합 (`3c27d1e`)**: Anthropic API 가 연속된 같은 role 메시지를
  거부하는 제약에 대응해 `backend/routers/npc.py` 에서 병합 유틸 추가 + fallback 모델
  ID 를 최신 Claude 로 교정.

### 다음 세션 참고

- **Claude Max OAuth 자동 갱신 검증**: 오늘 새벽 ~2:20 KST 이후 `openclaw agent --agent
  claude-max -m "ping"` 테스트. 성공 시 refreshToken 자동 갱신 정상 (아무 조치 불요),
  401 재발 시 refreshToken 엔드포인트 호출 스크립트 + cron (7h 간격) 자동화 필요.
- **토큰 override 라이프사이클**: `/app/data/.openclaw_token_override` 파일이 env_vars
  보다 우선권. 장기적으로 env_vars 자체를 해당 값으로 재동기화하여 override 삭제하는
  정책으로 정리.
- **`scripts/update_openclaw_token.js` 위치**: 실제 토큰이 하드코딩된 1 회성 헬퍼.
  `scripts/agents_final.json` / `agents_post_restart.json` 등과 함께 운영 시크릿 치우는
  정리 필요 (`.gitignore` 또는 `private-ops/`).
- **Phase 2 멀티모달 (Flux/SD)**: 이미지/영상 생성 프로바이더 설계 — 기존 LAN gateway 에
  별도 provider 로 붙일지 vs 백엔드에서 직접 프록시할지 결정 미해결.

---

## 2026-04-18 (추가 세션 — DeskRPG NPC 고용 게이트웨이 재시작 레이스 대응)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | DeskRPG `/_internal/rpc` 재시도 로직 추가 — OpenClaw 2026.4.12 자동 재시작 시 `agents.files.set` 이 "네트워크 오류"로 죽던 이슈 | 핫패치 적용 (재검증 미완) |
| infra | Orbitron 설치 패키지 (`~/.npm/_npx/.../deskrpg/server.js`) 에 `rpcWithRetry` 헬퍼 + `__notConnected` 분기 주입, `.bak.<ts>` 백업 | 완료 |
| chore | `scripts/patch_deskrpg_rpc_retry.js` — 재설치 대비 1 회성 핫패치 스크립트 (TwinverseAI 레포에 미커밋) | 완료 |

### 세부 내용

- **증상**: NPC 고용 다이얼로그가 "1/3 게이트웨이에 연결하는 중..." 에서 멈추거나
  "네트워크 오류가 발생했습니다" 로 실패. 서버 로그는 `WebSocket error: Unexpected
  server response: 502` 반복 → `RPC timeout` / `TimeoutError: The operation was aborted
  due to timeout` 으로 마무리. Cloudflare 터널은 `dial tcp 127.0.0.1:18789: connect:
  connection refused`, Docker 로그는 `[gateway] received SIGUSR1; restarting` 을
  13:28:00 / 13:28:22 / 13:31:10 세 번 기록.
- **원인**: OpenClaw 2026.4.12 의 reload manager 가 `agents.create` 직후 내부
  `plugins.entries.*.config` 를 JSON 재직렬화하면서 diff 오탐 → 전체 프로세스 재시작
  (`SIGUSR1`). DeskRPG 의 `/_internal/rpc` 는 단일 `_rpcRequest` 호출로 실패 시 즉시
  502 응답 → 프론트 `agentCreateNetworkError`.
- **Option B 패치**: `server.js` 에 `rpcWithRetry(channelId, method, params, 3)` 추가 —
  일시적 오류(`Gateway not connected` / `RPC timeout:` / `WebSocket is not open` /
  `closed before response`) 감지 시 `channelGateways.delete()` + `disconnect()` 후
  백오프 3.5s → 5s 로 최대 3 회 재시도. `/_internal/rpc` 핸들러는 이 헬퍼를 통과시키고
  `err.__notConnected` 플래그로만 503 분기 유지.
- **마스터 소스**: `C:\WORK\TwinverseAI\deskrpg-master\server.js` 직접 편집했으나 해당
  디렉토리는 TwinverseAI 레포에서 **gitignore** 되어 있음 (`.gitignore:46`). DeskRPG
  별도 소스 레포 위치가 특정되지 않아 영구 반영은 보류 (사용자 지시: "1번으로 해" =
  그대로 둠). 재설치 시 `scripts/patch_deskrpg_rpc_retry.js` 로 동일 핫패치 재적용.

### 다음 세션 참고

- **NPC 고용 최종 검증 미완**: 패치 적용 후 사용자가 "또 오류 내일 고치자" 로 세션 종료.
  내일 브라우저에서 NPC 고용 재시도 → 실패 시 `ssh stevenlim@192.168.219.101 "tail -80
  ~/.deskrpg/logs/server.log"` 에서 `[gateway] RPC "agents.files.set" attempt 1/3 failed
  ...` 재시도 로그 확인. 3 회 모두 실패하면 OpenClaw 게이트웨이 재시작 창이 5s 보다
  긴 경우 → 백오프 증가 또는 게이트웨이측 reload manager diff 오탐 자체를 고쳐야 함.
- **DeskRPG 소스 레포 위치 파악**: 핫패치가 `npm install` 로 증발 가능. 진짜 소스
  레포(GitHub or 다른 로컬 경로) 확인 후 커밋·publish 필요.
- **OpenClaw 2026.4.12 upstream 이슈 보고**: `plugins.entries.*.config` JSON 재직렬화
  diff 오탐 → 불필요한 `SIGUSR1` 재시작. 업스트림에 리포트하거나 reload manager 에
  deep-equal 비교 추가 패치 고려.
- **[🔴 긴급] `agents.list` config drift 인시던트**: 세션 종료 직전 발견. twinverse-ai
  OpenClaw 의 `/srv/openclaw/data/.openclaw/openclaw.json` `agents.list` 에서
  `claude-max` / `claude-opus` / `codex-pro` 가 누락되어 admin 콘솔에 노출 안 됨.
  **에이전트 디렉토리는 전부 디스크에 남아있음** (`/srv/openclaw/data/.openclaw/agents/claude-max/`
  등 — auth-profiles + OAuth 토큰 인텍트). 추가로 예전에 삭제한 bench-* / ceo-a /
  planner-a/b / dev-b 가 agents.list 에 계속 남아있어 admin UI 에 "되살아난" 것처럼 보임.

  백업 스냅샷 분석:
  - `.bak.4` (22:24:58) — 12 에이전트, claude-max 포함
  - `.bak.3` (22:28:00) — 13 에이전트, claude-max 포함 (+planner-b)
  - **`.bak.2` (22:28:22) — 12 에이전트, claude-max 제거됨** ← drop 발생 시점
  - `.bak.1` → `.bak` → 현재 — claude-max 없이 testnpc / designer-a 만 추가

  가설: 22:28:22 경 TwinverseAI 어드민의 어떤 RPC 가 stale agents.list 스냅샷으로
  config 를 전체 덮어써버림 (모델 변경 / 토큰 리셋 / 에이전트 편집 중 하나). 삭제된
  bench-* 가 "되살아난" 것도 같은 메커니즘 — 이전 삭제 RPC 가 디렉토리만 지우고
  agents.list 를 제대로 업데이트 안 해서 config 에 계속 남아있음.

  **내일 복구 절차**: (1) `openclaw.json.bak.3` 기준으로 복원 → claude-max 복귀,
  (2) `claude-opus` / `codex-pro` 는 bak.4 에도 없으므로 `openclaw agents add` RPC 로
  수동 재등록 (agents dir 는 그대로 재사용). (3) bench-* / ceo-a / planner-a/b / dev-b
  중 실제로 불필요한 것은 `openclaw agents remove` 로 제대로 제거.

  **원인 추적**: TwinverseAI 백엔드 (`backend/routers/admin_openclaw_console.py`) 와
  `frontend/src/pages/admin/openclaw/*` 에서 `agents.list` 를 통째로 PUT 하는 경로
  전부 검토. `config_set_batch` 우회 로직 (`da61599` 커밋 참고) 도 의심권.

---

## 2026-04-21 (LLM Wiki 설계 · 계획 · 전 프로젝트 배포)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| docs | LLM Wiki (Obsidian Vault) 설계 스펙 작성 | 완료 |
| docs | 스펙에 7.7 Deferred Triggers + 12 Claude Desktop 섹션 추가 | 완료 |
| docs | Phase A-H 구현 계획 작성 + `deploy-pointer.ps1` pwsh7 / `$dryRun` 충돌 수정 | 완료 |
| infra | `C:\WORK\llm-wiki\` 독립 repo 생성 (MVP 14 페이지) + GitHub private push | 완료 |
| infra | `deploy-pointer.ps1` 실행 — 21 개 `C:\WORK\` 프로젝트에 `AI_WIKI.md` 포인터 자동 생성 | 완료 |
| infra | `/end` 스킬 Phase 3.6 추가 (active + `_deferred` 2-pass 키워드 라우팅) | 완료 |
| infra | 전역 `~/.claude/CLAUDE.md` 에 LLM/AI 지식 참조 규칙 추가 | 완료 |
| feat | OpenClaw 에이전트 통합 테스트 커밋 (Phase 3.6 트리거 검증용 empty commit) | 완료 |

### 세부 내용

- **LLM Wiki 구축 목적**: 5 개 프로젝트 (TwinverseAI · SodamFN · TwinverseDesk · 기타) 가 Claude · Ollama · OpenClaw · Anthropic API 지식을 중복 기록하지 않도록 **단일 Wiki 참조** 로 수렴.
- **SSOT 경계**: 값 (env / IP / 토큰) = `infra-docs/ai-shared-registry.md`, 설명 · 사용법 · 특성 = `llm-wiki`.
- **검증**: 새 Claude 세션에서 `"Claude 4.7 의 Prompt Caching 비용 구조 알려줘"` 질문 → `AI_WIKI.md` → `20-APIs/Anthropic-API.md` Read → 정확한 답변 출력 (캐시 write 1.25× / read 0.1× / 5 분 TTL / 1024 토큰 / 4 블록) 확인.
- **Obsidian Vault 정비**: `attachmentFolderPath` → `90-Attachments`, `userIgnoreFilters: ["scripts/"]` 로 그래프 ghost cluster 제거.
- **VS Code 환경**: Foam + Markdown All in One + Paste Image + Mermaid 확장 4 개 설치 + `.vscode/settings.json` 에 이미지 경로 고정.
- **Phase 3.6 테스트**: `feat: test OpenClaw agent integration` empty commit (`9feef73`) 로 `openclaw` 키워드 감지 → `40-Tools/OpenClaw.md` 제안 UI 동작 검증.

### 다음 세션 참고

- **`agents.list` config drift 인시던트** (2026-04-18 세션 종료 직전 발견): 아직 미복구. 다음 세션에 `openclaw.json.bak.3` 기준 복원 + `claude-opus` / `codex-pro` 재등록 필요.
- **LLM Wiki stub 페이지**: `Prompt-Caching.md`, `Tool-Use.md` 등은 그래프에 점선으로 표시됨. 향후 `/end` Phase 3.6 로 자연스럽게 채워질 것.
- **AI_WIKI.md 배포 결과**: 21 프로젝트에 포인터 생성됨. `llm-wiki` / `infra-docs` / `bin` / `UnrealEngine` 은 SkipList 제외.

---

## 2026-04-24 (OpenClaw 과금 차단 · Codex 전환 · 워크플로우 정비)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | LAN OpenClaw 의 Anthropic API provider 키 제거 + `main` 에이전트 Anthropic 모델 사용 차단 | 완료 |
| infra | OpenClaw 기본 모델을 `openai-codex/gpt-5.5` 로 전환, `main` / `codex-pro` / `agents.defaults.model.primary` 동기화 | 완료 |
| infra | `agents.list` drift 복구 — 누락된 Codex/Ollama/Claude CLI 계열 에이전트 재등록, `claude-opus` API 과금 에이전트는 격리 | 완료 |
| docs | `ai-shared-registry.md` 를 먼저 갱신한 뒤 TwinverseAI 코드/Orbitron 설정 반영 | 완료 |
| chore | Codex 용 `AGENTS.md` 및 `.agents/skills`, `.agents/workflows` 기반 start/end 사용 경로 정리 | 완료 |

### 세부 내용

- **Anthropic API 비용 원인 추적**: `twinverse-ai` 의 `/srv/openclaw/data/.openclaw/openclaw.json`
  에 `models.providers.anthropic.apiKey` 가 설정되어 있었고, `main` 에이전트가
  `anthropic/claude-opus-4-7` 로 지정되어 있었다. 세션 JSONL 기준 2026-04-18~23 사이
  `main` 중심으로 Anthropic 호출 302 회가 확인되었고, 대부분 비용은 대형 system/tool
  prompt 의 `cacheWrite` 토큰에서 발생.
- **즉시 차단**: OpenClaw config 에서 Anthropic API key 를 빈 값으로 제거하고
  `plugins.entries.anthropic.enabled=false` 처리. `main` 은 임시 `ollama/qwen2.5:7b` 로
  내렸다가 사용자 요청에 따라 최종 기본 모델을 `openai-codex/gpt-5.5` 로 전환.
- **기본 모델 전환**: OpenClaw `models.providers.openai-codex.models` 에 `gpt-5.5` 항목을
  추가하고, `agents.defaults.model.primary`, `main`, `codex-pro` 를 모두
  `openai-codex/gpt-5.5` 로 설정. `claude-max` 는 Anthropic API 가 아닌
  `claude-cli/claude-opus-4-6` 로만 유지.
- **`agents.list` drift 복구**: 디스크에는 존재하지만 config 목록에서 빠졌던
  `ai-architect`, `debugger`, `devops`, `ue5-engineer`, `bench-qwen25-7b`, `claude-max`,
  `codex-pro` 를 복구. Anthropic API 과금 주체였던 `claude-opus` 는 목록에 복구하지 않고
  디렉터리만 남겨 격리.
- **스키마 오류 복구**: 직접 config 편집 중 `models.providers.anthropic.enabled` 및
  `agents.list[].displayName` 이 OpenClaw 2026.4.12 스키마에 맞지 않아 reload skip 이
  발생. 해당 키를 제거하고 `openclaw agents list --json`, `config get` 으로 정상화 확인.
- **프로젝트 동기화**: `backend/routers/npc_agent.py` 의 `OPENCLAW_MODEL` 기본값을
  `openai-codex/gpt-5.5` 로 교체하고, `Orbitron.yaml` 에 `OPENCLAW_MODEL` env 항목을
  추가. 로컬 `backend/.env` 도 같은 값으로 맞췄으나 `.env` 는 gitignore 대상.
- **Codex 워크플로우 확인**: Claude Code 의 `/start`, `/end` 와 같은 역할을 Codex 에서는
  `.agents/workflows/start.md`, `.agents/workflows/end.md` 를 읽어 실행하는 방식으로 사용.

### 검증

- `ssh twinverse-ai "docker exec openclaw openclaw agents list --json"` 정상 실행.
- `main` / `codex-pro` 모델이 `openai-codex/gpt-5.5` 로 표시됨.
- `agents.defaults.model.primary` 가 `openai-codex/gpt-5.5` 로 표시됨.
- OpenClaw config 에 Anthropic API key 값이 남아있지 않음.
- `python -m compileall -q backend` 통과.

### 다음 세션 참고

- Anthropic Console 의 실제 billing/usage 화면에서 2026-04-18~23 사용량을 대조해
  OpenClaw JSONL 추산치와 일치하는지 확인 필요.
- `claude-opus` 디렉터리는 의도적으로 `agents.list` 에 복구하지 않았다. 다시 노출할 경우
  반드시 `anthropic/*` 가 아닌 `claude-cli/*` 또는 `openai-codex/*` 모델로 새로 등록할 것.
- Orbitron 대시보드에 `OPENCLAW_MODEL=openai-codex/gpt-5.5` 가 실제 sync 되었는지 배포 전 확인.

---

## 2026-04-24 (DeskRPG 태스크 저장 복구 · PostgreSQL 전환 · 캐릭터 로딩 복구)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | NPC 대화에서 "태스크 등록" 응답 후 실제 태스크 수가 0 으로 남던 저장 오류 수정 | 완료 |
| feat | 태스크 패널에서 NPC 업무 지시사항을 직접 입력해 등록하는 폼과 socket handler 추가 | 완료 |
| infra | DeskRPG 런타임 DB 를 SQLite 혼용 없이 Orbitron PostgreSQL 전용으로 전환 | 완료 |
| fix | `/characters` 화면이 "로딩 중..." 에 멈추던 Next.js 서버 chunk 누락 배포 문제 복구 | 완료 |
| ops | Orbitron live package 에 checksum 기반 재동기화 후 `deskrpg doctor`, `/game`, `/api/auth/status` 검증 | 완료 |

### 세부 내용

- **태스크 저장 오류 원인**: PostgreSQL 모드에서 timestamp 컬럼에 문자열 ISO 값을 넣어
  `value.toISOString is not a function` 예외가 발생했고, 런타임 `server-db.js` 의 task schema 에
  `lastReportedAt` 등 일부 컬럼이 누락되어 있었다. `task-manager.js` 에 DB 타입별 timestamp 변환을
  추가해 PostgreSQL 은 `Date`, SQLite 레거시 경로는 ISO 문자열을 쓰도록 분기했고, 런타임 schema 를
  실제 PostgreSQL task 컬럼과 맞췄다.
- **업무 지시사항 등록 UX**: `TaskPanel.tsx` 에 선택 NPC 기준 태스크 제목/지시사항 입력 폼을 추가하고,
  `server.js` 및 `src/server/socket-handlers.ts` 에 `task:create` 이벤트를 연결했다. 이제 채팅 흐름과 별개로
  좌측 태스크 탭에서 NPC 업무 지시를 직접 등록할 수 있다.
- **PostgreSQL 단일화**: `bin/deskrpg.js`, `src/db/index.ts`, `src/db/server-db.js`,
  `src/lib/runtime-paths.*`, `.env.example`, `docker-entrypoint.sh` 를 PostgreSQL 전용으로 정리했다.
  SQLite lite setup, SQLite Docker compose, `drizzle-sqlite.config.ts` 는 제거했고, `DATABASE_URL` 이 없거나
  `DB_TYPE=sqlite` 인 경우 시작 단계에서 명확히 실패하도록 했다.
- **Orbitron 런타임 동기화**: 원격 `~/.deskrpg/.env.local` 을 PostgreSQL 모드로 정리하고, DeskRPG npm
  package 경로에 변경분을 반영했다. 실제 DB URL 값은 Orbitron 환경/secret 으로만 유지하고 문서에는 기록하지 않는다.
- **캐릭터 로딩 복구**: `npm pack` 산출물의 고정 mtime 과 동일 파일 크기 때문에 `rsync` 가 변경된 Next.js route
  chunk 를 건너뛰어 `/api/auth/status` 500 및 `/characters` 무한 로딩이 발생했다. 재배포 동기화를
  `rsync --checksum` 으로 다시 수행해 누락 chunk 를 복구했다.

### 검증

- `npx tsx --test src/lib/runtime-home.test.ts src/lib/task-manager.test.ts` 통과.
- `npm run build` 통과.
- Orbitron `deskrpg doctor` 통과.
- Orbitron 서버 로그에서 `[server-db] PostgreSQL mode - Drizzle ORM initialized` 확인.
- 라이브 `/api/auth/status` 가 HTTP 200 JSON 을 반환함 확인.
- 라이브 `/game` 응답 정상 확인.
- PostgreSQL 임시 task create/delete smoke test 통과.
- `DB_TYPE=sqlite` 강제 실행 시 PostgreSQL 필수 오류가 발생하는 것 확인.

### 다음 세션 참고

- `deskrpg-master/` 는 루트 `.gitignore` 대상이라 TwinverseAI 루트 Git 상태에는 코드 변경이 표시되지 않는다.
  이번 DeskRPG 수정은 Orbitron live package 에 반영된 hotfix 성격이며, 별도 DeskRPG upstream 저장소 관리가
  필요하면 해당 저장소 기준으로 커밋/릴리즈 절차를 따로 진행해야 한다.
- 이후 DeskRPG 배포 동기화는 timestamp/size 비교만 믿지 말고 checksum 기반 검증을 포함해야 한다.

---

## 2026-04-29 (OpenClaw 보안 감사 + Phase 0 #1 적용 · Windows Node 도입 설계)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| infra | OpenClaw (twinverse-ai) `security audit` 첫 실행, critical 3 / warn 3 식별 | 완료 |
| infra | Phase 0 #1 적용 시도 → **롤백** (TRAEFIK_HOST 가 백엔드 WS 연결을 차단하는 회귀 발생) | 롤백 완료 |
| fix | Dockerfile CMD/HEALTHCHECK 가 Orbitron `PORT` env 를 무시해 502 발생 → `${PORT:-8000}` 으로 수정 (commit 316f2e3) | 완료 |
| docs | TRAEFIK_HOST 사용 금지 사유 문서화 (admin-openclaw-console.md) | 완료 |
| design | Windows PC 를 OpenClaw Node 로 페어링하는 셋업 설계 (다층 방어 7계층) | 보류 (#2/#3 결정 후) |
| design | "1회 허용" Telegram 승인 흐름 설계 — `tools.exec.ask=on-miss` + `approvals.exec` 라우팅 | 검증 완료 |

### 세부 내용

- **OpenClaw 보안 감사 발견 (twinverse-ai 192.168.219.117)**:
  - `gateway.controlUi.dangerouslyDisableDeviceAuth=true` (CRIT) — Control UI device 인증 자체 OFF
  - `gateway.controlUi.allowInsecureAuth=true` (WARN) — HTTP 인증 허용
  - `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback=true` (WARN) — DNS rebinding 방어 약화
  - `tools.elevated.allowFrom.webchat=["*"]` (CRIT) — webchat 누구나 elevated 승인 — **다음 세션 Phase 0 #2**
  - 19개 작은 Ollama 모델(qwen2.5:7b, gemma3:12b, llava:7b 등)에 `web_fetch`/`browser` 활성 (CRIT) — 프롬프트 인젝션 위험 — **다음 세션 Phase 0 #3**

- **TRAEFIK_HOST 부트스트랩 trick (가장 중요한 발견)**:
  - `/hostinger/server.mjs` 부트스트랩 함수 `j()` 가 컨테이너 시작 시마다 `openclaw.json` 을 강제로 덮어씀
  - `process.env.TRAEFIK_HOST` 가 truthy 면 → controlUi 의 dangerous 플래그 3종 + `gateway.trustedProxies` 를 `delete` (안전 기본값 복귀)
  - TRAEFIK_HOST 미설정이면 → 매번 dangerous 플래그를 `true` 로 강제, `trustedProxies=["127.0.0.1/32"]` 강제
  - 따라서 `openclaw config set` 으로 dangerous 플래그를 끄고 재시작하면 다시 켜짐. **컨테이너 env 에 `TRAEFIK_HOST` 추가가 유일한 정공법**.
  - `docker stop openclaw && docker rm openclaw && docker run ... -e TRAEFIK_HOST=openclaw.twinverse.org ...` 로 재생성. `/srv/openclaw/data` 바인드 마운트라 데이터 보존됨.

- **wrapper-gateway 분리 구조 확인**:
  - 컨테이너 내부에 두 개 프로세스: (1) Express wrapper `node server.mjs` (host:18789) (2) `openclaw gateway` (loopback:18789)
  - Wrapper 가 X-Forwarded-* 헤더 strip 후 loopback 으로 proxy → `trustedProxies` 가 비어도 무해 (audit 의 "Reverse proxy headers not trusted" WARN 은 우리 환경에선 false positive)
  - Cloudflare Tunnel → Wrapper Express → OpenClaw Gateway 흐름 검증

- **Windows Node 도입 설계 (3개 검증 항목)**:
  - `openclaw node install` Windows: schtasks 등록, `--user` 플래그 없음 → 설치 시 Windows 사용자로 실행. 격리하려면 별도 `openclaw-node` 표준 사용자로 로그인 후 설치하거나 schtasks 수동 재구성 필요.
  - `openclaw approvals` 정책: `tools.exec.security ∈ {deny|allowlist|full}` × `ask ∈ {off|on-miss|always}` × `approvals.exec.targets` 조합. Telegram 라우팅으로 "1회 허용" 가능.
  - `gateway.nodes.{allowCommands,denyCommands}` 로 invoke 명령 단위 화이트/블랙리스트. `system.run` 같은 임의 셸 실행 차단 가능.

- **다층 방어 설계 (7계층)**:
  1. OS 격리 — 전용 `openclaw-node` 표준 사용자, ACL 로 `C:\WORK`·`.ssh`·real Chrome profile 차단, `C:\OpenClawSandbox\` 만 허용
  2. Chrome 분리 — `--user-data-dir=C:\OpenClawSandbox\Chrome`, Anthropic Console·은행·Gmail 절대 로그인 X
  3. 권한 분업 컨벤션 — OpenClaw AI 는 main 푸시·.env 수정·secrets 접근 금지, `openclaw/<topic>` 브랜치만
  4. 서비스 운영 — schtasks "스티븐 로그온 시" 트리거 (24/7 X)
  5. 승인 게이트 — `approvals.exec` Telegram 1회 승인
  6. 토큰 위생 — `OPENCLAW_GATEWAY_TOKEN` 정기 로테이션, Windows 노드 토큰도 `openclaw-node` 계정만 접근
  7. 감사 + 킬스위치 — `openclaw nodes reject --all-paired`, `openclaw node stop && uninstall`

### 검증 (Phase 0 #1 적용 직후)

- `openclaw security audit` 결과 변화: critical 3→2, warn 3→1
- 컨테이너 재생성 후 `cat /data/.openclaw/openclaw.json` → controlUi 에서 dangerous 키 3개 모두 absent (✓ 안전 기본값으로 복귀)
- `https://openclaw.twinverse.org/` HTTP 200 (Cloudflare 터널 정상)
- 로컬 게이트웨이 응답 정상 (16ms)

### ⚠️ 회귀 발견 + 롤백

`/end` 직전 어드민 콘솔에서 "Gateway 응답 없음" 발생. gateway 로그에서 거부 사유 확인:

```
ua=Python/3.11 websockets/13.1 code=1008
reason=control ui requires device identity (use HTTPS or localhost secure context)
```

원인 분석:

1. `dangerouslyDisableDeviceAuth=delete` → device 인증 ON → controlUi 경로 전체가 device 페어링 필수
2. `trustedProxies=delete` 까지 함께 삭제되어 wrapper Express 의 loopback 연결을 gateway 가 "외부 클라이언트" 로 분류
3. TwinverseAI 백엔드 (Python websockets) 는 controlUi 로 WS 연결하는데, device 페어링은 브라우저 전용 흐름이라 백엔드는 페어링 불가능
4. 모든 백엔드 → OpenClaw 호출이 1008 close 로 거부됨

롤백: `TRAEFIK_HOST` 환경변수 제거 후 컨테이너 재생성 (`docker rm -f openclaw && docker run -d ... <기존 env, TRAEFIK_HOST 없이>`). 부트스트랩이 dangerous 플래그를 다시 강제로 켰지만 백엔드 연결 정상화 우선. 보안 critical 3 개는 다음 세션에서 다른 방식 (백엔드 RPC 경로 변경 또는 부트스트랩 패치) 으로 재시도.

### 별건: Orbitron Dockerfile PORT 미준수 (502 Bad Gateway)

OpenClaw 롤백 후에도 `https://twinverseai.twinverse.org/admin/...` 가 502 반환. 추적 결과:

- Orbitron 이 `PORT=3441` env 주입 + 호스트 포트 3441→컨테이너 포트 3441 매핑
- Dockerfile CMD 가 `--port 8000` 하드코딩 → 앱이 8000 에서 listen, 컨테이너 3441 은 비어있음
- nginx upstream 이 `orbitron-twinverseai-<id>:3441` 으로 연결 → Connection refused → 502
- 직전 docs 커밋이 Orbitron 재배포를 트리거하면서 그제서야 노출된 잠재 버그 (이전 컨테이너 3 일간 살아 있어 가려져 있었음)

수정 (commit `316f2e3`): Dockerfile CMD/HEALTHCHECK 를 `${PORT:-8000}` 사용하도록 변경. 푸시 후 30 초 만에 새 컨테이너 배포 → `https://twinverseai.twinverse.org/` HTTP 200 복구.

### 다음 세션 참고

- **Phase 0 #2 결정 필요**: `tools.elevated.allowFrom.webchat=["*"]` 어떻게 처리?
  - (a) `tools.elevated.enabled=false` — webchat elevated 완전 OFF
  - (b) sender ID 명시 — 첫 webchat 접속 후 device ID 추출
  - (c) `webchat: []` — webchat 채널만 차단, 다른 채널 유지
  - 단, `tools.elevated.allowFrom.webchat=["*"]` 이 부트스트랩 기본 템플릿에 하드코딩되어 있어 단순 `config set` 으로 안 통할 가능성 있음. 검증 필요.
- **Phase 0 #3 결정 필요**: 19개 작은 Ollama 모델 web 도구 정책. Steven 의도: "고성능 작업하는 모델들만 web 유지". 분류:
  - 유지 + sandbox=on 강제: `code-reviewer` (14b), `planner-a/b`, `dev-b`, `designer-a`, `ai-architect`, `debugger`, `devops`, `ue5-engineer`, `ceo-a` (실작업)
  - 제거: `bench-*` 8개, `testnpc1776519070405`
- **Phase 1 (Windows Node 셋업)**: Phase 0 정리 후 진행. 필요 입력값 — Steven Telegram chat ID, Windows 격리 사용자명.
- **백업**: `/srv/openclaw/data/backups/pre-phase0-20260429-131311.tar.gz` 보존.
- **TRAEFIK_HOST 사용 금지**: 우리 환경(wrapper Express + Cloudflare Tunnel 더블 프록시)에서는 절대 추가 금지. 보안 critical 은 다른 방식으로 — 백엔드를 controlUi 가 아닌 RPC 경로로 연결하거나 부트스트랩 패치 검토.
- **Phase 0 보안 critical 잔존**: 3 개 그대로 (`dangerouslyDisableDeviceAuth`, `tools.elevated.allowFrom.webchat=["*"]`, 19개 작은 Ollama 모델 web 도구). 새 접근 전략 필요.

---

## 2026-05-01 (DeskRPG 멀티유저 회귀 복구 + 재발방지)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | DeskRPG `tvdesk.twinverse.org` 멀티유저 회귀 복구 — proxy.js USER_MAP 갱신 | 완료 |
| infra | OpenClaw `agents.delete` 가 SIGUSR1 게이트웨이 재시작을 트리거한다는 사실 발견·문서화 | 완료 |
| docs | admin-openclaw-console.md 재시작 표 갱신 (agents.delete caveat) | 완료 |
| docs | DeskRPG USER_MAP 동기화 절차 메모리 신설 | 완료 |
| infra | infrastructure repo (orbitron-infrastructure) 에 proxy.js 변경 commit + push | 완료 |

### 세부 내용

- **증상 (사용자 보고)**:
  - Windows admin: chat 작동했다 안 했다 (캐시 token 만료 시 실패)
  - Linux limp2004 (twinverse-ai), Linux sodam2025hl (Orbitron): admin 콘솔 "AI 연결" 패널이 "게이트웨이 설정 로딩중..." 에서 멈춤, 같은 방의 다른 캐릭터 안 보임
  - DevTools: `WebSocket connection to wss://tvdesk.twinverse.org/socket.io/... failed: WebSocket is closed before the connection is established`

- **근본 원인**: `~/.deskrpg/proxy.js` 의 `USER_MAP` 이 stale.
  - 원래 `admintop` 키로 등록 (실제 TwinverseAI username 은 `admin` — 오타)
  - 새로 추가된 `sodam2025hl` 사용자 entry 누락
  - 매핑 못 찾으면 `token` 쿠키 주입을 silent skip → DeskRPG socket.io 가 인증 없는 upgrade 즉시 reject

- **인접 트리거 (양쪽 회귀가 시간 겹침)**:
  - 같은 시간대 OpenClaw 에 `agents.delete` RPC 가 호출됨 → `commands.ownerDisplay` 와 `plugins.entries.*.config` 변경을 동반 → SIGUSR1 → full process restart → 모든 chat WS 가 한꺼번에 끊김
  - 그래서 "Windows 도 갑자기 끊김 + 리눅스도 안 됨" 패닉 상황으로 보였음
  - admin-openclaw-console.md 재시작 표는 기존엔 `agents.create` 만 위험으로 표기 — 이번 인시던트 caveat 으로 갱신

- **수정 (3 단)**:
  1. `~/.deskrpg/proxy.js` 의 `USER_MAP` 을 `admin`/`limp2004`/`sodam2025hl` 정확 entry 로 교체. proxy 재시작.
  2. 누락 매핑 시 `console.error` 로 사용자명 + 현재 매핑 키 목록을 출력하도록 개선 (silent → loud, 다음 회귀 즉시 발견 가능).
  3. `~/WORK/infrastructure/deskrpg/proxy.js` 에 sync + commit `d1fd44a` (orbitron-infrastructure repo). 운영본만 고치고 끝낸 패턴이 다음 deploy 시 손실되는 걸 차단.

- **잘못된 가설 추적 기록 (학습용)**:
  - 처음에 IPv6 가설 → twinverse-ai 의 IPv6 라우트 비어있음을 발견했지만, curl 은 IPv4 fallback 정상이라 진짜 원인 X. `gai.conf` 와 `sysctl disable_ipv6` 시도 후 모두 revert.
  - 다음 가설은 OpenClaw 의 `client.id="openclaw-tui"` 하드코딩 충돌 → 그러나 git blame 결과 그 코드 이전부터 멀티유저 작동했다고 Steven 확인 → 가설 폐기.
  - Steven 의 결정적 단서 ("전에는 멀티유저 됐었다" + "다른 ID 로 로그인했는데 1인으로 인식") 가 USER_MAP 으로 좁혀준 핵심.

### 검증

- Windows admin / Linux limp2004 / Linux sodam2025hl 세 클라이언트 모두 Chrome 시크릿 창 새로 열어서 같은 방 입장 → 채팅 정상, 캐릭터 상호 표시 확인.
- proxy.log 에 `[proxy] Injected DeskRPG token for: admin -> Twinverse` 등 정상 로그 출력 확인.
- `git push` 로 `https://github.com/ChoonwooLim/orbitron-infrastructure` 에 영구 반영.

### 다음 세션 참고

- TwinverseAI 사용자 추가 시 `USER_MAP` 동기화 절차는 `memory/reference_deskrpg_user_map.md` 에 정리됨.
- OpenClaw 운영 중 `agents.delete` 사용 시 사용자 공지 + 새로고침 안내 권장 (단기). 장기적으론 백엔드 `chat_ws` 의 자동 재연결 로직 도입 검토.

---

## 2026-05-01 (이어서 — task-reporting timestamp + chat 마크다운/URL + IDENTITY 가드)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | DeskRPG `task-reporting.ts:274` `createdAt: nowIso()` → `new Date()` (PG timestamp 직렬화 에러 잔존분 해결) | 완료 |
| fix | OpenClaw chat (ChatTab.jsx) 마크다운 렌더링 + `/__openclaw__/*` 절대 URL 자동 변환 | 완료 (commit 13dd631) |
| infra | 17 개 OpenClaw 에이전트 IDENTITY.md 에 운영 가이드 append (절대 URL 강제 + 태스크 환각 차단) | 완료 (live) |
| docs | bugfix-log 에 task-reporting + ChatTab 두 회귀 기록 | 완료 |

### 세부 내용

- **task-reporting.ts createdAt fix**:
  - DeskRPG server.log 에 `[TaskManager] Error handling task action: TypeError: value.toISOString is not a function` 다수 잔존 — 4-24 fix 가 `task-manager.js` 만 패치하고 `task-reporting.ts` 누락
  - `buildQueuedReportRow` 가 `createdAt: nowIso()` (ISO string) 으로 row 생성 → PG `npcReports.createdAt` (timestamp 컬럼) insert 시 drizzle 이 `.toISOString()` 호출 → string 에 메서드 없음 → 에러
  - 라이브 (`~/.npm/_npx/8203af7a5561361c/.../task-reporting.ts`) + 소스 (`deskrpg-master/src/lib/task-reporting.ts`) 양쪽 적용. `start.sh` 로 DeskRPG 재시작 → 로그 깨끗
  - `deskrpg-master/` 는 TwinverseAI repo 의 gitignore 대상이라 별도 commit 없음. npm publish 재실행은 Steven 측 별도 절차

- **ChatTab.jsx 마크다운 + URL 변환**:
  - 사용자 보고: NPC 가 만든 PDF 링크가 plain text 로만 표시, 클릭 불가. 컨테이너 내부 경로 (`/data/.openclaw/workspace-myjini/reports/...`) 를 그대로 노출해 사용자 못 찾음
  - 라인 [173] 이 `<div>{message.content}</div>` plain text. `react-markdown` 은 설치돼 있는데 사용 안 함
  - 수정 (commit 13dd631):
    1. assistant 메시지를 `<ReactMarkdown>` 으로 래핑 (user 메시지는 plain text 유지)
    2. `resolveOpenClawHref` 가 `/__openclaw__/*` href 를 `https://openclaw.twinverse.org/__openclaw__/...` 로 자동 prepend
    3. 모든 링크에 `target=_blank rel=noopener noreferrer`
  - Orbitron 자동 재배포로 즉시 반영 (HTTP 200 검증)

- **17 개 IDENTITY.md 운영 가이드**:
  - 대상: main, code-reviewer, ceo-a, planner-a/b/e, dev-b, designer-a, ai-architect, debugger, devops, ue5-engineer, claude-max, codex-pro, marketer-a, myjini, testnpc... (bench-* 제외)
  - 추가 내용:
    - 태스크 등록은 사용자 명시 ("등록해줘") + 승인 카드 클릭 필수. "등록 완료" 환각 절대 금지
    - 파일 링크는 항상 `https://openclaw.twinverse.org/__openclaw__/canvas/...` 절대 URL. 컨테이너 내부 경로 노출 X
    - 한국어 응답 + KST 시간대 명시
  - 적용 위치: `/data/.openclaw/workspace-<id>/IDENTITY.md` 끝에 append. 백업 `*.bak.20260501-cli-fix` 보존
  - 라이브 적용. Git 추적 X (OpenClaw 컨테이너 내부 파일)

### 검증

- DeskRPG server.log: 재시작 후 TaskManager toISOString 에러 사라짐
- TwinverseAI 자동 재배포 후 `https://twinverseai.twinverse.org/` HTTP 200
- 빌드된 ChatTab 번들이 `react-markdown` 포함되어 배포되었는지는 사용자 강력 새로고침 후 실제 NPC 응답 클릭 테스트로 확정 (END 시점 미테스트)

### 다음 세션 참고

- **DeskRPG json:task 자동 승인 카드 (Option C)** — `task-block-utils.js` 의 `extractTaskBlocks` 가 payload 추출까지는 하는데 UI 미연결. NpcDialog/ChatPanel 에 카드 컴포넌트 + socket task:create 연동 추가하면 끝. 30~45 분 예상
- **DeskRPG 멀티유저 캐릭터 표시** — 오늘 USER_MAP fix 후 첫 검증은 됐으나 이후 캐릭터 broadcast 가 OpenClaw 게이트웨이 재시작·proxy 재시작 동안 어떻게 흘러가는지 추가 관찰 필요
- **ChatTab 사용자 검증 대기** — Ctrl+Shift+R 한 번 후 NPC 가 보낸 마크다운 링크 클릭 → 새 탭에서 PDF 열림 확인
- **deskrpg-master 의 npm publish 절차** — `task-reporting.ts` fix 가 라이브 + 로컬 소스에만 있고 npm package 재발행 안 됐음. 새로 npx cache 가 비워지면 fix 누락. 다음 release 절차에서 적용 필요
- **`[OpenClawGW] WebSocket error: 502`** 가 deskrpg server.log 에 다수 — 오늘 OpenClaw 컨테이너 추적 manipulation 영향. DeskRPG 측 retry/backoff 개선 검토

---

## 2026-05-01 (이어서 — task-reporting 추가 fix + 자가복구 socket 패턴 + deskrpg repo 신설)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| fix | `task-reporting.ts` 추가 2 군데 — `markReportDelivered:351` + `markReportConsumed:368` 의 `nowIso() as unknown as Date` → `new Date()` | 완료 (라이브 + deskrpg repo) |
| infra | `deskrpg-master/` 를 별도 GitHub repo (`ChoonwooLim/deskrpg`, private) 로 분리 — 영구 git 추적 확보 | 완료 |
| feat | DeskRPG socket 자가복구 (Layer 1+2): server bootId 발급 + auth-rejected emit + 클라 reconnectionAttempts 한정 + bootId mismatch 감지 시 자동 reload + auth flavored connect_error 시 쿠키 클리어 + reconnect_failed prompt | 완료 (라이브 + deskrpg repo `bae0be54`) |

### 세부 내용

- **task-reporting.ts 후속 fix**:
  - 첫 fix (`createdAt: nowIso()` → `new Date()`) 이후에도 server.log 에 `[task-reporting] Progress nudge failed` + `[task-reporting] Error marking report consumed` 잔존 → 같은 패턴이 2 군데 더 있었음:
    - line 351 `markReportDelivered`: `deliveredAt: nowIso() as unknown as Date`
    - line 368 `markReportConsumed`: `consumedAt: nowIso() as unknown as Date`
  - `as unknown as Date` 캐스트는 거짓말 — 런타임은 string 이라 drizzle 직렬화 시 동일 toISOString 에러
  - 양쪽 다 `new Date()` 로 변경. 이후 DeskRPG 재시작으로 server.log 깨끗.

- **`ChoonwooLim/deskrpg` repo 신설**:
  - 기존: `deskrpg-master/` 가 TwinverseAI `.gitignore` 대상이라 fix 가 라이브 + Windows 로컬에만 보존됨 → 영구성 X
  - 신규: `cd deskrpg-master && git init -b main && gh repo create ChoonwooLim/deskrpg --private --source=. --push`
  - 첫 commit 에 task-reporting.ts 3건 fix 모두 포함
  - 향후 hotfix 들이 이 repo 에 commit 으로 영구화

- **자가복구 socket 패턴 (Layer 1 + Layer 2)**:
  - **문제**: DeskRPG 재시작할 때마다 사용자 브라우저가 stale 쿠키·dead session 들고 무한 stuck 됨. 매번 수동으로 쿠키 삭제 / 시크릿 창 사용 필요.
  - **Layer 1 — 클라이언트 자가 진단**:
    - `reconnectionAttempts: Infinity` → `8` (한정해야 `reconnect_failed` 가 발화)
    - `connect_error` 핸들러 강화: `auth/token/unauthorized` 메시지 감지 → 쿠키 즉시 클리어
    - 새 `reconnect_failed` 핸들러: 8회 실패 시 `confirm()` 으로 새로고침 prompt
  - **Layer 2 — 서버 stamp + 클라 비교**:
    - 서버 (`socket-handlers.ts`) 가 시작 시 `SERVER_BOOT_ID` 생성, `connection` 마다 `socket.emit("server:hello", { bootId })` (인증 전)
    - 인증 거절 시 `socket.emit("auth:rejected", { reason })` 후 disconnect
    - 클라 (`GamePageClient.tsx`) 가 `server:hello` 수신 → localStorage 저장 → 다음 connect 시 비교 → 다르면 자동 `location.reload()`
    - `auth:rejected` 수신 시 쿠키 클리어 + `/auth` 리다이렉트
  - **적용**:
    - 서버측 `src/server/socket-handlers.ts` 라이브 직접 수정 (npm package 의 `files` 에 포함)
    - 클라이언트측 `src/app/game/GamePageClient.tsx` 는 `.next/` 빌드 산출물이라 `npm run build` 후 `.next/server/` + `.next/static/` 을 라이브 npx 캐시로 scp
    - DeskRPG 재시작으로 적용
    - deskrpg repo `commit bae0be54` push

### 검증

- 일반 Chrome 으로 tvdesk.twinverse.org 접속 후, DeskRPG `start.sh` 재시작 → 사용자 화면 변화 인지조차 못함 (socket.io transparent reconnect 가 처리, bootId 는 backup 으로 대기)
- 이전: stale 쿠키 → "게이트웨이 설정 로딩중..." 무한 stuck → 수동 쿠키 클리어 필요
- 이후: 자동 복구. 만약 socket.io 가 처리 못 하는 케이스 (token 진짜 만료 등) 면 bootId/auth-rejected 핸들러가 fallback 으로 자동 reload/redirect.

### 다음 세션 참고

- **DeskRPG json:task 자동 승인 카드 (Option C)** — 미적용. `extractTaskBlocks` 와 socket `task:create` 만 연결하면 끝.
- **deskrpg npm publish** — 오늘 fix 들이 `ChoonwooLim/deskrpg` repo 에는 들어갔지만 npm package 재발행 안 됨. 새 머신/캐시에서 재설치 시 fix 누락 위험. 다음 release 절차에 적용.
- **bootId reload 실제 발화 확인** — 이번 테스트에서 socket.io transparent reconnect 가 처리해서 bootId path 미발화. 진짜 stale auth 시나리오 (token 만료 등) 에서 발화 검증 필요.

---
