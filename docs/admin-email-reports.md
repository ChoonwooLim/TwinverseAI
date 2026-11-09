# 이메일 보고서

관리자는 `/admin/email-reports`에서 날짜별 메일 요약과 조치 필요 항목을 확인할 수 있다. 화면과 조회 API는 기존 관리자 JWT 권한이 필요하다.

## 수집 API

- 주소: `POST /api/email-reports/ingest`
- 인증: `Authorization: Bearer <EMAIL_REPORT_INGEST_TOKEN>`
- 멱등 기준: `reportDate`와 `reportKey` 조합
- 환경변수: `EMAIL_REPORT_INGEST_TOKEN`에 16자 이상의 충분히 무작위인 별도 토큰을 설정한다.

수집 스키마는 계정별 건수, 제목·발신자·요약, 정리 결과와 생성 메타데이터만 허용한다. 메일 본문, 원문, 첨부파일, 쿠키, 비밀번호, API 키 및 인증 토큰 필드는 검증 단계에서 거부한다. 실제 토큰 값은 저장소나 문서에 기록하지 않는다.

관리자 API는 `GET /api/admin/email-reports`와 `GET /api/admin/email-reports/{id}`이다.
