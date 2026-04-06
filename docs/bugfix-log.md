# 버그수정 로그

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

| 날짜 | 버그 설명 | 원인 | 수정 내용 | 관련 파일 |
|------|----------|------|----------|----------|
| 2026-04-04 | 로그인 후 다시 로그인 화면 표시 | 401 인터셉터가 로그인 API 응답까지 토큰 삭제 처리 | 인터셉터에서 auth 경로 제외 + ProtectedRoute 로직 개선 | frontend/src/services/api.js, ProtectedRoute.jsx |
| 2026-04-04 | JWT 토큰 디코드 실패 | python-jose가 sub 클레임을 문자열로 기대하는데 정수 전달 | create_access_token에서 sub를 str()로 변환 | backend/services/auth_service.py, backend/routers/auth.py |
| 2026-04-05 | TVDesk NPC 호출/대화 "연결끊김" | DeskRPG 쿠키 Secure 플래그 → Cloudflare Tunnel 내부 HTTP에서 브라우저가 쿠키 저장 거부 | COOKIE_SECURE=false 환경변수 설정 | 서버: ~/.deskrpg/start.sh |
| 2026-04-05 | 리눅스 브라우저 소켓 인증 실패 | DeskRPG token 쿠키 미설정, twinverse_token만 존재 | 프록시에서 twinverse_token → DeskRPG JWT 자동 변환/주입 | 서버: ~/.deskrpg/proxy.js |
| 2026-04-06 | Docker 배포 시 프로젝트 문서 404 | Path(__file__).parent.parent.parent가 Docker에서 /docs로 해석 | DOCS_DIR 환경변수 + 자동 탐색 로직, 이후 PostgreSQL 기반으로 전면 전환 | backend/routers/docs.py, backend/models/document.py, backend/main.py |
| 2026-04-06 | 갤러리 이미지 배포 404 (1차) | .gitignore에 uploads/ → Docker 빌드 시 COPY 실패 → 502 | .gitignore에서 gallery-*.jpg 예외 처리 + git add -f | .gitignore, uploads/gallery-*.jpg |
| 2026-04-06 | 갤러리 이미지 배포 404 (2차) | Docker VOLUME /app/uploads가 빈 볼륨으로 마운트 → COPY한 이미지 덮어씀 | gallery_defaults/를 backend/ 내부에 포함, 시작 시 uploads로 복사 | backend/gallery_defaults/, backend/main.py, Dockerfile |
| 2026-04-06 | UPLOAD_DIR 빈 문자열로 CWD 해석 | Orbitron이 UPLOAD_DIR=""로 override → Path("")=CWD(.) → 소스 폴더를 uploads로 착각 | .strip() 후 빈 문자열이면 fallback 경로 사용 | backend/main.py, backend/routers/files.py |
| 2026-04-06 | StaticFiles mount Docker VOLUME 충돌 | StaticFiles mount가 VOLUME 마운트된 빈 디렉토리 참조 → 파일 미검색 | StaticFiles mount 제거 → 명시적 @app.get("/uploads/{filename}") 라우트 사용 | backend/main.py |
| 2026-04-06 | 로컬 갤러리 이미지 깨짐 | Vite 프록시 미설정 → img src="/uploads/..." 요청이 SPA HTML(text/html) 반환 | vite.config.js에 /api, /uploads, /health 프록시 추가 | frontend/vite.config.js |
