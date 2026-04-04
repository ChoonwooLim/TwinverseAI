# 버그수정 로그

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

| 날짜 | 버그 설명 | 원인 | 수정 내용 | 관련 파일 |
|------|----------|------|----------|----------|
| 2026-04-04 | 로그인 후 다시 로그인 화면 표시 | 401 인터셉터가 로그인 API 응답까지 토큰 삭제 처리 | 인터셉터에서 auth 경로 제외 + ProtectedRoute 로직 개선 | frontend/src/services/api.js, ProtectedRoute.jsx |
| 2026-04-04 | JWT 토큰 디코드 실패 | python-jose가 sub 클레임을 문자열로 기대하는데 정수 전달 | create_access_token에서 sub를 str()로 변환 | backend/services/auth_service.py, backend/routers/auth.py |
| 2026-04-05 | TVDesk NPC 호출/대화 "연결끊김" | DeskRPG 쿠키 Secure 플래그 → Cloudflare Tunnel 내부 HTTP에서 브라우저가 쿠키 저장 거부 | COOKIE_SECURE=false 환경변수 설정 | 서버: ~/.deskrpg/start.sh |
| 2026-04-05 | 리눅스 브라우저 소켓 인증 실패 | DeskRPG token 쿠키 미설정, twinverse_token만 존재 | 프록시에서 twinverse_token → DeskRPG JWT 자동 변환/주입 | 서버: ~/.deskrpg/proxy.js |
