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
| 2026-04-09 | TVDeskRun 2D 가상오피스 페이지 사라짐 | PS2 DeskLaunch로 덮어씀 | TVDeskRun 원래 페이지 복원, DeskLaunch 별도 라우트 | TVDeskRun.jsx, DeskLaunch.jsx |
| 2026-04-09 | subprocess.CREATE_NEW_PROCESS_GROUP Linux 오류 | Windows 전용 플래그를 Linux에서 사용 | os.name 체크로 Windows 전용 분기 | ps2_service.py |
| 2026-04-09 | PS2 API URL 프로덕션 빌드 미반영 | .env.production 미설정 | .env.production 추가 + fallback 하드코딩 | .env.production, ps2api.js |
| 2026-04-09 | 맵 선택해도 같은 맵 로딩 (UE5 패키지 빌드) | 패키지 빌드가 positional map arg, ExecCmds 무시 | GameInstance::OnStart()에서 -MapOverride 파싱 → OpenLevel() | TwinverseDeskGameInstance.cpp |
| 2026-04-09 | spawn이 기존 세션 반환 (다른 맵인데도) | spawn_session idempotent 로직이 맵 비교 안 함 | PS2Session에 map_path 필드 추가, 맵 다르면 기존 종료 후 재생성 | ps2_service.py, ps2_session.py |
| 2026-04-09 | PCG 이주 레벨에서 클래식카 로드 불가 | ChaosVehiclesPlugin 미활성화 + 에셋 폴더 누락 | .uproject에 ChaosVehiclesPlugin + PCG 플러그인 5종 추가 | TwinverseDesk.uproject |
| 2026-04-09 | ABP_Dashboard 컴파일 에러 (VehicleMovementComponent) | Parent Class가 AnimInstance여서 차량 함수 없음 | Parent Class → VehicleAnimationInstance + Cast 노드 재생성 | ABP_Dashboard.uasset |
| 2026-04-09 | UE5 패키징 실패 C4458 | 로컬 변수 Mesh가 ACharacter::Mesh 멤버 숨김 | Mesh → CharMesh로 변수명 변경 | OfficeCharacter.cpp, OfficeNPC.cpp |
| 2026-04-10 | Orbitron 배포 시 크래시 루프 | lifespan 시작 작업 중 하나 실패 시 컨테이너 전체 종료, 재시작 반복 | 모든 시작 작업 try-catch로 감싸 개별 실패에도 서버 기동 + Dockerfile에 SECRET_KEY/DATABASE_URL 기본값 + HEALTHCHECK | Dockerfile, backend/main.py, backend/database.py |
| 2026-04-10 | DeskLaunch "플랫폼 연결오류" — 브라우저 CORS 에러로 보임 | GPU PC 백엔드가 .env의 한글 주석 때문에 기동 실패. slowapi Limiter가 starlette Config로 .env 로드 시 Windows 기본 cp949로 읽어 UnicodeDecodeError → uvicorn 크래시 → 서버 응답 없음 → preflight 실패를 브라우저가 CORS 오류로 표시. Cloudflare Tunnel은 정상(502 반환), CORS 코드도 이미 정상. 근본 원인은 서버 프로세스 사망 | (1) backend/.env의 한글 주석 2줄 제거(.env 규칙 위반이기도 함) (2) scripts/start_gpu_server.bat uvicorn 실행 전 `set PYTHONUTF8=1` 추가 — 앞으로 UTF-8 바이트 다시 들어와도 Python 전역 UTF-8 모드로 안전 | backend/.env, scripts/start_gpu_server.bat |
| 2026-04-10 | DeskLaunch "Invalid token" 401 — CORS 해결 직후 | 브라우저 localStorage의 JWT가 과거 SECRET_KEY 시기(ef6784c 이전)에 발급됐거나 8시간 만료. Orbitron/GPU PC 양쪽 SECRET_KEY 동일(`orbitron-twinverseai-secret-key-2026`) 확인, Orbitron이 방금 발급한 토큰은 GPU PC 로컬/터널 양쪽 HTTP 200. 단순 stale token. 재발 방지: ps2api.js에 response interceptor 부재 → 401 와도 자동 로그아웃 없음 (api.js에만 존재) | frontend/src/services/ps2api.js에 api.js와 동일한 401 interceptor 추가 (localStorage clear + /login 리다이렉트). 사용자는 로그아웃/재로그인으로 즉시 해결 | frontend/src/services/ps2api.js |
