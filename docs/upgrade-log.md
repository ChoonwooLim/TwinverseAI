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
| 2026-04-06 | AI 스킬/플러그인 상세 페이지 (25개 스킬, 14개 플러그인 + JSON 데이터) | feat | AdminSkills.jsx, AdminPlugins.jsx, skills.json, plugins.json |
| 2026-04-06 | 프로젝트 문서 PostgreSQL 전환 (Document 모델 + DB 시드) | feat | models/document.py, routers/docs.py, main.py |
| 2026-04-06 | /init 스킬 전면 업그레이드 (동일 사이트 자동 생성, {{PROJECT_NAME}} 변수) | feat | .claude/skills/init/SKILL.md |
| 2026-04-06 | /end 스킬에 스킬/플러그인 자동 동기화 추가 | feat | .claude/skills/end/SKILL.md |
| 2026-04-06 | 게시판 샘플 게시글 자동 생성 (4종 x 5개) | feat | backend/main.py |
| 2026-04-06 | /code-review 스킬 신규 생성 (5차원 점검, P0-P3 등급 리포트) | feat | .claude/skills/code-review/SKILL.md |
| 2026-04-06 | 프론트엔드 성능 최적화 (React.lazy 코드 스플리팅, 폰트 최적화, Vite 청크 분리) | refactor | App.jsx, vite.config.js, index.html, global.css, MainLayout.jsx |
| 2026-04-06 | Cascade Delete + Pydantic Response Model 적용 | refactor | models/post.py, routers/boards.py |
| 2026-04-06 | 이미지 갤러리 전면 업그레이드 (썸네일 카드, 라이트박스, 샘플 이미지 5개) | feat | PostList.jsx, PostDetail.jsx, boards.py, main.py |
| 2026-04-06 | Orbitron.yaml 전면 업그레이드 (환경변수 8개, 헬스체크, 배포 체크리스트) | infra | Orbitron.yaml |
| 2026-04-06 | .dockerignore + Dockerfile ENV 기본값 배포 안전장치 | infra | .dockerignore, Dockerfile |
| 2026-04-06 | /health 엔드포인트 배포 진단 정보 추가 (uploads_dir, uploads_files) | feat | backend/main.py |
| 2026-04-06 | Vite 프록시 추가 (/api, /uploads, /health → backend 8000) | infra | frontend/vite.config.js |
| 2026-04-06 | /init 스킬 업로드/이미지 배포 안전장치 12개 섹션 추가 | docs | .claude/skills/init/SKILL.md |
| 2026-04-07 | Orbitron 서버 사양 문서 + 관리자 메뉴 추가 | feat | docs/orbitron-server.md, Sidebar.jsx, main.py |
| 2026-04-07 | /start /end 스킬에 Orbitron 서버 상태 확인/동기화 추가 | feat | .claude/skills/start/SKILL.md, .claude/skills/end/SKILL.md |
| 2026-04-07 | Orbitron nvidia-container-toolkit 설치 (Docker GPU Runtime) | infra | 서버 설정 |
| 2026-04-07 | TwinverseDesk UE5 C++ 프로젝트 초기화 + GitHub 리포 생성 | feat | C:\WORK\TwinverseDesk (별도 리포) |
| 2026-04-07 | TwinverseDesk Dedicated Server 타겟 + Pixel Streaming 패키징 설정 | infra | TwinverseDeskServer.Target.cs, DefaultGame.ini, DefaultEngine.ini |
| 2026-04-08 | Claude Code 최근정보 시스템 (ClaudeNews DB + API + AdminNews 페이지) | feat | models/news.py, routers/news.py, AdminNews.jsx |
| 2026-04-08 | /ultraplan 스킬 신규 생성 (멀티 에이전트 심층 계획 수립, 4-Phase) | feat | .claude/skills/ultraplan/SKILL.md |
| 2026-04-08 | 프로젝트 비전 페이지 — 시네마틱 디자인 (별빛 파티클, 스크롤 reveal, 3D 목업) | feat | VisionPage.jsx, VisionPage.module.css |
| 2026-04-08 | 프로젝트 비전 문서 + CLAUDE.md 최상위 방침 추가 | docs | docs/vision.md, CLAUDE.md |
| 2026-04-09 | Claw Code 분석 페이지 (Rust 재구현 CLI 정밀 분석 보고서, 10개 섹션) | feat | AdminClawCode.jsx, AdminClawCode.module.css |
| 2026-04-09 | Claude Code 공식 레포 분석 페이지 (Anthropic 공식 CLI 정밀 분석 보고서, 10개 섹션) | feat | AdminClaudeCodeRepo.jsx, AdminClaudeCodeRepo.module.css |
| 2026-04-09 | 프론트엔드 npm run dev 시 백엔드 자동 실행 (concurrently 패키지) | feat | frontend/package.json |
| 2026-04-09 | Phase 1 보안 강화 + Alembic DB 마이그레이션 + TVDeskRun PS2 스트리밍 연동 | feat | backend/ |
| 2026-04-09 | PS2 Spawner — 유저별 독립 UE5 인스턴스 자동 생성/관리 (6+4 API) | feat | ps2_service.py, ps2_spawner.py, ps2_session.py |
| 2026-04-09 | PS2 외부 접근 — Cloudflare Tunnel + GPU 서버 통합 | feat | ps2_spawner.py, ps2api.js |
| 2026-04-09 | PS2 서버/패키지 빌드 자동 감지 + 서버 자동 시작 | feat | ps2_service.py |
| 2026-04-09 | DeskLaunch UI — Pixel Streaming 2 실행 + 멀티 레벨 선택 (썸네일 카드) | feat | DeskLaunch.jsx, DeskLaunch.module.css |
| 2026-04-09 | UE5 GameInstance 맵 오버라이드 (-MapOverride CLI → OpenLevel) | feat | TwinverseDeskGameInstance.cpp/h |
| 2026-04-09 | 어드민 Unreal Engine 문서 섹션 (5개 기술 문서 + 사이드바 메뉴) | feat | docs/ue-*.md, Sidebar.jsx, main.py |
