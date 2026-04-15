# Orbitron Pixel Streaming 플랫폼 설계

- **작성일**: 2026-04-15
- **작성자**: Steven Lim + Claude (brainstorming 세션)
- **대상 구현자**: Orbitron 플랫폼 개발자
- **관련 프로젝트**: TwinverseAI · TwinverseDesk · TwinversePS2-Deploy (폐기 예정)

## 1. 배경 & 목적

### 현재 구조의 문제

- UE5 Linux 패키지를 배포하려고 `TwinversePS2-Deploy` GitHub repo 를 경유 (git-LFS 8GB+).
- GitHub LFS 는 단일 파일 2GB 하드 리밋이라 청크 분할 강제, 업로드 느림, 유료 플랜 의존.
- 향후 Orbitron 이 **유료 SaaS 로 전환**되면 타 사용자가 본인 UE5 빌드를 업로드해야 하는데 GitHub 경유는 비현실적.
- 프로젝트마다 별도 Orbitron 프로젝트 생성 필요 — 단일 앱에 여러 스트리밍 슬롯을 두는 구조로 리팩터 필요.

### 이 설계의 목적

Orbitron 플랫폼에 **Pixel Streaming 배포 기능을 일급 시민으로 내장**. 사용자는 대시보드에서 UE5 패키지 zip 을 직접 업로드하면 Orbitron 이 자동으로 이미지 빌드 · GPU 호스트로 배포 · 서브도메인 할당 · 온디맨드 기동까지 수행한다.

### 스코프 (Phase B, 이 스펙의 대상)

- **대상 프로젝트**: TwinverseAI 1개 (관리자 = Steven 1인).
- **슬롯 다중화**: 한 프로젝트 안에 여러 스트리밍 슬롯(예: `office`, `pcg-study`, `demo`).
- **업로드 포맷**: UE5 `Package/Linux/` 폴더를 zip 으로 묶은 것 (Docker 지식 불필요).
- **URL 전략**: 슬롯당 서브도메인 — `<slot>.ps.twinverse.org`.
- **컨테이너 생명주기**: On-demand (평소 stop, Play 클릭 시 기동, 유휴 자동 stop).
- **버전 관리**: 슬롯당 최근 3개 버전 보관 + 원클릭 롤백.
- **배포 트리거**: 업로드 완료 시 자동 배포.

### 스코프 외 (Phase C — 별도 스펙)

- 타 Orbitron 프로젝트로 확장 (멀티테넌트).
- GPU/스토리지 쿼터, 과금 훅.
- Pinned(상시) 컨테이너 옵션.
- 커스텀 도메인 매핑.
- 공유 Docker 레지스트리.

Phase B 스키마는 `owner_user_id` / `tenant_id` / `pinned` 컬럼을 미리 포함해 스키마 변경 없이 Phase C 진입 가능하도록 한다.

## 2. 아키텍처

```
                       ┌──────────────────────┐
 사용자 브라우저       │  TwinverseAI 랜딩    │
 (twinverse.org)──────▶│  /pixel-streaming    │
                       │  메뉴: 슬롯 카드     │
                       └──────────┬───────────┘
                                  │ fetch slots (public API)
                                  ▼
                       ┌──────────────────────┐
                       │  Orbitron (4000)     │
                       │  • Slot CRUD API     │
                       │  • tus 업로드        │
                       │  • 압축 해제·검증    │
                       │  • Docker 이미지 빌드│
                       │  • 버전 심볼릭 링크  │
                       │  • Cloudflare DNS    │
                       │  • on-demand 제어    │
                       │  • 유휴 감지 (30s)   │
                       └──────┬──────┬────────┘
                  ssh+docker  │      │ cloudflared reload
                              ▼      ▼
                       ┌──────────────────────┐
                       │  twinverse-ai (117)  │
                       │  RTX 3090 + Docker   │
                       │  슬롯별 컨테이너     │
                       │  (NVIDIA runtime)    │
                       └──────────────────────┘

 Cloudflare Tunnel ingress (Orbitron 자동 관리):
   office.ps.twinverse.org    → twinverse-ai:8081
   pcg-study.ps.twinverse.org → twinverse-ai:8082
   ... (슬롯 생성 시 자동 추가)
```

## 3. 데이터 모델

### PG 신규 테이블

```sql
CREATE TABLE ps_slots (
    id              SERIAL PRIMARY KEY,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(50) NOT NULL,              -- URL slug: 'office'
    display_name    VARCHAR(100) NOT NULL,             -- 메뉴 표시명: 'Office Metaverse'
    description     TEXT DEFAULT '',
    thumbnail_url   VARCHAR(500),
    subdomain       VARCHAR(150) UNIQUE NOT NULL,      -- 'office.ps.twinverse.org'
    container_port  INTEGER NOT NULL UNIQUE,           -- 8081, 8082, ...
    active_version  INTEGER REFERENCES ps_versions(id) DEFERRABLE INITIALLY DEFERRED,
    state           VARCHAR(20) DEFAULT 'draft',       -- draft|running|stopped|error
    idle_timeout_s  INTEGER DEFAULT 600,
    -- Phase C 확장용 (Phase B 에서는 NULL 허용, 권한 체크에 사용 안 함)
    owner_user_id   INTEGER REFERENCES users(id),
    tenant_id       INTEGER,
    pinned          BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE (project_id, name)
);

CREATE TABLE ps_versions (
    id              SERIAL PRIMARY KEY,
    slot_id         INTEGER NOT NULL REFERENCES ps_slots(id) ON DELETE CASCADE,
    version_label   VARCHAR(50) NOT NULL,              -- 'v1', 'v2' ... 슬롯 내 순번
    upload_size_b   BIGINT NOT NULL,
    image_tag       VARCHAR(200),                      -- 'twinverse/ps-<slot>:v<N>'
    build_status    VARCHAR(20) DEFAULT 'uploading',   -- uploading|extracting|building|ready|failed
    build_log       TEXT,                              -- 빌드 stdout/stderr 저장
    uploaded_at     TIMESTAMP DEFAULT NOW(),
    uploaded_by     INTEGER REFERENCES users(id),
    UNIQUE (slot_id, version_label)
);

CREATE INDEX idx_ps_slots_project ON ps_slots(project_id);
CREATE INDEX idx_ps_versions_slot ON ps_versions(slot_id);
```

### 파일 시스템 (Orbitron)

```
/srv/pixelstreaming/
└── <project_slug>/                    # 'twinverseai'
    └── <slot_name>/                   # 'office'
        ├── versions/
        │   ├── v1/
        │   │   ├── upload.zip         # 원본 (추출 후 삭제 가능)
        │   │   └── Package/
        │   │       └── Linux/<Game>/Binaries/Linux/<Game>-Linux-Shipping
        │   │       └── Linux/<Game>/Content/Paks/*.ucas
        │   ├── v2/
        │   └── v3/                    # N=3 롤백 윈도우
        └── current -> versions/vN     # 심볼릭 링크 (원자적 교체 = 롤백)
```

### 파일 시스템 (twinverse-ai)

```
/opt/ps-slots/
└── <slot_name>/
    ├── current/                       # Orbitron 에서 rsync 된 활성 버전
    │   └── Package/Linux/...
    └── docker-compose.yml             # Orbitron 이 템플릿 렌더링해서 푸시
```

## 4. API 계약

모든 엔드포인트는 Orbitron 기존 JWT 인증 재사용 (admin 역할 이상). 공개 엔드포인트(`/api/public/...`) 만 인증 없이 접근 가능.

### 슬롯 CRUD

```
GET    /api/projects/:projectId/ps-slots
POST   /api/projects/:projectId/ps-slots
PATCH  /api/projects/:projectId/ps-slots/:slotId
DELETE /api/projects/:projectId/ps-slots/:slotId
```

`POST` 시 서버 책임:
- `subdomain` 자동 할당 (`<name>.ps.twinverse.org`).
- `container_port` 8081~8999 범위에서 미사용 포트 자동 배정.
- Cloudflare API 로 CNAME 레코드 생성.
- cloudflared ingress 설정에 규칙 추가 후 SIGHUP.

`DELETE` 시 서버 책임:
- 컨테이너 stop + rm.
- Docker 이미지 제거.
- Cloudflare DNS 레코드 삭제 + ingress 규칙 제거.
- `/srv/pixelstreaming/.../slots/<name>/` 전체 삭제.

### 업로드 (tus.io 프로토콜)

```
POST   /api/projects/:projectId/ps-slots/:slotId/upload/initiate
       → {upload_id, upload_url, chunk_size}

PATCH  /api/uploads/:uploadId                         (tus 표준)
       headers: Upload-Offset, Content-Type: application/offset+octet-stream

POST   /api/uploads/:uploadId/finalize
       → {version_id, build_status: 'building'}
       (이후 배포 파이프라인 자동 실행)

GET    /api/projects/:projectId/ps-slots/:slotId/versions/:versionId/build-log
       → SSE stream: 압축해제, Docker 빌드, 이미지 전송, 심볼릭 교체 진행 상황
```

Node.js 구현: `tus-node-server` 라이브러리.

### 버전 & 롤백

```
GET    /api/projects/:projectId/ps-slots/:slotId/versions
POST   /api/projects/:projectId/ps-slots/:slotId/versions/:versionId/activate  # 롤백
DELETE /api/projects/:projectId/ps-slots/:slotId/versions/:versionId           # 활성 버전은 거부
```

### 런타임 제어 (on-demand)

```
POST   /api/projects/:projectId/ps-slots/:slotId/start
       → {ready, stream_url, estimated_ready_in_s}

POST   /api/projects/:projectId/ps-slots/:slotId/stop
GET    /api/projects/:projectId/ps-slots/:slotId/status
       → {state, current_session_count, gpu_memory_mb, last_activity_at}
```

### 공개 API (랜딩페이지용)

```
GET    /api/public/projects/:projectSlug/ps-slots
       → [{name, display_name, description, thumbnail_url, subdomain}]
```

Rate limit: 60 req/min per IP.

## 5. 배포 오케스트레이션

### 업로드 → 활성화 파이프라인

```
[A] tus finalize
 │
 ├─▶ /srv/pixelstreaming/<proj>/<slot>/versions/v<N>/upload.zip 저장
 │
[B] 압축 해제 (build_status='extracting')
 │   - versions/v<N>/Package/ 로 unzip
 │   - path traversal 차단 ('..' 거부)
 │   - 필수 파일 검증:
 │       * Package/Linux/<Game>/Binaries/Linux/<Game>-Linux-Shipping
 │       * Package/Linux/<Game>/Content/Paks/*.ucas (최소 1개)
 │   - 실패 → build_status='failed', SSE 에러 로그, UI 알림
 │
[C] Docker 이미지 빌드 (build_status='building')
 │   - 템플릿: /opt/orbitron/templates/pixel-streaming/Dockerfile
 │   - build context = versions/v<N>/Package/
 │   - tag: twinverse/ps-<slot>:v<N>
 │   - stdout/stderr → ps_versions.build_log + SSE 실시간 전송
 │
[D] 이미지 전송 → twinverse-ai
 │   Phase B: docker save <tag> | ssh twinverse-ai docker load
 │   Phase C: 로컬 레지스트리 push + pull
 │
[E] twinverse-ai 슬롯 설정 갱신
 │   - /opt/ps-slots/<slot>/docker-compose.yml 재생성 (image, port, env)
 │   - 이전 컨테이너 stop + rm
 │   - on-demand: 즉시 start 하지 않음
 │
[F] Cloudflare DNS (신규 슬롯 최초 배포만)
 │   - CF API: CNAME <slot>.ps.twinverse.org → tunnel UUID
 │   - cloudflared config ingress 추가 + SIGHUP
 │
[G] 활성 버전 교체 (원자적)
 │   - rename(): versions/v<N> → current symlink 교체
 │   - ps_slots.active_version = v<N>.id
 │   - N-3 이전 버전 FIFO 삭제
 │
[H] 완료
     - build_status='ready', state='stopped' (on-demand)
     - SSE 종료
```

### on-demand 기동

```
POST /api/.../slots/:id/start
 │
 ├─▶ ssh twinverse-ai "cd /opt/ps-slots/<slot> && docker compose up -d"
 ├─▶ 헬스폴링 (최대 90초): GET http://twinverse-ai:<port>/health
 ├─▶ ps_slots.last_activity_at = NOW(); state='running'
 └─▶ {ready: true, stream_url: 'https://<slot>.ps.twinverse.org'}
```

### 유휴 자동 stop (백그라운드 워커, 30초 주기)

```
for slot in running slots:
    if slot.pinned: continue
    sessions = wilbur_session_count(slot)   # Wilbur admin API 조회
    if sessions == 0 and NOW() - slot.last_activity_at > slot.idle_timeout_s:
        ssh twinverse-ai "docker compose stop"
        slot.state = 'stopped'
```

### 에러 복구

| 실패 지점 | 복구 |
|-----------|------|
| 빌드 실패 | `current` symlink 유지. 신규 버전만 `failed`. 서비스 무영향 |
| 이미지 전송 실패 | 3회 재시도. 실패 시 버전 `failed` |
| Cloudflare API 실패 | UI 에 수동 복구 가이드 표시. DNS 는 1회 생성이라 빈도 낮음 |
| twinverse-ai 불능 | 업로드는 성공. 배포는 `pending` 큐잉. 서버 복귀 시 재시도 |

## 6. 프론트엔드 UI

### Orbitron 대시보드

TwinverseAI 프로젝트 상세 페이지 사이드바에 **Pixel Streaming** 탭 추가.

- **슬롯 목록 테이블**: name / display / state(🟢running / ⚪stopped) / version / subdomain / [Open] [⋮ 메뉴].
- **새 슬롯 생성 모달**: name, display_name, description, thumbnail_url.
- **슬롯 상세 페이지**:
  - 메타데이터 편집 폼.
  - 업로드 영역 (드래그&드롭 + 파일 선택). tus 프로토콜 이어받기 진행바. 빌드 로그 실시간 스트림(SSE).
  - 버전 히스토리 (최대 3개). active 표시, [Rollback] 버튼.
  - 런타임 컨트롤 [▶ Start] [■ Stop], idle_timeout 편집.

### TwinverseAI 랜딩페이지

`/pixel-streaming` 페이지 + 메뉴 항목 신설.

- 공개 API `/api/public/projects/twinverseai/ps-slots` 호출해 카드 그리드 렌더.
- 카드: 썸네일, display_name, description(툴팁), [Play] 버튼.
- Play 버튼 클릭 → `POST /slots/:id/start` → 로딩 모달("컨테이너 기동 중… 약 45초" + 진행바) → ready 시 전체 페이지 리다이렉트 (풀스크린 스트리밍 우선).

### 구현 스택

- **Orbitron 대시보드**: 기존 Orbitron 프론트 스택 따름. 업로드 클라이언트는 `tus-js-client`.
- **TwinverseAI 랜딩**: 기존 React + Vite. 신규 라우트 `/pixel-streaming`.

## 7. 보안

| 항목 | 방침 |
|------|------|
| 업로드 인증 | Orbitron JWT (admin 이상). Phase C 는 project-owner 권한 체크 추가 |
| 파일 검증 | MIME + 매직바이트 + path traversal 차단 + UE5 필수 파일 존재 검증 |
| 용량 제한 | 슬롯당 업로드 ≤ 20GB (하드코딩). Phase C 에서 플랜별 쿼터로 확장 |
| 컨테이너 격리 | `--read-only` + `--tmpfs /tmp` + 최소 cap + 슬롯별 docker network |
| GPU 접근 | NVIDIA runtime 만. 호스트 /dev 직접 마운트 금지 |
| 공개 API | read-only, rate limit 60/min per IP |
| Secret | 기존 Orbitron secrets 테이블 재사용 (암호화 저장) |

## 8. 테스트 전략

**유닛**
- zip 추출 검증 (path traversal, 필수 파일).
- 포트 할당 충돌 방지.
- 버전 FIFO 삭제 (N=3).
- symlink 원자적 교체 (`rename()`).

**통합**
- tus 업로드 이어받기 · 체크섬.
- 전체 E2E 파이프라인 (소형 더미 UE5 패키지로 CI 자동화).
- 롤백 시나리오.
- Cloudflare DNS 자동화 (staging 도메인에서).

**운영 검증**
- GPU 동시 세션 한계 측정 (RTX 3090).
- 콜드 스타트 시간 측정.
- 유휴 자동 stop 동작 확인.

## 9. 롤아웃 계획 (Phase B)

| Week | 범위 |
|------|------|
| 1 | 백엔드 API, PG 스키마, tus 업로드, 압축 해제 검증 |
| 2 | Docker 템플릿, 이미지 빌드/전송, symlink 교체, 롤백 |
| 3 | Cloudflare DNS 자동화, on-demand 기동/stop, 유휴 감지 |
| 4 | Orbitron 대시보드 UI, 랜딩페이지 연동, E2E 테스트 |
| Cutover | 기존 TwinversePS2-Deploy 를 `office` 슬롯으로 마이그레이션 후 repo archive |

### 마이그레이션 체크리스트

- [ ] 기존 `/opt/twinverse-ps2` 컨테이너/파일 백업.
- [ ] 신규 `office` 슬롯으로 현재 UE5 빌드 업로드.
- [ ] `office.ps.twinverse.org` 정상 동작 확인.
- [ ] `ps.twinverse.org` → `office.ps.twinverse.org` 하위 호환 리다이렉트 설정.
- [ ] cloudflared 에서 구 `ps2.twinverse.org`, `ps2-api.twinverse.org` 제거.
- [ ] TwinverseAI 랜딩 "Pixel Streaming" 메뉴 공개.
- [ ] `TwinversePS2-Deploy` GitHub repo archive.

## 10. Phase C 진화 경로 (참조용)

Phase B 스키마 · 코드에서 다음만 확장하면 Phase C 진입:

- `ps_slots.owner_user_id` / `tenant_id` 활용한 권한 체크 로직 추가.
- 프로젝트 설정에 "Pixel Streaming 활성화" 플래그 (비 TwinverseAI 프로젝트도 가능).
- 유료 플랜 쿼터 enforcement (업로드 GB, 동시 세션, pinned 가능 여부).
- 공유 Docker 레지스트리(`harbor` / `registry:2`) 도입.
- 과금 훅 (세션 분, GPU 초 기록).
- 커스텀 도메인 매핑 UI.

Phase C 는 별도 스펙으로 작성 예정.

## 11. Open Questions / 구현 전 확인사항

Orbitron 개발자가 구현 착수 전 결정/조사해야 할 항목:

1. **Orbitron 프론트 스택**: 기존 대시보드가 EJS 서버렌더 vs SPA 인지 확인 → 업로드 UI 구현 방식 선택.
2. **Cloudflare DNS API 자동화 코드**: 기존 Orbitron 에 다른 프로젝트용 DNS 자동 생성 코드가 있는지. 있다면 재활용, 없다면 `cloudflare` npm 패키지로 신규 구현.
3. **Wilbur admin API**: 슬롯의 활성 세션 수 조회 방법. Wilbur 자체 엔드포인트 혹은 signaling 로그 파싱.
4. **Docker 이미지 전송 네트워크**: Orbitron ↔ twinverse-ai 가 같은 LAN(1Gbps) 가정. 다를 경우 `docker save` 시간 재평가.
5. **UE5 Dockerfile 템플릿**: 기존 `TwinversePS2-Deploy/Dockerfile` 을 베이스로. Pixel Streaming 의존성(xvfb, Wilbur, NVIDIA 드라이버 호환) 검증 필요.
6. **iframe vs 리다이렉트**: 랜딩에서 스트리밍 실행 시 전체 리다이렉트를 기본값으로. 추후 iframe 임베드 옵션 추가 고려.

## 부록 A. 관련 리소스

- 기존 TwinversePS2-Deploy repo: `ChoonwooLim/TwinversePS2-Deploy` (Phase B 완료 후 archive)
- TwinverseAI repo: `ChoonwooLim/TwinverseAI`
- Orbitron 소스: Orbitron 서버 `/home/stevenlim/WORK/orbitron/`
- Wilbur Pixel Streaming 런타임: Epic 공식
- tus.io: <https://tus.io/>
