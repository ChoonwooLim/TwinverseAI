# Orbitron Pixel Streaming 플랫폼 설계 (멀티플레이어 개정판)

- **작성일**: 2026-04-15
- **개정일**: 2026-04-15 (초안 → 멀티플레이어 피벗 → 책임 분리 개정)
- **작성자**: Steven Lim + Claude (brainstorming 세션)
- **대상 구현자**: **두 트랙 병렬**
  - **Track A (내부, TwinverseAI 측)**: UE5 템플릿 셸 프로젝트 제작 (Steven + Claude)
  - **Track B (Orbitron 개발 AI)**: Pixel Streaming 배포 플랫폼 (업로드·이미지 빌드·GPU 배포·DNS·세션/큐 관리)
- **관련 프로젝트**: TwinverseAI · TwinverseDesk · TwinversePS2-Deploy (폐기 예정)

## 책임 분리 (중요)

| 구성요소 | 소유 | 비고 |
|----------|------|------|
| UE5 멀티플레이어 셸 템플릿 (`twinverse-ps-template` 레포) | **Track A · 내부** | Steven + Claude 가 TwinverseDesk/TwinverseAI 저장소 주변에서 직접 개발. Orbitron 개발 AI 에게 전달하지 않음 |
| 템플릿 v1.0.0 Package zip | **Track A 제공 → Track B 사용** | 템플릿 완료 후 빌드 결과물을 Orbitron 개발 AI 에게 "참조 샘플 패키지"로 전달 (빌드 파이프라인 E2E 테스트용) |
| Orbitron 백엔드 (스키마·API·업로드·빌드·배포·DNS·세션/큐) | **Track B · Orbitron 개발 AI** | `/home/stevenlim/WORK/orbitron/` 에서 개발 |
| Orbitron 대시보드 UI (슬롯 관리) | **Track B** | Orbitron 프론트 스택 |
| TwinverseAI 랜딩 `/pixel-streaming` 페이지 | **Track A · 내부** | TwinverseAI 리포의 프론트(React+Vite). Orbitron 공개 API 를 호출만 함 |
| 템플릿 기반 실제 맵 제작(Office 등) | **Track A · 내부** | 템플릿 fork 후 맵/에셋 교체 → Orbitron UI 에서 업로드 |

Orbitron 개발 AI 는 **템플릿 내부 구현에 관여하지 않음**. Orbitron 이 알아야 할 것은:
- 업로드 zip 에 `template_manifest.json` 이 포함되어 있고 그 구조가 §4 에 정의된 대로라는 사실
- Dockerfile 이 UE5 Listen Server + Wilbur + xvfb 로 구성된다는 사실 (템플릿이 이미 호환되도록 만듦)
- UE5 admin HTTP 엔드포인트 (`/admin/kick/:playerId` 등) 가 컨테이너 내부에서 열린다는 사실

## 0. 개정 요약 (이전 초안 대비)

초안은 **뷰어당 1 UE5 프로세스** 모델 (같은 맵을 N 명이 보려면 N 개 GPU 프로세스 필요). GPU 부하 한계 때문에 다음과 같이 피벗:

| 항목 | 이전 초안 | 개정판 |
|------|----------|--------|
| 스트리밍 모드 | 뷰어당 1 프로세스 | **슬롯당 1 프로세스 · 멀티 뷰포트 (PixelStreaming2 멀티 스트리머)** |
| 슬롯당 상한 | 무제한 (프로세스 수로 제한) | **6명 동시 + FIFO 대기열** |
| 멀티플레이어 로직 | 없음 (각자 독립 세션) | **리슨 서버 모드 내장, 유저끼리 서로 보임** |
| UE5 패키지 구조 | 업로더 자율 | **Twinverse 제공 표준 셸 템플릿 기반 필수** |
| 기본 기능 | 단순 스트리밍 | 캐릭터·이동·이름표·텍스트채팅·근접음성·점프/애니·이모트·의자 상호작용·어드민 킥/뮤트 |
| 신원 | 별도 관리 불필요 | **하이브리드** — 로그인 기본, 슬롯별 게스트 링크 토글 |

GPU 1장(RTX 3090 24GB)으로 **슬롯 × 6명** 을 동시 서빙. 예전 모델이라면 슬롯당 6 프로세스 = 사실상 불가능.

## 1. 배경 & 목적

### 현재 구조의 문제

- UE5 Linux 패키지 배포를 `TwinversePS2-Deploy` GitHub repo 경유 (git-LFS 8GB+, 2GB per-file 한계).
- Orbitron 유료 SaaS 전환 시 타 사용자 업로드가 GitHub 경유로는 비현실적.
- 프로젝트마다 별도 Orbitron 프로젝트 생성 필요 — 멀티 슬롯 구조로 리팩터 필요.
- **초안 설계의 GPU 문제**: 한 맵을 여러 명이 같이 보려면 프로세스가 인원수만큼 필요 → 3090 1장으로는 1~2명이 한계.

### 이 설계의 목적

Orbitron 플랫폼에 **멀티플레이어 Pixel Streaming 을 일급 시민으로 내장**. 사용자는 대시보드에서 UE5 패키지 zip (템플릿 기반) 을 직접 업로드 → 자동 이미지 빌드 → GPU 호스트 배포 → 서브도메인 할당 → 온디맨드 기동. 최종 사용자는 **한 슬롯에서 최대 6명이 같은 맵에 접속해 서로 보며 이동·대화**.

### 스코프 (Phase B, 이 스펙의 대상)

- **대상 프로젝트**: TwinverseAI 1개 (관리자 = Steven 1인).
- **슬롯 다중화**: 한 프로젝트 안에 여러 멀티플레이어 슬롯(예: `office`, `museum`, `demo`).
- **슬롯당 상한**: 동시 6명 · FIFO 대기열.
- **스트리밍 모드**: 슬롯당 1 UE5 프로세스, 6 뷰포트 · 6 PixelStreamer.
- **업로드 포맷**: Twinverse 표준 템플릿 기반 UE5 `Package/Linux/` 폴더 zip.
- **URL 전략**: 슬롯당 서브도메인 — `<slot>.ps.twinverse.org`.
- **컨테이너 생명주기**: On-demand (첫 접속자 요청 시 기동, 유휴 시 자동 stop).
- **버전 관리**: 슬롯당 최근 3개 버전 보관 + 원클릭 롤백.
- **신원**: 로그인 기본, 슬롯별 게스트 링크 허용 토글.

### 스코프 외 (Phase C — 별도 스펙)

- 타 Orbitron 프로젝트로 확장 (멀티테넌트).
- GPU/스토리지 쿼터, 과금 훅.
- 멀티 GPU 오토스케일 (동일 슬롯 인스턴스 다중화).
- 공유 Docker 레지스트리 · 커스텀 도메인.

Phase B 스키마는 `owner_user_id` / `tenant_id` / `pinned` 컬럼을 미리 포함해 스키마 변경 없이 Phase C 진입 가능하도록 한다.

## 2. 아키텍처

```
                       ┌──────────────────────┐
 사용자 브라우저       │  TwinverseAI 랜딩    │
 (twinverse.org)──────▶│  /pixel-streaming    │
                       │  슬롯 카드 (6/6 · 2명 대기)
                       └──────────┬───────────┘
                                  │ fetch slots + session state (SSE)
                                  ▼
                       ┌──────────────────────┐
                       │  Orbitron (4000)     │
                       │  • Slot CRUD         │
                       │  • Template registry │
                       │  • tus 업로드/검증   │
                       │  • Docker 이미지 빌드│
                       │  • Cloudflare DNS    │
                       │  • on-demand 기동    │
                       │  • 세션/큐 상태 관리 │
                       │  • Wilbur admin 폴링 │
                       └──────┬──────┬────────┘
                  ssh+docker  │      │ cloudflared reload
                              ▼      ▼
     ┌─────────────────────────────────────────────┐
     │  twinverse-ai (117)   RTX 3090 + Docker     │
     │                                             │
     │  슬롯별 컨테이너 (하나당 1 UE5 프로세스)    │
     │  ┌────────────────────────────────────┐     │
     │  │ UE5 Listen Server + 6 Viewport     │     │
     │  │ Wilbur (signaling, port 8081)      │     │
     │  │  ├─ Streamer#1 (player 1 view)     │     │
     │  │  ├─ Streamer#2 (player 2 view)     │     │
     │  │  ├─ ...                            │     │
     │  │  └─ Streamer#6 (player 6 view)     │     │
     │  └────────────────────────────────────┘     │
     └─────────────────────────────────────────────┘

 Cloudflare Tunnel ingress (Orbitron 자동 관리):
   office.ps.twinverse.org    → twinverse-ai:8081
   museum.ps.twinverse.org    → twinverse-ai:8082
   ...
```

### 핵심 개념

- **템플릿 셸**: Twinverse 유지관리 UE5 프로젝트. 멀티플레이어(리슨 서버), 멀티 뷰포트, PS2 멀티 스트리머, 캐릭터·채팅·음성·이모트 기능 탑재. 업로더는 이 템플릿을 fork → 맵/에셋만 교체 → 패키징 → 업로드.
- **슬롯**: 하나의 배포 단위 = 하나의 맵 체험. 슬롯 = 1 UE5 프로세스 = 6 동시 접속 + 큐.
- **세션 슬롯(seat)**: 한 슬롯 내 6개 좌석 중 하나. 유저가 입장 시 할당, 퇴장 시 해제, 큐에 대기자 있으면 자동 승격.
- **신원 모드**: `login_required` (기본) vs `guest_link_allowed`. 게스트 허용 슬롯은 별도 서명된 링크로 비로그인 입장 가능.

## 3. 데이터 모델

### PG 신규 테이블

```sql
CREATE TABLE ps_slot_templates (
    id                  SERIAL PRIMARY KEY,
    version             VARCHAR(20) UNIQUE NOT NULL,     -- 'v1.0.0'
    ue5_version         VARCHAR(20) NOT NULL,            -- '5.7.4'
    description         TEXT,
    docker_base_image   VARCHAR(200) NOT NULL,           -- 'nvidia/cuda:12.6.0-base-ubuntu22.04'
    features            JSONB NOT NULL DEFAULT '{}',     -- {chat:true, voice:true, emote:true, sit:true, kick:true}
    git_ref             VARCHAR(100) NOT NULL,           -- template repo commit SHA
    released_at         TIMESTAMP DEFAULT NOW(),
    deprecated          BOOLEAN DEFAULT false
);

CREATE TABLE ps_slots (
    id                  SERIAL PRIMARY KEY,
    project_id          INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name                VARCHAR(50) NOT NULL,
    display_name        VARCHAR(100) NOT NULL,
    description         TEXT DEFAULT '',
    thumbnail_url       VARCHAR(500),
    subdomain           VARCHAR(150) UNIQUE NOT NULL,
    container_port      INTEGER NOT NULL UNIQUE,
    active_version      INTEGER,                          -- FK to ps_versions (deferrable)
    -- 멀티플레이어 설정
    max_players         INTEGER NOT NULL DEFAULT 6 CHECK (max_players BETWEEN 1 AND 12),
    allow_guest_link    BOOLEAN NOT NULL DEFAULT false,
    template_version    VARCHAR(20) NOT NULL REFERENCES ps_slot_templates(version),
    -- 상태
    state               VARCHAR(20) DEFAULT 'draft',      -- draft|running|stopped|error
    last_activity_at    TIMESTAMP,
    idle_timeout_s      INTEGER DEFAULT 600,
    -- Phase C 확장용
    owner_user_id       INTEGER REFERENCES users(id),
    tenant_id           INTEGER,
    pinned              BOOLEAN DEFAULT false,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE (project_id, name)
);

CREATE TABLE ps_versions (
    id                  SERIAL PRIMARY KEY,
    slot_id             INTEGER NOT NULL REFERENCES ps_slots(id) ON DELETE CASCADE,
    version_label       VARCHAR(50) NOT NULL,
    template_version    VARCHAR(20) NOT NULL REFERENCES ps_slot_templates(version),
    upload_size_b       BIGINT NOT NULL,
    image_tag           VARCHAR(200),
    build_status        VARCHAR(20) DEFAULT 'uploading',
    build_log           TEXT,
    uploaded_at         TIMESTAMP DEFAULT NOW(),
    uploaded_by         INTEGER REFERENCES users(id),
    UNIQUE (slot_id, version_label)
);

-- 활성/대기 세션 추적 (Orbitron 이 authoritative, Wilbur 는 소스 중 하나)
CREATE TABLE ps_sessions (
    id                  SERIAL PRIMARY KEY,
    slot_id             INTEGER NOT NULL REFERENCES ps_slots(id) ON DELETE CASCADE,
    user_id             INTEGER REFERENCES users(id),     -- NULL = 게스트
    guest_name          VARCHAR(40),                      -- 로그인이면 NULL
    guest_token_hash    VARCHAR(64),                      -- 게스트 링크 검증용
    state               VARCHAR(20) NOT NULL,             -- 'queued' | 'active'
    queue_position      INTEGER,                          -- state='queued' 일 때만
    streamer_id         VARCHAR(50),                      -- Wilbur 측 streamer id, active 시
    joined_at           TIMESTAMP DEFAULT NOW(),
    promoted_at         TIMESTAMP,                        -- queued → active 시각
    last_heartbeat_at   TIMESTAMP DEFAULT NOW(),
    CHECK (
        (user_id IS NOT NULL AND guest_name IS NULL) OR
        (user_id IS NULL AND guest_name IS NOT NULL)
    )
);

CREATE INDEX idx_ps_slots_project ON ps_slots(project_id);
CREATE INDEX idx_ps_versions_slot ON ps_versions(slot_id);
CREATE INDEX idx_ps_sessions_slot_state ON ps_sessions(slot_id, state);
CREATE INDEX idx_ps_sessions_heartbeat ON ps_sessions(last_heartbeat_at);
```

### 파일 시스템

```
/srv/pixelstreaming/
└── <project_slug>/
    └── <slot_name>/
        ├── versions/
        │   ├── v1/
        │   │   ├── upload.zip
        │   │   ├── template_manifest.json   # 업로드 시 검증된 템플릿 버전/에셋 매니페스트
        │   │   └── Package/Linux/...
        │   ├── v2/
        │   └── v3/
        └── current -> versions/vN

/opt/orbitron/templates/pixel-streaming/
├── Dockerfile                                # 템플릿 버전별
└── docker-compose.yml.tpl                    # 변수 치환

/opt/ps-slots/                                # twinverse-ai 쪽
└── <slot_name>/
    ├── current/Package/Linux/...
    └── docker-compose.yml
```

### 템플릿 레포 (Twinverse 유지관리)

- 위치: `github.com/ChoonwooLim/twinverse-ps-template` (별도 레포)
- 브랜치: `main` = 최신 release, 태그 `v1.0.0` = 특정 템플릿 버전
- 내용:
  - UE5 5.7.4 C++ 프로젝트
  - `TwinverseShellGameMode` (리슨 서버 + 6인 스폰 + 큐 매니저)
  - `TwinverseCharacter` (WASD+마우스, 점프, 이모트 9종, 의자 상호작용)
  - `TwinverseNameplateComponent`
  - `TwinverseChatComponent` (텍스트)
  - `TwinverseVoiceComponent` (근접 WebRTC)
  - `TwinverseAdminComponent` (킥/뮤트, `admin_key` 환경변수로 인증)
  - `PixelStreaming2SubSystem` 설정: 6 뷰포트 동시 서빙
  - 예제 맵 `/Content/ExampleOffice.umap`
- 업로더 작업: repo clone → 맵/에셋 교체 → 로컬 빌드 → `Package/Linux/` 폴더 zip → 업로드

## 4. API 계약

모든 엔드포인트는 Orbitron 기존 JWT 인증 재사용 (admin 이상). 공개 엔드포인트 `/api/public/...` 만 비인증.

### 슬롯 CRUD

```
GET    /api/projects/:projectId/ps-slots
POST   /api/projects/:projectId/ps-slots
       body: {name, display_name, description, thumbnail_url,
              max_players=6, allow_guest_link=false,
              template_version='v1.0.0'}
PATCH  /api/projects/:projectId/ps-slots/:slotId
DELETE /api/projects/:projectId/ps-slots/:slotId
```

`POST` 시 서버 책임:
- `subdomain`, `container_port` 자동 할당.
- `template_version` 유효성 검증 (ps_slot_templates 존재 · not deprecated).
- Cloudflare CNAME + cloudflared ingress 등록.

### 템플릿

```
GET    /api/ps-templates
       → [{version, ue5_version, features, released_at, deprecated}]
POST   /api/ps-templates                (superadmin 전용, Phase B 에서는 수동 시드)
```

### 업로드 (tus.io)

```
POST   /api/projects/:projectId/ps-slots/:slotId/upload/initiate
       → {upload_id, upload_url, chunk_size}
PATCH  /api/uploads/:uploadId                         (tus 표준)
POST   /api/uploads/:uploadId/finalize
       → {version_id, build_status: 'validating'}

GET    /api/projects/:projectId/ps-slots/:slotId/versions/:versionId/build-log
       → SSE: 템플릿 매니페스트 검증, Dockerfile 렌더, 이미지 빌드, 전송, 심볼릭 교체
```

업로드 zip 내부에 **`template_manifest.json`** 필수:
```json
{
    "template_version": "v1.0.0",
    "ue5_version": "5.7.4",
    "game_name": "TwinverseShell",
    "map": "/Game/ExampleOffice",
    "assets_added": ["..."]
}
```
서버가 `template_version` 이 슬롯 설정과 일치하는지, 필수 바이너리(`TwinverseShell-Linux-Shipping`)가 존재하는지 검증.

### 버전 & 롤백

```
GET    /api/projects/:projectId/ps-slots/:slotId/versions
POST   /api/projects/:projectId/ps-slots/:slotId/versions/:versionId/activate
DELETE /api/projects/:projectId/ps-slots/:slotId/versions/:versionId
```

### 런타임 제어 (관리자)

```
POST   /api/projects/:projectId/ps-slots/:slotId/start      # 강제 기동 (관리자)
POST   /api/projects/:projectId/ps-slots/:slotId/stop       # 강제 종료 (세션 전원 강제 퇴장)
GET    /api/projects/:projectId/ps-slots/:slotId/status
       → {state, active_count, queued_count, gpu_memory_mb, last_activity_at}
POST   /api/projects/:projectId/ps-slots/:slotId/sessions/:sessionId/kick
```

### 플레이어 API (공개 또는 로그인)

```
POST   /api/ps-slots/:slotId/join
       body (로그인): {}  — JWT 로 user_id 추출
       body (게스트): {guest_link_token, guest_name}
       → {session_id, state: 'queued'|'active', queue_position?,
          stream_url?, signaling_ws_url?}
       → state='active' 이면 클라이언트가 signaling_ws_url 로 WebRTC 연결 시작
       → state='queued' 이면 SSE 로 상태 변화 구독

GET    /api/ps-sessions/:sessionId/events                 # SSE
       → {type: 'queue_update', position: 2}
       → {type: 'promoted', stream_url, signaling_ws_url}
       → {type: 'kicked', reason}

POST   /api/ps-sessions/:sessionId/heartbeat               # 30초마다
POST   /api/ps-sessions/:sessionId/leave
```

### 게스트 링크 (슬롯별 토글 ON 일 때)

```
POST   /api/projects/:projectId/ps-slots/:slotId/guest-links
       body: {expires_at, max_uses}
       → {token, share_url: 'https://twinverse.org/pixel-streaming/<slot>?gl=<token>'}
GET    /api/projects/:projectId/ps-slots/:slotId/guest-links
DELETE /api/projects/:projectId/ps-slots/:slotId/guest-links/:id
```

### 공개 슬롯 정보 (랜딩페이지)

```
GET    /api/public/projects/:projectSlug/ps-slots
       → [{name, display_name, description, thumbnail_url, subdomain,
           max_players, active_count, queued_count, state}]
GET    /api/public/projects/:projectSlug/ps-slots/:slotName/session-state
       → {active_count, queued_count}  (랜딩 카드 실시간 배지용)
```

Rate limit: 60 req/min per IP.

## 5. 배포 & 런타임 오케스트레이션

### 5.1 업로드 → 활성화 파이프라인

```
[A] tus finalize
 ↓
[B] 압축 해제 + 매니페스트 검증 (build_status='validating')
    - path traversal 차단
    - template_manifest.json 존재 + template_version 슬롯과 일치
    - 필수 바이너리 존재
    - 실패 → failed + SSE 에러
 ↓
[C] Docker 이미지 빌드 (build_status='building')
    - 템플릿 Dockerfile (nvidia/cuda 베이스 + xvfb + Wilbur + 6 뷰포트 설정)
    - build context = versions/v<N>/Package/
    - tag: twinverse/ps-<slot>:v<N>
 ↓
[D] 이미지 전송: docker save | ssh twinverse-ai docker load
 ↓
[E] twinverse-ai 슬롯 설정 갱신
    - /opt/ps-slots/<slot>/docker-compose.yml 재생성
      (image, port, max_players=6 환경변수, admin_key secret 마운트)
    - 이전 컨테이너 stop + rm (없으면 skip)
 ↓
[F] Cloudflare DNS (최초 배포만)
 ↓
[G] 활성 버전 교체 (atomic rename)
 ↓
[H] 완료 — build_status='ready', state='stopped' (on-demand)
```

### 5.2 유저 입장 플로우 (6인 공유 슬롯 + 큐)

```
사용자 Play 클릭
  → POST /api/ps-slots/:id/join
     ┌─ slot.state = 'stopped' 이고 첫 join 이면:
     │    ssh twinverse-ai "docker compose up -d"
     │    헬스폴링 (최대 90초)
     │    slot.state = 'running'
     ├─ active_count < max_players:
     │    ps_sessions row 생성 (state='active')
     │    Wilbur 에 streamer 슬롯 예약 (PS2 admin API) → streamer_id 저장
     │    return {state:'active', stream_url, signaling_ws_url}
     └─ active_count >= max_players:
          ps_sessions row 생성 (state='queued', position=대기자수+1)
          return {state:'queued', position}
          클라이언트는 SSE 로 프로모션 대기

세션 종료 (leave / 하트비트 만료 / kick):
  ps_sessions row 삭제
  대기열 맨 앞 유저 있으면:
    state='active' 업데이트
    Wilbur streamer 예약
    SSE 'promoted' 전송
  active_count == 0 이고 idle_timeout 경과:
    (아이들 스위퍼 스레드가) docker compose stop
    slot.state = 'stopped'
```

### 5.3 세션 하트비트 & 스위퍼

- 클라이언트: 30초마다 `POST /heartbeat`. 실패 허용 2회. 브라우저 탭 닫기 시 `navigator.sendBeacon()` 으로 `/leave`.
- 서버 스위퍼(30초 주기):
  - `last_heartbeat_at` + 90초 경과 = 유령 세션 → 삭제 + 큐 프로모션.
  - `slot.state='running'` 이고 `active_count=0` 이며 `last_activity_at` + idle_timeout 경과 → stop.
  - `slot.pinned=true` 면 stop 제외.

### 5.4 에러 복구

| 실패 지점 | 복구 |
|-----------|------|
| 빌드 실패 | current symlink 유지. 서비스 무영향 |
| 이미지 전송 실패 | 3회 재시도 → failed |
| Cloudflare API 실패 | UI 수동 가이드 |
| 기동 90초 초과 | 첫 join 요청 실패 응답, slot.state=error, 로그 수집 |
| Wilbur streamer 고갈 (이론상 6/6 외 발생 불가) | 해당 join 큐로 폴백, 로그 경보 |
| 유저 크래시 (프로세스 OOM) | 컨테이너 restart policy 'on-failure:3', 복구 실패 시 slot.state=error |

## 6. 프론트엔드 UI

### Orbitron 대시보드

TwinverseAI 프로젝트 상세에 **Pixel Streaming** 탭.

- 슬롯 목록: name / display / state / version / `active/max · queue` / subdomain / [Open] [⋮]
- 생성 모달: name, display_name, description, thumbnail, max_players(1~12, 기본 6), template_version 선택, allow_guest_link 체크.
- 슬롯 상세:
  - 메타데이터 편집
  - 업로드 영역 (tus 진행바, SSE 빌드 로그)
  - 버전 히스토리 + 롤백
  - **세션 탭**: 현재 접속자 목록 (이름/게스트표시/joined_at) + [Kick], 대기열 표시
  - **게스트 링크 관리** (토글 ON 시): 링크 발급/만료/폐기
  - 런타임 [▶ Start (강제)] [■ Stop (세션 전원 강퇴)]
  - idle_timeout 편집

### TwinverseAI 랜딩페이지

`/pixel-streaming` 페이지 + 메뉴.

- 카드 그리드: 썸네일, display_name, **"4/6 · 2명 대기"** 실시간 배지(공개 SSE), [Play]
- Play 클릭 흐름:
  1. 로그인 필수 슬롯이고 미로그인 → `/login?redirect=/pixel-streaming/<slot>`
  2. 로그인 or 게스트 링크로 `POST /join`
  3. 응답 state='active' → 전체 화면 스트리밍 페이지로 이동, WebRTC 연결
  4. 응답 state='queued' → "대기 중 (순번 N/6)" 모달, SSE 로 실시간 업데이트, 프로모션 시 자동 전환
- 스트리밍 페이지: 상단 바 (슬롯명, 현재 인원 N/6, [나가기]). 풀스크린 UE5 뷰포트. 하단 채팅(T) 토글. 음성은 근접 자동 on (마이크 권한 요청).
- 이탈 감지: 페이지 언로드/뒤로가기 → `sendBeacon('/leave')`.

## 7. 보안

| 항목 | 방침 |
|------|------|
| 업로드 인증 | Orbitron JWT (admin). Phase C = owner |
| 파일 검증 | MIME + path traversal + template_manifest 검증 + 필수 바이너리 확인 |
| 용량 제한 | 업로드 ≤ 20GB |
| 컨테이너 격리 | `--read-only` + `--tmpfs /tmp` + 최소 cap + 슬롯별 docker network |
| GPU 접근 | NVIDIA runtime, /dev 직접 마운트 금지 |
| 게스트 링크 | HMAC 서명, 만료 + max_uses + 폐기 가능. token 해시만 DB 저장 |
| 세션 하이재킹 | session_id 는 서명된 cookie(HttpOnly, Secure). 사용자 IP 변경 시 재발급 요구 |
| 채팅/음성 | UE5 측 admin 컴포넌트로 kick/mute. 공격적 컨텐츠 로그는 Phase C 로 이월 |
| 어드민 키 | 슬롯당 임의 secret (환경변수 주입), 컨테이너 안에서만 검증 |
| 공개 API | read-only, 60 req/min per IP |

## 8. 테스트 전략

**유닛**
- zip 추출 검증 (path traversal, 매니페스트)
- 포트 할당 충돌
- 버전 FIFO (N=3)
- symlink 원자 교체
- 세션 스위퍼 (유령 세션 정리, idle stop)
- 큐 프로모션 (원자성: 동시 leave 시 중복 프로모션 방지)

**통합**
- tus 이어받기 + 체크섬
- E2E: 소형 더미 템플릿 패키지 → 업로드 → 빌드 → 기동 → join (headless Chrome 2명) → 채팅 송수신 → leave
- 롤백
- Cloudflare DNS (staging)
- 게스트 링크 만료/폐기

**운영 검증**
- 6인 동시 접속 시 RTX 3090 VRAM/FPS (목표: 720p 30fps 이상)
- 콜드 스타트 시간 (목표: 90초 이내)
- 7번째 유저 큐잉 체감 시간
- idle stop 동작

## 9. 롤아웃 계획 (Phase B)

| Week | 범위 |
|------|------|
| 0 | 템플릿 UE5 프로젝트 author (별도 레포, v1.0.0 릴리스) |
| 1 | 백엔드 API, PG 스키마(템플릿·슬롯·버전·세션), tus, 매니페스트 검증 |
| 2 | Docker 템플릿, 이미지 빌드/전송, symlink 교체, 롤백 |
| 3 | Cloudflare DNS, on-demand 기동/stop, 세션·큐 관리, 하트비트 스위퍼 |
| 4 | Orbitron 대시보드 UI (세션/킥/게스트 링크 포함), 랜딩 연동, E2E |
| Cutover | TwinversePS2-Deploy → `office` 슬롯 마이그레이션, repo archive |

### 마이그레이션 체크리스트

- [ ] 기존 `/opt/twinverse-ps2` 백업
- [ ] 현재 UE5 빌드를 템플릿 기반으로 포팅 (맵 이식 작업 필요)
- [ ] `office` 슬롯 생성 + 업로드
- [ ] `office.ps.twinverse.org` E2E 확인 (6명 동시 테스트)
- [ ] `ps.twinverse.org` → `office.ps.twinverse.org` 리다이렉트
- [ ] 구 `ps2.*`, `ps2-api.*` ingress 제거
- [ ] TwinverseAI 랜딩 메뉴 공개
- [ ] `TwinversePS2-Deploy` archive
- [ ] Orbitron project 27 제거

## 10. Phase C 진화 경로 (참조용)

- `owner_user_id` / `tenant_id` 권한 체크 활성화
- 비 TwinverseAI 프로젝트에도 Pixel Streaming 탭 제공
- 유료 플랜 쿼터 (업로드 GB · 동시 슬롯 수 · 동시 세션 총합 · pinned 허용 여부)
- 공유 Docker 레지스트리
- 과금 훅 (세션분, GPU-초)
- 커스텀 도메인 매핑
- **멀티 GPU 오토스케일**: 같은 슬롯 인스턴스 다중화 → 유저 6명 초과 시 새 인스턴스(새 방) 자동 생성. 사용자는 방 선택 UI 또는 자동 분산.
- 템플릿 v2+ 출시 (새 기능 추가 시 기존 슬롯은 v1 고정, 업그레이드는 재업로드)

Phase C 는 별도 스펙.

## 11. Open Questions / 구현 전 확인사항

1. **PixelStreaming2 멀티 스트리머 검증**: 단일 UE5 프로세스에서 6 스트리머 동시 구동이 3090 에서 실제 안정 FPS 나오는지 측정 (720p 기준). 미달 시 max_players 하향 조정.
2. **Wilbur admin API 포맷**: streamer 예약/해제 엔드포인트와 인증 방식. Phase 0 조사 대상.
3. **UE5 리슨 서버 + PS2 공존**: 리슨 서버 호스트 역할과 PS2 스트리머 역할이 같은 프로세스에서 충돌 없이 공존하는지 검증. Epic 샘플 확인.
4. **근접 음성 구현 방식**: UE5 내장 VoiceChat (Online Subsystem) vs 별도 WebRTC 메쉬. 둘 다 6명이면 허용 범위. Phase 0 결정.
5. **게스트 사용자 identity**: 이름 중복 허용할지, 세션 ID 로만 구분할지.
6. **템플릿 레포 권한 모델**: 외부 업로더에게 template repo 어떻게 배포? Public read? tarball zip 다운로드 제공?
7. **Orbitron 프론트 스택 / Cloudflare 자동화 기존 코드** (초안 질문 유지).
8. **iframe vs 리다이렉트**: 기본 리다이렉트 (스트리밍 단독 풀스크린). Phase C 에서 iframe 옵션.

## 부록 A. 관련 리소스

- TwinversePS2-Deploy repo: `ChoonwooLim/TwinversePS2-Deploy` (Phase B 후 archive)
- TwinverseAI repo: `ChoonwooLim/TwinverseAI`
- twinverse-ps-template repo: `ChoonwooLim/twinverse-ps-template` (Phase 0 에서 신규 생성)
- Orbitron 소스: `stevenlim@192.168.219.101:/home/stevenlim/WORK/orbitron/`
- UE5 PixelStreaming2 docs: Epic 공식
- tus.io: <https://tus.io/>

## 부록 B. 템플릿 v1 기능 스펙 (요약)

업로더가 만든 맵 위에 템플릿이 제공하는 것:

| 기능 | 입력 | 가시성 |
|------|------|--------|
| 캐릭터 이동 | WASD, Shift 달리기, Space 점프 | 자기 + 타인 |
| 카메라 | 마우스 룩, 스크롤 줌 | 자기 |
| 이름표 | 로그인명 또는 게스트명 | 3m 이내 타인에게 표시 |
| 텍스트 채팅 | T 키 → 입력창 | 전체 채팅 (근접 옵션은 Phase C) |
| 근접 음성 | 자동 on, 마이크 권한 필요 | 10m 반경 감쇠 |
| 이모트 | 1~9 단축키 | 3인칭 애니메이션, 타인 가시 |
| 의자 | 상호작용 키(E) | 앉기 포즈 |
| 어드민 킥/뮤트 | admin_key 보유 웹 UI | 해당 유저 즉시 퇴장 |

상세 구현은 템플릿 레포 README 참조.
