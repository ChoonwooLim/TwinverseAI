# 이메일 보고서

관리자는 `/admin/email-reports`에서 날짜별 메일 요약과 조치 필요 항목을 확인할 수 있다. 화면과 조회 API는 기존 관리자 JWT 권한이 필요하다.

## 수집 API

- 주소: `POST /api/email-reports/ingest`
- 인증: `Authorization: Bearer <EMAIL_REPORT_INGEST_TOKEN>`
- 멱등 기준: `reportDate`와 `reportKey` 조합
- 환경변수: `EMAIL_REPORT_INGEST_TOKEN`에 16자 이상의 충분히 무작위인 별도 토큰을 설정한다.

수집 스키마는 계정별 건수, 제목·발신자·수신 시각·내용 기반 요약·중요도 근거·권장 조치, 정리 결과와 생성 메타데이터만 허용한다. 원본 바로가기를 위해 선택적으로 Gmail `X-GM-THRID`의 10진수 값(`sourceThreadId`)만 받으며 `sourceUrl` 같은 임의 URL 필드는 검증 단계에서 거부한다. 메일 본문, 원문, 첨부파일, 쿠키, 비밀번호, API 키 및 인증 토큰 필드도 받지 않는다. 실제 토큰 값은 저장소나 문서에 기록하지 않는다. 구형 수집기는 새 항목 필드를 생략해도 계속 사용할 수 있으며, 항목 식별자가 없는 과거 보고서에는 조회 시 안정적인 호환 식별자가 부여된다.

각 보고서 항목의 **원본 메일 열기**는 새 창에서 메일 공급자가 소유한 고정 주소만 연다. Gmail 항목은 유효한 `sourceThreadId`가 있으면 기존처럼 정확한 원본 스레드로 이동하고, 없으면 제목과 발신자로 Gmail 검색을 연다. 계정 주소가 `@naver.com`이면 `sourceThreadId`를 사용하지 않고 제목과 발신자로 네이버 메일 검색 화면을 연다. 링크는 서버에서 받거나 저장하지 않고 프론트엔드가 계정·제목·발신자와 검증된 Gmail 스레드 ID만으로 구성한다. 원문과 로그인 정보는 TwinverseAI 서버를 통과하거나 저장되지 않는다.

관리자 API는 `GET /api/admin/email-reports`와 `GET /api/admin/email-reports/{id}`이다. 상세 응답은 즉시 처리, 검토, 자동화 후보 집계와 항목별 저장 결정, 그리고 각 결정의 메일함 실행 현황(`executionCounts`, 결정별 `status`/`action`/`attempts`/`errorCode`/`errorMessage`/`executedAt`)을 함께 반환한다.

## 일일 보관과 신규 메일 요약

보고서는 날짜별로 독립 보관한다. 같은 `reportDate`와 같은 `reportKey`를 다시 수집하면 해당 일일 보고서만 갱신하며, `reportKey`가 같아도 날짜가 다르면 새 보고서로 저장되어 이전 날짜를 덮어쓰지 않는다. 관리자 목록은 조회 API의 최신순 응답을 연도와 월로 묶어 지난 일일 보고서를 찾기 쉽게 표시한다.

상세 화면 상단의 문서형 요약은 서버 HTML을 사용하지 않고 기존 구조화 필드만 React 텍스트로 렌더링한다. `receivedAt`을 서울 시각 날짜로 변환해 `reportDate`와 같은 긴급·중요 항목을 새 메일로 판단한다. 수신시각이 없는 구형 긴급·중요 항목은 누락하지 않고 `수신시각 확인 필요`로 표시한다. 참고, 광고, 자동 삭제 후보는 핵심 검토 목록에서 제외하고 건수만 짧게 알린다. 전체 상세 항목과 기존 의사결정 기능은 문서 아래에 그대로 제공된다.

## 판단 저장 API

- `POST /api/admin/email-reports/{id}/decisions`: 항목별 판단을 일괄 저장하거나 갱신한다.
- `DELETE /api/admin/email-reports/{id}/decisions?itemId=...`: 저장된 판단을 취소한다. 슬래시가 없는 식별자를 쓰는 기존 클라이언트를 위해 경로 매개변수 형식도 계속 지원한다.
- 판단 값: 보존, 삭제함 이동, 같은 유형 자동 삭제, 같은 유형 항상 보존, 자동 보관, 나중 결정.

판단 요청은 정해진 항목 식별자와 판단 값만 허용하며 자유 입력 메모는 받지 않는다. 저장된 판단은 바로 실행 대기열(`status=pending`)에 들어가며, 외부 실행 작업자(OpenClaw)가 바로 아래 설명된 워커 API를 통해 가져가 실제 메일함에 적용한다. 같은 항목에 대해 결정을 다른 값으로 저장하면 실행 이력(시도 횟수, 오류, 완료 시각, 리스)이 모두 초기화되어 새 결정으로 재실행된다. `나중 결정`은 메일함을 바꾸지 않으므로 `status=not_applicable` 상태가 된다.

## 판단 → 메일함 작업 매핑

| 결정 | `action` | 메일함에서의 동작 |
|---|---|---|
| `keep`, `always_keep_similar` | `archive` | 받은편지함 밖으로 보관(아카이브). 이미 밖에 있으면 작업자가 안전하게 no-op 처리 |
| `auto_archive` | `archive` | 받은편지함 밖으로 보관(아카이브) |
| `trash`, `auto_trash_similar` | `trash` | 메일함의 **삭제함(휴지통)**으로 이동. 영구 삭제하지 않으며 메일함의 삭제함에서 복구 가능 |
| `decide_later` | `noop` | 메일함을 건드리지 않음 (`status=not_applicable`) |

`같은 유형 자동 삭제`와 `같은 유형 항상 보존`은 당장 저장하는 결정 자체는 **현재 메일 한 건**을 대상으로 한다(`같은 유형`에 대한 자동 규칙은 작업자/추가 시스템에서 별도로 처리하는 범위다). `auto_trash_similar`에서도 영구 삭제는 절대 수행하지 않고 삭제함 이동만 한다.

## 실행 워커 API (`OpenClaw` 전용)

실제 메일함 조작은 TwinverseAI 서버 밖의 신뢰된 외부 작업자(OpenClaw)가 수행한다. 이 서버는 IMAP/Gmail 인증 정보를 보관하거나 전달하지 않으며, 다음 두 엔드포인트를 통해 결정 대기열만 노출한다.

- 인증: `Authorization: Bearer <EMAIL_REPORT_EXECUTION_TOKEN>`
  - `EMAIL_REPORT_EXECUTION_TOKEN`이 비어있으면 `EMAIL_REPORT_INGEST_TOKEN`으로 대체. 둘 다 16자 미만이면 두 워커 엔드포인트는 503을 반환한다.
  - 관리자 JWT로는 접근 불가. 토큰 비교는 `secrets.compare_digest`로 상시 시간 일정.

### `POST /api/email-reports/execution/claim`

대기 중이거나 임대(lease)가 만료된 결정 중 최대 `limit` 건을 원자적으로 임대한다.

요청 (JSON):
```json
{
  "limit": 20,
  "leaseSeconds": 300,
  "workerId": "openclaw-worker-01"
}
```
- `limit`: 1–100
- `leaseSeconds`: 10–1800
- `workerId`: 선택, 공백 또는 `[A-Za-z0-9._:-]{,120}`

응답:
```json
{
  "items": [
    {
      "decisionId": 42,
      "reportId": 7,
      "itemId": "i2",
      "action": "trash",
      "attempts": 1,
      "leaseToken": "....",
      "leaseExpiresAt": "2026-11-10T13:00:00+00:00",
      "message": {
        "account": "owner@example.com",
        "sender": "newsletter@example.com",
        "subject": "뉴스레터 확인",
        "receivedAt": "2026-11-09T07:00:00+09:00",
        "sourceThreadId": null
      }
    }
  ],
  "leaseSeconds": 300,
  "serverTime": "2026-11-10T12:55:00+00:00"
}
```

응답의 `message` 필드는 대상 메일을 **지정하는 데 필요한 최소 메타데이터만** 담는다. 본문, 요약, 분류 근거, 리스크 태그, 권장 조치, 메모, 인증 정보는 포함되지 않는다. 임대 토큰은 랜덤 32바이트 URL-safe 문자열이며, 임대가 끝나기 전에 `/ack` 하지 않으면 해당 결정은 자동으로 다시 대기열에 복귀한다.

### `POST /api/email-reports/execution/ack`

작업자가 결정 한 건의 메일함 작업 결과를 돌려준다.

요청 (JSON):
```json
{
  "decisionId": 42,
  "leaseToken": "....",
  "status": "succeeded",
  "errorCode": "imap_timeout",
  "errorMessage": "connection timed out"
}
```
- `status`: `succeeded` 또는 `failed`
- `leaseToken`: `/claim` 응답에서 받은 값. 다른 토큰으로의 ack은 거부
- `errorCode`: 선택, `[A-Za-z0-9_.:-]{,64}`
- `errorMessage`: 선택, 최대 500자. 비밀값으로 보이는 패턴은 수집 단계와 동일하게 거부

동작:
- `succeeded`: 결정이 `succeeded`로 종결되며 `executedAt`이 기록된다. 같은 `leaseToken`으로의 재호출은 idempotent (200 OK).
- `failed`: 시도 횟수가 `MAX_EXECUTION_ATTEMPTS = 5` 미만이면 결정은 `pending`으로 되돌아가 다음 claim 사이클에서 다시 시도된다. 시도 횟수가 상한에 도달하면 `failed`로 종결되며 이후 `/claim`에 포함되지 않는다.
- 이미 종결된 결정이나 만료된 임대로 ack하면 409를 반환한다.
- `/ack`는 결정 상태만 변경하며, 관리자 결정 자체는 재저장 전까지 `trash`→`keep`처럼 바뀌지 않는다. 관리자가 재저장하면 실행 이력이 초기화되어 작업자가 다시 가져간다.

## 환경변수

| 변수 | 용도 |
|---|---|
| `EMAIL_REPORT_INGEST_TOKEN` | 일일 보고서 수집기 인증 토큰 (16자 이상) |
| `EMAIL_REPORT_EXECUTION_TOKEN` | 실행 워커 전용 토큰. 비워두면 `EMAIL_REPORT_INGEST_TOKEN`으로 fallback (16자 이상) |

TwinverseAI 서버는 어떤 경우에도 메일함 자격 증명을 보관하거나 전달하지 않는다. 실제 메일함 접근은 OpenClaw 쪽에서 수행하며 이 저장소는 그 결과만 돌려받는다.
