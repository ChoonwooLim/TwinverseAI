# Pixel Streaming 멀티플레이어 플랫폼 구현 계획 (개정판)

> **For agentic workers:** 이 계획은 외부 Orbitron 개발자(또는 개발 AI)에게 전달하는 문서입니다. Claude 자동 실행 대상이 아닙니다. 각 task 는 TDD · bite-sized · 커밋 단위로 설계되어 있으므로 task 단위로 PR 또는 커밋을 만들 것.

## 책임 분리 (중요, 2026-04-15 개정)

이 계획은 **두 트랙**으로 분리됩니다:

- **Track A (내부 · Steven + Claude, TwinverseAI 저장소 근처에서 작업)**: Phase 0.5 (UE5 템플릿 셸 프로젝트), Phase 6.5 (TwinverseAI 랜딩 `/pixel-streaming` 페이지), Phase 7.2 (기존 맵 템플릿 포팅).
- **Track B (Orbitron 개발 AI, `/home/stevenlim/WORK/orbitron/`)**: Phase 0 (사전 조사), Phase 1~5 (백엔드·세션·큐), Phase 6.1~6.4 (Orbitron 대시보드 UI), Phase 7.1/7.3~7.6 (마이그레이션·인프라 cutover).

Orbitron 개발 AI 에게 전달하는 버전에서는 Track A 항목을 "외부 의존성(Steven 측 제공)" 으로만 표기하며, 구현 내용은 요구하지 않습니다. Track B 는 Track A 가 제공할 **템플릿 v1.0.0 Package zip 샘플**을 전제로 E2E 테스트를 진행합니다.

**교환 인터페이스:**

- Track A → Track B: 템플릿 v1.0.0 Package zip + `template_manifest.json` 스펙 + 컨테이너 내부 admin HTTP 엔드포인트 계약
- Track B → Track A: 공개 API (`/api/public/projects/:slug/ps-slots`, `POST /api/ps-slots/:id/join`, SSE 이벤트 스트림) · 게스트 링크 URL 포맷

---

**Goal:** TwinverseAI 프로젝트 내부에 **멀티플레이어 Pixel Streaming 슬롯** 기능을 추가. 슬롯당 6명 동시 접속 + FIFO 대기열. 유저는 Twinverse 표준 UE5 템플릿 기반 패키지를 업로드 → 자동 빌드·배포 → 브라우저에서 6인이 같은 맵에 접속해 서로 보며 대화.

**Architecture:** 슬롯 = 1 UE5 프로세스 = 6 뷰포트 + 6 PS2 스트리머 + 리슨 서버 모드 멀티플레이어. Orbitron 이 업로드·이미지 빌드·twinverse-ai 배포·Cloudflare DNS·세션/큐 관리를 맡고, 런타임은 twinverse-ai 의 Docker 컨테이너에서 UE5 실행.

**Tech Stack:** Node.js (Orbitron 기존), PostgreSQL, tus-node-server, tus-js-client, Docker + NVIDIA runtime, UE5 5.7.4 + PixelStreaming2 + OnlineSubsystemVoice, Cloudflare API + cloudflared tunnel, React (TwinverseAI 랜딩).

**Spec 참조:** [`../specs/2026-04-15-pixel-streaming-platform-design.md`](../specs/2026-04-15-pixel-streaming-platform-design.md) — 본 계획은 spec 의 결정사항을 전제로 함.

---

## 실행 방식

- 총 8개 Phase, 각 Phase 별 리뷰 게이트.
- Phase 0 (사전 조사) 완료 → Steven 승인 → Phase 0.5 착수.
- 각 task 완료마다 `test → impl → pass → commit`. `feat:` / `test:` / `refactor:` 접두어.
- branch 전략: `main` 에서 `feature/ps-multiplayer` 분기, Phase 별 sub-branch 권장.
- **병렬성:** Phase 0.5 (UE5 템플릿) 와 Phase 1~5 (Orbitron 백엔드) 는 병렬 가능. Phase 6 UI 는 API 확정 후, Phase 7 cutover 는 전체 완료 후.

---

## Phase 0 — 사전 조사 (착수 전 필수)

목적: 구현 가정이 깨지지 않는지 먼저 확인. 결과를 **조사 메모**로 Steven 에게 보고 후 승인 받아 Phase 0.5 진행.

### Task 0.1: PixelStreaming2 멀티 스트리머 POC

**파일:**
- Create: `docs/research/ps2-multi-streamer-poc.md`

- [ ] **Step 1: Epic PixelStreaming2 샘플 프로젝트 준비**
- [ ] **Step 2: 단일 UE5 프로세스에서 6 뷰포트 + 6 스트리머 구동 시도** (Editor 플레이모드 아닌 Packaged Listen Server)
- [ ] **Step 3: RTX 3090 에서 720p 30fps 유지 여부 측정** — 유휴 맵 / 복잡 맵 2 케이스
- [ ] **Step 4: Wilbur signaling server 가 6 스트리머 동시 관리 가능한지 확인**
- [ ] **Step 5: 결과 문서화**: 실측 FPS/VRAM/CPU, 장애 요소, 회피 방안
- [ ] **Step 6: Steven 에게 보고 → max_players 확정 (6 유지 또는 하향)**

### Task 0.2: Wilbur admin API 분석

**파일:**
- Create: `docs/research/wilbur-admin-api.md`

- [ ] **Step 1: Wilbur 소스 `SignallingWebServer` 디렉토리 검색**
- [ ] **Step 2: streamer 목록 조회 / streamer 예약·해제 엔드포인트 확인** (없으면 REST 대체안: signaling WS 메시지 감청)
- [ ] **Step 3: 인증 방식 (API key / IP 화이트리스트 / 없음)**
- [ ] **Step 4: 결과 문서화**

### Task 0.3: Orbitron 기존 배포 파이프라인 내부 구조

**파일:**
- Create: `docs/research/orbitron-internals.md`

- [ ] **Step 1: `/home/stevenlim/WORK/orbitron/services/deployer.js` 분석** — 기존 프로젝트 배포 훅 위치
- [ ] **Step 2: Cloudflare DNS 자동화 기존 코드 확인** — 있으면 함수명/경로, 없으면 `cloudflare` npm 사용 결정
- [ ] **Step 3: `nginxService` 동작 방식 및 Pixel Streaming 은 cloudflared 경유하므로 nginx 우회 여부 결정**
- [ ] **Step 4: 결과 문서화**

### Task 0.4: Cloudflare 토큰 권한 조사

**파일:**
- Create: `docs/research/cloudflare-token-scope.md`

- [ ] **Step 1: 기존 Orbitron 에 저장된 Cloudflare API token 조회** (secrets 테이블)
- [ ] **Step 2: 권한 범위 확인**: DNS Edit, Cloudflare Tunnel configuration 쓰기
- [ ] **Step 3: 부족하면 신규 토큰 발급 요청 Steven 에게**
- [ ] **Step 4: 결과 문서화**

### Task 0.5: UE5 근접 음성 구현 방식 결정

**파일:**
- Create: `docs/research/ue5-voice-choice.md`

- [ ] **Step 1: Epic OnlineSubsystemVoice vs 별도 WebRTC 메쉬 비교**
- [ ] **Step 2: 6명 기준 리소스/지연/복잡도 분석**
- [ ] **Step 3: 템플릿 v1 에서 채택할 방식 결정 + 근거 문서화**

**Phase 0 완료 게이트:** 5개 메모 + Steven 승인.

---

## Phase 0.5 — 템플릿 UE5 프로젝트 (별도 레포) — **Track A (내부 작업)**

> Orbitron 개발 AI 는 이 Phase 를 직접 수행하지 않습니다. Steven + Claude 가 TwinverseDesk/TwinverseAI 저장소 주변에서 작업하며, 완성된 템플릿 v1.0.0 Package zip 을 Orbitron 에 "샘플"로 전달합니다. Track B (Orbitron) 는 Phase 1~5 를 템플릿 완성 전에도 병렬 진행 가능합니다 (E2E 테스트만 템플릿 완료 후).

**레포:** `github.com/ChoonwooLim/twinverse-ps-template` (Steven 이 Phase 0 완료 후 생성)

### Task 0.5.1: 레포 초기화 + 기본 UE5 5.7.4 프로젝트

**파일:**
- Create: `twinverse-ps-template/TwinverseShell.uproject`
- Create: `twinverse-ps-template/.gitignore`
- Create: `twinverse-ps-template/README.md` (업로더용 가이드)

- [ ] **Step 1: UE5 5.7.4 C++ 빈 프로젝트 생성 (프로젝트명 `TwinverseShell`)**
- [ ] **Step 2: PixelStreaming2 + OnlineSubsystem (Voice) + CommonUI 플러그인 활성화**
- [ ] **Step 3: `.gitignore` (`Binaries/`, `Intermediate/`, `Saved/`, `DerivedDataCache/`)**
- [ ] **Step 4: README 에 업로더 워크플로우 기술** (fork → 맵 교체 → 빌드 → zip)
- [ ] **Step 5: 초기 커밋 + tag `v1.0.0-alpha.1`**

### Task 0.5.2: 리슨 서버 GameMode + 6인 스폰

**파일:**
- Create: `Source/TwinverseShell/TwinverseShellGameMode.{h,cpp}`
- Create: `Source/TwinverseShell/TwinverseShellPlayerController.{h,cpp}`

- [ ] **Step 1: 테스트 — 리슨 서버 시작 시 HostMigration 없이 최대 6 클라이언트 접속 허용 확인 (자동화 어려우면 수동 체크리스트 문서화)**
- [ ] **Step 2: `AGameModeBase` 상속, `bUseSeamlessTravel=false`, `DefaultPawnClass=ATwinverseCharacter`, `MaxPlayers=6`**
- [ ] **Step 3: PreLogin 에서 `MaxPlayers` 초과 시 거부 (서버 레벨 방어, 1차 방어선은 Orbitron 큐)**
- [ ] **Step 4: PlayerController 기본 입력 바인딩**
- [ ] **Step 5: 커밋 `feat: listen server GameMode with 6-player cap`**

### Task 0.5.3: 캐릭터 + 이동 + 카메라

**파일:**
- Create: `Source/TwinverseShell/TwinverseCharacter.{h,cpp}`
- Create: `Content/Input/IA_Move.uasset`, `IA_Look.uasset`, `IA_Jump.uasset` (Enhanced Input)

- [ ] **Step 1: ACharacter 상속, SpringArm + Camera, CharacterMovementComponent 기본값**
- [ ] **Step 2: Enhanced Input: WASD 이동, 마우스 룩, Space 점프, Shift 달리기**
- [ ] **Step 3: 네트워크 replication 확인 (Movement, Rotation)**
- [ ] **Step 4: 커밋 `feat: third-person character with replication`**

### Task 0.5.4: 이름표 컴포넌트

**파일:**
- Create: `Source/TwinverseShell/Components/TwinverseNameplateComponent.{h,cpp}`
- Create: `Content/UI/W_Nameplate.uasset`

- [ ] **Step 1: `UWidgetComponent` 상속, 3D world-space, 3m 이내만 가시**
- [ ] **Step 2: `PlayerState` 의 PlayerName 바인딩 (서버가 join 시 설정)**
- [ ] **Step 3: 거리 기반 fade out**
- [ ] **Step 4: 커밋 `feat: nameplate component with 3m visibility`**

### Task 0.5.5: 텍스트 채팅

**파일:**
- Create: `Source/TwinverseShell/Components/TwinverseChatComponent.{h,cpp}`
- Create: `Content/UI/W_Chat.uasset`

- [ ] **Step 1: 서버 RPC `ServerSendMessage(FString)`, 전체 브로드캐스트 NetMulticast**
- [ ] **Step 2: T 키로 입력창 토글, Enter 전송, Esc 닫기**
- [ ] **Step 3: 최근 20 메시지 버퍼, 5초 후 페이드**
- [ ] **Step 4: 커밋 `feat: global text chat`**

### Task 0.5.6: 근접 음성

**파일:**
- Create: `Source/TwinverseShell/Components/TwinverseVoiceComponent.{h,cpp}`
- Modify: `Config/DefaultEngine.ini` (VoIP 설정)

- [ ] **Step 1: Phase 0.5 조사 결과에 따라 OnlineSubsystemVoice 또는 WebRTC 메쉬 구현**
- [ ] **Step 2: 10m 반경 거리 감쇠 (`AttenuationSettings`)**
- [ ] **Step 3: 자동 on, 마이크 권한 요청은 브라우저 측에서**
- [ ] **Step 4: 커밋 `feat: proximity voice chat`**

### Task 0.5.7: 이모트 9종

**파일:**
- Create: `Content/Animations/Emotes/` (AM_Wave, Dance, Clap, Point, Bow, ThumbsUp, Sit_Idle, Cry, Laugh)
- Modify: `TwinverseCharacter.cpp`

- [ ] **Step 1: 1~9 키 바인딩, Server RPC → Multicast, AnimMontage play**
- [ ] **Step 2: 애니메이션 리플리케이션 확인**
- [ ] **Step 3: 커밋 `feat: 9 emote animations`**

### Task 0.5.8: 의자 상호작용

**파일:**
- Create: `Source/TwinverseShell/Interactables/TwinverseChair.{h,cpp}`
- Create: `Content/Interactables/BP_Chair.uasset`

- [ ] **Step 1: E 키 상호작용, 카메라 근처 의자 탐지 (trace), 앉기 상태 전환 (이동 잠금, 앉기 애님)**
- [ ] **Step 2: 다시 E 로 해제**
- [ ] **Step 3: 의자 점유 동기화 (다른 유저가 같은 의자 사용 불가)**
- [ ] **Step 4: 커밋 `feat: chair interaction with occupancy sync`**

### Task 0.5.9: 어드민 킥/뮤트

**파일:**
- Create: `Source/TwinverseShell/Components/TwinverseAdminComponent.{h,cpp}`
- Modify: `TwinverseShellGameMode.cpp`

- [ ] **Step 1: 환경변수 `TWINVERSE_ADMIN_KEY` 로 입력 받아 서버 검증**
- [ ] **Step 2: HTTP 엔드포인트 (UE5 내장 `Http` 모듈로 간이 서버) `/admin/kick/:playerId`, `/admin/mute/:playerId`**
- [ ] **Step 3: 인증: Header `X-Admin-Key`**
- [ ] **Step 4: Orbitron 에서 이 엔드포인트 호출**
- [ ] **Step 5: 커밋 `feat: admin kick/mute endpoints`**

### Task 0.5.10: PixelStreaming2 6 뷰포트 설정

**파일:**
- Modify: `Config/DefaultEngine.ini`
- Create: `Source/TwinverseShell/TwinverseShellViewportClient.{h,cpp}`

- [ ] **Step 1: PS2 설정: 멀티 스트리머 모드, streamer_id 자동 할당**
- [ ] **Step 2: 플레이어 접속 시 전용 Viewport 생성 → 각 Viewport 를 독립 스트리머에 바인딩**
- [ ] **Step 3: Phase 0 POC 에서 측정한 설정값(해상도, 비트레이트) 반영**
- [ ] **Step 4: 커밋 `feat: PS2 multi-streamer with 6 viewports`**

### Task 0.5.11: 예제 맵 + v1.0.0 릴리스

**파일:**
- Create: `Content/Maps/ExampleOffice.umap` (Epic Office Sample 기반 간단 맵)
- Create: `Scripts/build-linux.sh` (업로더용 헬퍼)
- Create: `template_manifest.json` (템플릿 레포 루트)

- [ ] **Step 1: 간단한 오피스 맵 (책상, 의자 6개, 화이트보드)**
- [ ] **Step 2: build-linux.sh: UE5 CLI 로 Linux Shipping 패키징**
- [ ] **Step 3: template_manifest.json 스키마 정의 및 예제**
- [ ] **Step 4: README 업데이트: 업로더가 따라하는 end-to-end 워크플로우**
- [ ] **Step 5: tag `v1.0.0` 릴리스, GitHub Release 에 예제 Package zip 첨부**

**Phase 0.5 완료 게이트:** 템플릿으로 패키징 → 로컬 실행 → 2인 접속 → 채팅·이모트 확인.

### Task 0.5.12: NPC 듀얼 모델 통합 — **Track A (내부 작업)**

스펙 부록 C 참조. Tier 1 (소셜, Ollama) + Tier 2 (에이전트, OpenClaw) 를 UE5 템플릿에 모두 심는다.

**Files (UE5 템플릿 레포):**

- Modify: `Source/TwinverseDesk/Office/OfficeNPCConversation.h/.cpp` — 기존 그대로 Tier 1 용
- Create: `Source/TwinverseDesk/Office/OfficeNPCAgentConversation.h/.cpp` — Tier 2 WebSocket 스트리밍
- Modify: `Source/TwinverseDesk/Office/OfficeNPCManager.h/.cpp` — `ENPCTier { Social, Agent }` 필드 추가, 스폰 시 Tier 에 맞는 Component 부착
- Test: `Source/TwinverseDeskTests/OfficeNPCAgentConversationTest.cpp`

**Files (TwinverseAI 백엔드):**

- Modify: `backend/routers/npc.py` — 기존 Ollama 경로 그대로 유지 (Tier 1)
- Create: `backend/routers/npc_agent.py` — `WebSocket /api/npc/agent/stream` OpenClaw RPC 프록시
- Modify: `backend/main.py` — 라우터 등록 `/api/npc/agent`
- Test: `backend/tests/test_npc_agent.py` — 모킹된 OpenClaw 게이트웨이로 스트리밍 검증

- [ ] **Step 1: Tier enum + Manager 필드 (TDD)** — 실패 테스트부터
- [ ] **Step 2: OfficeNPCAgentConversation 스켈레톤 (WebSocket client + 델타 수신 → Multicast RPC)**
- [ ] **Step 3: backend `npc_agent.py` — ws 라이브러리로 OpenClaw 연결, chat.send 프록시, 스트리밍 delta passthrough**
- [ ] **Step 4: Ollama 응답 시간 벤치 (gemma3:12b, 6 동시) — 목표 p95 < 3초**
- [ ] **Step 5: OpenClaw 스트리밍 E2E (단일 NPC, 30초 내 최종 응답 완료)**
- [ ] **Step 6: manifest 에 `npcs: [{ name, role, tier, system_prompt }]` 필드 추가**
- [ ] **Step 7: 페일오버 정책 검증 — Tier 2 게이트웨이 다운 시 "잠시 자리를 비웠습니다" 표시**
- [ ] **Step 8: 커밋** — `feat(npc): Tier 1 (Ollama) + Tier 2 (OpenClaw) 듀얼 모델`

**완료 게이트:** 단일 슬롯에 소셜 NPC 3명 + 에이전트 NPC 1명 스폰 → 각각 대화 성공 → 에이전트 NPC 가 간단 도구 사용(파일 읽기) 결과를 말풍선으로 표시.

---

## Phase 1 — 백엔드 스키마 + 슬롯 CRUD

### Task 1.1: DB 마이그레이션

**파일:**
- Create: `orbitron/db/migrations/20260415_ps_slots.sql`

- [ ] **Step 1: spec 섹션 3의 SQL 그대로 작성** (ps_slot_templates, ps_slots, ps_versions, ps_sessions + 인덱스)
- [ ] **Step 2: `BEGIN; ... COMMIT;` 래핑**
- [ ] **Step 3: seed: `INSERT INTO ps_slot_templates (version,ue5_version,description,docker_base_image,features,git_ref) VALUES ('v1.0.0','5.7.4','Initial multiplayer shell','nvidia/cuda:12.6.0-base-ubuntu22.04','{"chat":true,"voice":true,"emote":true,"sit":true,"kick":true}', '<commit_sha>');`**
- [ ] **Step 4: staging DB 에 적용 후 확인**
- [ ] **Step 5: 커밋 `feat: PS platform schema with sessions/templates`**

### Task 1.2: slotDao.js — CRUD

**파일:**
- Create: `orbitron/db/slotDao.js`
- Create: `orbitron/db/__tests__/slotDao.test.js`

- [ ] **Step 1: 테스트 작성** (create 시 project_id · name · display_name 필수, subdomain 유니크 충돌, max_players 범위 1~12)
- [ ] **Step 2: 테스트 실행 → FAIL**
- [ ] **Step 3: 구현** — `create/listByProject/getById/updateMeta/remove`, `allocatePort()` (8081~8999 중 미사용 탐색), `allocateSubdomain()` (기본 `<name>.ps.twinverse.org`)
- [ ] **Step 4: 테스트 → PASS**
- [ ] **Step 5: 커밋 `feat: slotDao with port/subdomain allocation`**

### Task 1.3: versionDao.js

**파일:**
- Create: `orbitron/db/versionDao.js`
- Create: `orbitron/db/__tests__/versionDao.test.js`

- [ ] **Step 1: 테스트** (createNext 시 version_label 자동 증분, listBySlot 최신순, pruneOldVersions 시 active 제외 N-3 삭제)
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현**
- [ ] **Step 4: PASS**
- [ ] **Step 5: 커밋 `feat: versionDao with FIFO pruning`**

### Task 1.4: sessionDao.js

**파일:**
- Create: `orbitron/db/sessionDao.js`
- Create: `orbitron/db/__tests__/sessionDao.test.js`

- [ ] **Step 1: 테스트 작성**
  - `createActive(slot_id, user)` — active_count < max_players 일 때만 성공
  - `createQueued` — queue_position = 현재 대기 수+1
  - `promoteFirstQueued(slot_id)` — TX 원자적, 동시 호출 시 1명만 성공
  - `removeSession(id)` — state=active 이면 큐 1명 자동 승격 + promoted 이벤트 리턴
  - `pruneGhostSessions(threshold)` — last_heartbeat_at 초과 세션 제거
  - `heartbeat(id)` — 갱신
- [ ] **Step 2: FAIL**
- [ ] **Step 3: 구현** (트랜잭션 + `SELECT ... FOR UPDATE` 로 경합 방어)
- [ ] **Step 4: PASS**
- [ ] **Step 5: 커밋 `feat: sessionDao with atomic queue promotion`**

### Task 1.5: templateDao.js

**파일:**
- Create: `orbitron/db/templateDao.js`
- Create: `orbitron/db/__tests__/templateDao.test.js`

- [ ] **Step 1: 테스트** (listActive = not deprecated, getByVersion)
- [ ] **Step 2: 구현 → PASS**
- [ ] **Step 3: 커밋 `feat: templateDao`**

### Task 1.6: 라우터 — slot CRUD

**파일:**
- Create: `orbitron/routes/psSlots.js`
- Modify: `orbitron/server.js` (마운트 `/api/projects/:projectId/ps-slots`)
- Create: `orbitron/routes/__tests__/psSlots.test.js`

- [ ] **Step 1: 테스트** (POST 필수 필드, 잘못된 template_version 400, 중복 name 409, admin 권한)
- [ ] **Step 2: 구현** (GET/POST/PATCH/DELETE, DELETE 에서 연관 이미지/DNS/파일 정리 훅은 Phase 4 에서 연결)
- [ ] **Step 3: PASS**
- [ ] **Step 4: 커밋 `feat: slot CRUD routes`**

### Task 1.7: 템플릿 라우터

**파일:**
- Create: `orbitron/routes/psTemplates.js`
- Modify: `orbitron/server.js`

- [ ] **Step 1: GET /api/ps-templates 테스트**
- [ ] **Step 2: 구현 (목록만, POST 는 Phase C)**
- [ ] **Step 3: 커밋 `feat: templates listing endpoint`**

### Task 1.8: 상수 & 설정

**파일:**
- Create: `orbitron/services/ps/constants.js`

```js
module.exports = {
    SUBDOMAIN_ROOT: 'ps.twinverse.org',
    PORT_RANGE: { min: 8081, max: 8999 },
    MAX_PLAYERS_PER_SLOT: 6,
    MAX_PLAYERS_HARD_CAP: 12,
    MAX_VERSIONS_PER_SLOT: 3,
    MAX_UPLOAD_BYTES: 20 * 1024 * 1024 * 1024,
    IDLE_SWEEP_INTERVAL_S: 30,
    SESSION_HEARTBEAT_INTERVAL_S: 30,
    SESSION_HEARTBEAT_GRACE_S: 90,
    DEFAULT_IDLE_TIMEOUT_S: 600,
    START_TIMEOUT_S: 90,
    STORAGE_ROOT: '/srv/pixelstreaming',
    GPU_HOST: '192.168.219.117',
    GPU_USER: 'stevenlim',
    GPU_SLOTS_ROOT: '/opt/ps-slots',
    IMAGE_NAMESPACE: 'twinverse/ps',
    GUEST_LINK_DEFAULT_EXPIRES_H: 24,
    GUEST_LINK_MAX_USES_DEFAULT: 10,
};
```

- [ ] **Step 1: 파일 작성**
- [ ] **Step 2: 커밋 `feat: PS platform constants`**

---

## Phase 2 — 업로드 (tus) + 매니페스트 검증

### Task 2.1: tus-node-server 마운트

**파일:**
- Modify: `orbitron/package.json` (`"tus-node-server": "^0.10"`)
- Create: `orbitron/services/ps/tusServer.js`
- Modify: `orbitron/server.js`

- [ ] **Step 1: `npm i tus-node-server`**
- [ ] **Step 2: Server 초기화, storage 디렉토리 = `${STORAGE_ROOT}/.tus-uploads/`**
- [ ] **Step 3: 업로드 크기 제한 (MAX_UPLOAD_BYTES) 미들웨어**
- [ ] **Step 4: `/api/uploads` 마운트 (인증 미들웨어 통과 후)**
- [ ] **Step 5: 커밋 `feat: tus-node-server mount`**

### Task 2.2: initiate/finalize 라우트

**파일:**
- Modify: `orbitron/routes/psSlots.js`

- [ ] **Step 1: 테스트** (initiate → upload_id 반환, 인증 필수, slot 존재 확인)
- [ ] **Step 2: 구현** — initiate 는 tus Create 프록시 + DB 에 ps_versions row 생성(status='uploading'), finalize 는 tus 완료 hook 후 build 파이프라인 트리거
- [ ] **Step 3: PASS**
- [ ] **Step 4: 커밋 `feat: upload initiate/finalize`**

### Task 2.3: extractor.js + 매니페스트 검증

**파일:**
- Create: `orbitron/services/ps/extractor.js`
- Create: `orbitron/services/ps/__tests__/extractor.test.js`

- [ ] **Step 1: 테스트 작성**
  - path traversal (zip 에 `..` 경로) → 거부
  - `template_manifest.json` 누락 → 거부
  - `template_version` 슬롯 설정과 불일치 → 거부
  - 필수 바이너리 `Package/Linux/<GameName>/Binaries/Linux/<GameName>-Linux-Shipping` 부재 → 거부
  - 정상 케이스 → `{manifest, packageDir}` 리턴
- [ ] **Step 2: FAIL**
- [ ] **Step 3: 구현** (`adm-zip` 기존 사용 중 활용, path 정규화 후 STORAGE_ROOT 벗어나지 않는지 검증)
- [ ] **Step 4: PASS**
- [ ] **Step 5: 커밋 `feat: extractor with manifest validation`**

### Task 2.4: SSE build-log 엔드포인트

**파일:**
- Modify: `orbitron/routes/psSlots.js`
- Create: `orbitron/services/ps/buildLogStream.js`

- [ ] **Step 1: EventEmitter 기반 로그 버스 (slotId,versionId 키)**
- [ ] **Step 2: GET build-log 라우트 → res.setHeader text/event-stream, 버스에 리스너 등록**
- [ ] **Step 3: 클라이언트 disconnect 시 정리**
- [ ] **Step 4: 테스트 (supertest + sse-stream)**
- [ ] **Step 5: 커밋 `feat: build log SSE stream`**

---

## Phase 3 — Docker 템플릿 + 이미지 빌드·전송

### Task 3.1: Dockerfile 템플릿 (6 스트리머)

**파일:**
- Create: `orbitron/templates/pixel-streaming/Dockerfile`

```dockerfile
FROM nvidia/cuda:12.6.0-base-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    xvfb ffmpeg curl ca-certificates libvulkan1 mesa-vulkan-drivers \
    nodejs npm \
 && rm -rf /var/lib/apt/lists/*

RUN curl -L https://github.com/EpicGamesExt/PixelStreamingInfrastructure/releases/download/v5.7/Wilbur-linux.tar.gz \
 | tar -xz -C /opt && mv /opt/Wilbur* /opt/wilbur

WORKDIR /app
COPY Package/ /app/Package/

ENV MAX_PLAYERS=6
ENV STREAMER_COUNT=6
ENV DISPLAY=:0
ENV TWINVERSE_ADMIN_KEY=""

EXPOSE 8080 8888-8893
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

- [ ] **Step 1: Dockerfile + entrypoint.sh 작성** (entrypoint: xvfb 기동 → Wilbur 기동 → UE5 Listen Server launch with `-PixelStreamingURL=ws://localhost:8888` 등 6 스트리머 URL)
- [ ] **Step 2: 빈 Package/ 로 docker build 테스트 (실패하지 않는지만 확인)**
- [ ] **Step 3: 커밋 `feat: multiplayer PS Dockerfile template`**

### Task 3.2: docker-compose 템플릿

**파일:**
- Create: `orbitron/templates/pixel-streaming/docker-compose.yml.tpl`

```yaml
services:
  ps:
    image: "{{IMAGE_TAG}}"
    container_name: "ps-{{SLOT_NAME}}"
    restart: on-failure:3
    runtime: nvidia
    read_only: true
    tmpfs:
      - /tmp
    environment:
      MAX_PLAYERS: "{{MAX_PLAYERS}}"
      TWINVERSE_ADMIN_KEY: "{{ADMIN_KEY}}"
    ports:
      - "{{CONTAINER_PORT}}:8080"
    deploy:
      resources:
        reservations:
          devices:
            - capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
      interval: 15s
      timeout: 5s
      retries: 6
```

- [ ] **Step 1: 템플릿 + 치환 헬퍼 작성**
- [ ] **Step 2: 커밋 `feat: compose template with GPU + read-only`**

### Task 3.3: imageBuilder.js

**파일:**
- Create: `orbitron/services/ps/imageBuilder.js`
- Create: `orbitron/services/ps/__tests__/imageBuilder.test.js`

- [ ] **Step 1: 테스트** (mock child_process, 성공 시 tag 반환, 실패 시 stderr 로그 포함 에러)
- [ ] **Step 2: 구현** — `buildImage({versionDir, imageTag, onLog})`. `docker build` 실시간 stdout/stderr → onLog 콜백 + ps_versions.build_log 누적
- [ ] **Step 3: PASS**
- [ ] **Step 4: 커밋 `feat: image builder with log streaming`**

### Task 3.4: imageTransfer.js (save | load)

**파일:**
- Create: `orbitron/services/ps/imageTransfer.js`

- [ ] **Step 1: 테스트 (mock ssh spawn, 3회 재시도)**
- [ ] **Step 2: 구현** — `transferToGpu(imageTag)`: `docker save ${tag} | ssh ${GPU_USER}@${GPU_HOST} 'docker load'`
- [ ] **Step 3: 커밋 `feat: image transfer via save|load pipe`**

### Task 3.5: remoteDeploy.js

**파일:**
- Create: `orbitron/services/ps/remoteDeploy.js`

- [ ] **Step 1: `deployToGpu({slot, imageTag, adminKey})`**:
  - compose yaml 렌더 → scp 로 `/opt/ps-slots/<slot>/docker-compose.yml`
  - 이전 컨테이너 `docker compose down`
  - on-demand: 이 시점엔 start 안 함
- [ ] **Step 2: 테스트 (mock ssh)**
- [ ] **Step 3: 커밋 `feat: remote deploy updater`**

### Task 3.6: 빌드 파이프라인 조립

**파일:**
- Create: `orbitron/services/ps/buildPipeline.js`

- [ ] **Step 1: `runBuild(versionId)`**: 상태 전이 `uploading → validating → building → ready`, 실패 시 `failed`. 각 단계마다 buildLogStream 에 publish
- [ ] **Step 2: finalize 훅에서 `runBuild(versionId)` 백그라운드 실행**
- [ ] **Step 3: E2E 테스트: 더미 zip(템플릿 샘플) 업로드 → ready 상태 도달 (staging)**
- [ ] **Step 4: 커밋 `feat: end-to-end build pipeline`**

---

## Phase 4 — 활성화 · 롤백 · DNS · Tunnel

### Task 4.1: activation.js (atomic symlink)

**파일:**
- Create: `orbitron/services/ps/activation.js`

- [ ] **Step 1: 테스트** (symlink 원자 교체, 기존 유지 · 롤백 시나리오)
- [ ] **Step 2: 구현** — `activateVersion(slot, versionId)`: 임시 심볼릭 생성 후 `rename()` 로 atomic 교체, `ps_slots.active_version` 업데이트, 구버전 FIFO 프룬 트리거
- [ ] **Step 3: 커밋 `feat: atomic version activation`**

### Task 4.2: rollback.js

**파일:**
- Create: `orbitron/services/ps/rollback.js`
- Modify: `orbitron/routes/psSlots.js` (activate endpoint)

- [ ] **Step 1: 테스트 (활성 버전과 같은 걸 activate 시도 idempotent, 잘못된 버전 400)**
- [ ] **Step 2: 구현 (activation.js 재사용)**
- [ ] **Step 3: 커밋 `feat: rollback endpoint`**

### Task 4.3: cloudflareDns.js

**파일:**
- Create: `orbitron/services/ps/cloudflareDns.js`

- [ ] **Step 1: 테스트 (nock 으로 CF API mock)**
- [ ] **Step 2: 구현** — `createCname(subdomain, tunnelTarget)`, `deleteCname(subdomain)`. 이미 존재 시 idempotent
- [ ] **Step 3: 커밋 `feat: Cloudflare DNS automation`**

### Task 4.4: cloudflaredIngress.js

**파일:**
- Create: `orbitron/services/ps/cloudflaredIngress.js`

- [ ] **Step 1: Phase 0 조사로 밝혀진 cloudflared 설정 파일 위치 사용**
- [ ] **Step 2: `addIngress(subdomain, gpuHost, gpuPort)` / `removeIngress(subdomain)` — yaml 파싱 · 수정 · SIGHUP**
- [ ] **Step 3: 테스트 (staging config 파일에 적용 후 rollback)**
- [ ] **Step 4: 커밋 `feat: cloudflared ingress management`**

### Task 4.5: 슬롯 생성 시 DNS/ingress 훅

**파일:**
- Modify: `orbitron/routes/psSlots.js`

- [ ] **Step 1: POST slot 성공 후 cloudflareDns + cloudflaredIngress 호출, 실패 시 slot row rollback**
- [ ] **Step 2: DELETE slot 에서 역순 정리**
- [ ] **Step 3: 테스트 + E2E (staging 서브도메인)**
- [ ] **Step 4: 커밋 `feat: wire DNS/ingress into slot lifecycle`**

---

## Phase 5 — 런타임 · 세션 · 큐

### Task 5.1: runtimeControl.js

**파일:**
- Create: `orbitron/services/ps/runtimeControl.js`

- [ ] **Step 1: 테스트 (mock ssh)**
- [ ] **Step 2: 구현**:
  - `startSlot(slot)`: ssh → docker compose up -d, 헬스폴링 (최대 START_TIMEOUT_S), ps_slots.state='running'
  - `stopSlot(slot)`: ssh → docker compose stop, state='stopped'
  - `statusSlot(slot)`: docker ps --filter + /healthz 조회
- [ ] **Step 3: 커밋 `feat: runtime control for slots`**

### Task 5.2: wilburClient.js — streamer 예약/해제

**파일:**
- Create: `orbitron/services/ps/wilburClient.js`

- [ ] **Step 1: Phase 0 Wilbur admin API 조사 결과 기반 구현**
- [ ] **Step 2: `reserveStreamer(slot, sessionId)` / `releaseStreamer(slot, streamerId)`**
- [ ] **Step 3: 실패 시 예외, 호출 측에서 세션 생성 rollback**
- [ ] **Step 4: 커밋 `feat: Wilbur streamer reservation client`**

### Task 5.3: joinService.js — join/leave

**파일:**
- Create: `orbitron/services/ps/joinService.js`
- Create: `orbitron/routes/psPublic.js`

- [ ] **Step 1: 테스트**
  - 로그인 유저 join → 슬롯 stopped 면 기동 → active 세션 생성
  - 6 active 상태에서 7번째 join → queued
  - 세션 leave → 큐 1명 승격, SSE 이벤트 발행
  - 게스트 링크 토큰 검증 실패 → 401
- [ ] **Step 2: 구현** (sessionDao + wilburClient + runtimeControl 조합, 전체 트랜잭션)
- [ ] **Step 3: 라우트 `POST /api/ps-slots/:slotId/join`, `POST /api/ps-sessions/:id/leave`, `POST /api/ps-sessions/:id/heartbeat`**
- [ ] **Step 4: 커밋 `feat: join/leave service with queue`**

### Task 5.4: 세션 이벤트 SSE

**파일:**
- Create: `orbitron/services/ps/sessionEventBus.js`
- Modify: `orbitron/routes/psPublic.js`

- [ ] **Step 1: sessionDao 변경 훅에서 EventBus 에 publish (queue_update, promoted, kicked)**
- [ ] **Step 2: `GET /api/ps-sessions/:id/events` SSE 엔드포인트**
- [ ] **Step 3: 테스트 (통합)**
- [ ] **Step 4: 커밋 `feat: session event SSE`**

### Task 5.5: idleSweeper + ghostSweeper

**파일:**
- Create: `orbitron/services/ps/sweepers.js`
- Modify: `orbitron/server.js` (setInterval 기동)

- [ ] **Step 1: 30초 주기**:
  - pruneGhostSessions (heartbeat 만료)
  - 슬롯별 active_count=0 이고 idle_timeout 경과 → stopSlot
  - pinned 제외
- [ ] **Step 2: 테스트 (시간 조작: sinon.useFakeTimers)**
- [ ] **Step 3: 커밋 `feat: idle + ghost session sweepers`**

### Task 5.6: 어드민 킥

**파일:**
- Modify: `orbitron/routes/psSlots.js`
- Modify: `orbitron/services/ps/joinService.js`

- [ ] **Step 1: `POST /api/projects/:pid/ps-slots/:sid/sessions/:sessionId/kick`**
- [ ] **Step 2: UE5 admin 엔드포인트 호출 (`POST http://gpu-host:port/admin/kick/:playerId` with X-Admin-Key)**
- [ ] **Step 3: DB session 제거 + SSE 'kicked' publish + 큐 승격**
- [ ] **Step 4: 커밋 `feat: admin kick endpoint`**

### Task 5.7: 게스트 링크

**파일:**
- Create: `orbitron/services/ps/guestLinks.js`
- Modify: `orbitron/routes/psSlots.js`

- [ ] **Step 1: HMAC 서명 토큰 (secret=JWT_SECRET), payload={slot_id, exp, uses_left}**
- [ ] **Step 2: CRUD 라우트 (`POST/GET/DELETE /api/projects/:pid/ps-slots/:sid/guest-links`)**
- [ ] **Step 3: joinService 에서 token 검증 경로 추가**
- [ ] **Step 4: 테스트 (만료, uses 소진, 폐기)**
- [ ] **Step 5: 커밋 `feat: guest link generation and validation`**

### Task 5.8: 공개 세션 상태 API

**파일:**
- Modify: `orbitron/routes/psPublic.js`

- [ ] **Step 1: `GET /api/public/projects/:slug/ps-slots` 에 active_count/queued_count 포함**
- [ ] **Step 2: `GET /api/public/projects/:slug/ps-slots/:name/session-state` SSE (카드 실시간 배지용)**
- [ ] **Step 3: Rate limit 60/min/IP**
- [ ] **Step 4: 커밋 `feat: public session state APIs`**

---

## Phase 6 — UI

### Task 6.1: Orbitron 대시보드 — 슬롯 목록/생성

**파일:**
- Create: `orbitron/public/src/pages/PsSlots/Index.*`
- Create: `orbitron/public/src/pages/PsSlots/CreateModal.*`
- Create: `orbitron/public/src/api/psSlots.js`

- [ ] **Step 1: 목록 테이블 (name, display, state badge, version, `N/6 · queueK`, subdomain, actions)**
- [ ] **Step 2: 새 슬롯 모달 (name, display, desc, thumbnail, max_players slider 1~12, template select, allow_guest_link)**
- [ ] **Step 3: 커밋 `feat: dashboard slot list + create`**

### Task 6.2: 슬롯 상세 — 메타/업로드/버전

**파일:**
- Create: `orbitron/public/src/pages/PsSlots/Detail.*`
- Create: `orbitron/public/src/components/PsUploader.*` (tus-js-client)

- [ ] **Step 1: 메타 편집 폼**
- [ ] **Step 2: tus 업로드 UI (진행바, 이어받기)**
- [ ] **Step 3: 빌드 로그 SSE 스트림 터미널 위젯**
- [ ] **Step 4: 버전 히스토리 + Rollback 버튼**
- [ ] **Step 5: 커밋 `feat: slot detail with uploader and build log`**

### Task 6.3: 세션 탭 + 킥 + 게스트 링크

**파일:**
- Modify: `orbitron/public/src/pages/PsSlots/Detail.*`
- Create: `orbitron/public/src/pages/PsSlots/SessionsPanel.*`
- Create: `orbitron/public/src/pages/PsSlots/GuestLinksPanel.*`

- [ ] **Step 1: 세션 패널 (active N/max + queue K) + Kick 버튼**
- [ ] **Step 2: 실시간 업데이트 (공개 SSE 재사용 또는 관리자 SSE)**
- [ ] **Step 3: 게스트 링크 패널 (발급 폼, 목록, 만료/폐기)**
- [ ] **Step 4: 커밋 `feat: sessions and guest link panels`**

### Task 6.4: 런타임 컨트롤 + idle_timeout

**파일:**
- Modify: `orbitron/public/src/pages/PsSlots/Detail.*`

- [ ] **Step 1: ▶ Start (강제) / ■ Stop (세션 전원 강퇴 확인 모달) 버튼**
- [ ] **Step 2: idle_timeout 슬라이더 (60~3600)**
- [ ] **Step 3: 커밋 `feat: runtime controls`**

### Task 6.5: TwinverseAI 랜딩 `/pixel-streaming` — **Track A (내부 작업)**

> Orbitron 개발 AI 는 이 Task 를 수행하지 않습니다. Track A (TwinverseAI 프론트엔드) 에서 Orbitron 공개 API 를 호출하여 구현합니다.


**파일:**
- Create: `frontend/src/pages/PixelStreaming/Index.tsx`
- Create: `frontend/src/pages/PixelStreaming/SlotCard.tsx`
- Create: `frontend/src/pages/PixelStreaming/JoinFlow.tsx`
- Modify: `frontend/src/App.tsx` (라우트)
- Modify: `frontend/src/components/Landing/Menu.tsx` (메뉴 항목)

- [ ] **Step 1: 공개 API 호출 + 카드 그리드 (썸네일, display, "N/6 · Q") 실시간 SSE**
- [ ] **Step 2: Play 버튼 → JoinFlow 모달**:
  - 미로그인 & login_required → redirect to /login
  - 미로그인 & guest_link_allowed & ?gl= 토큰 → 게스트 이름 입력 → POST /join
  - 로그인 → 바로 POST /join
- [ ] **Step 3: queued 시 "대기 순번 N / 최대 Q" 표시, SSE 로 promotion 시 자동 스트리밍 페이지로**
- [ ] **Step 4: 커밋 `feat: landing pixel-streaming page`**

### Task 6.6: 스트리밍 플레이어 페이지 — **Track A (내부 작업)**


**파일:**
- Create: `frontend/src/pages/PixelStreaming/Player.tsx`
- Create: `frontend/src/pages/PixelStreaming/usePixelStreaming.ts`

- [ ] **Step 1: PS2 WebRTC 클라이언트 (@epicgames-ps/lib-pixelstreamingfrontend-ue5.7)**
- [ ] **Step 2: 풀스크린, 상단 바 (슬롯명, N/6, 나가기)**
- [ ] **Step 3: 마이크 권한 요청 후 근접 음성 up-link**
- [ ] **Step 4: 언로드 시 `sendBeacon('/leave')`, 30초 heartbeat**
- [ ] **Step 5: 커밋 `feat: pixel streaming player page`**

---

## Phase 7 — 마이그레이션 · Cutover

### Task 7.1: 기존 `/opt/twinverse-ps2` 백업

**파일:**
- Create: `scripts/backup-twinverse-ps2.sh`

- [ ] **Step 1: twinverse-ai 에서 `/opt/twinverse-ps2/` 전체 tarball**
- [ ] **Step 2: `/srv/backups/twinverse-ps2-20260415.tar.gz`**
- [ ] **Step 3: 커밋**

### Task 7.2: 현행 UE5 빌드를 템플릿 기반으로 포팅 — **Track A (내부 작업)**


**파일:**
- (template repo 작업)

- [ ] **Step 1: TwinverseDesk 현재 PCG_Study_Modern 맵을 템플릿 레포 fork 에 이식**
- [ ] **Step 2: 리슨 서버 호환 수정 (Replicated 엑터, 플레이어 스폰 포인트)**
- [ ] **Step 3: Linux 패키지 → zip 준비**

### Task 7.3: `office` 슬롯 생성 + 업로드

- [ ] **Step 1: Orbitron UI 에서 `office` 슬롯 생성 (max=6, allow_guest_link=false, template=v1.0.0)**
- [ ] **Step 2: 포팅된 zip 업로드 → ready 확인**
- [ ] **Step 3: 1인 join → 이동/카메라 확인**
- [ ] **Step 4: 2인 join → 서로 보임/채팅/이모트 확인**
- [ ] **Step 5: 6인 join → FPS 측정, 7번째 join → 큐 동작 확인**

### Task 7.4: 하위호환 리다이렉트

**파일:**
- Modify: cloudflared 설정

- [ ] **Step 1: `ps.twinverse.org` → `office.ps.twinverse.org` 301**
- [ ] **Step 2: 기존 `ps2.twinverse.org` 는 Phase 7 종료 시 제거**

### Task 7.5: 구 배포 철거

- [ ] **Step 1: Orbitron project 27 (twinverse-ps2) 삭제**
- [ ] **Step 2: twinverse-ai 에서 `/opt/twinverse-ps2/` 제거 (백업 확인 후)**
- [ ] **Step 3: cloudflared 에서 `ps2.*`, `ps2-api.*` ingress 제거 + SIGHUP**
- [ ] **Step 4: `TwinversePS2-Deploy` GitHub archive**

### Task 7.6: TwinverseAI 랜딩 메뉴 공개

- [ ] **Step 1: 랜딩 네비에 "Pixel Streaming" 활성화**
- [ ] **Step 2: 퍼블릭 QA (게스트 링크 1개 발급 테스트)**
- [ ] **Step 3: 커밋 `feat: launch pixel-streaming menu`**

---

## Self-Review

### Spec 커버리지
- 스펙 섹션 2 아키텍처 → Phase 0.5 (UE5 셸) + Phase 3 (컨테이너) + Phase 5 (세션/큐) 전부 커버.
- 스펙 섹션 3 데이터 모델 → Task 1.1 SQL 에 ps_slot_templates / ps_slots / ps_versions / ps_sessions 전부 포함.
- 스펙 섹션 4 API 계약 → Phase 1~5 라우트로 전부 매핑.
- 스펙 섹션 5 오케스트레이션 → Phase 3 빌드 + Phase 4 활성화/DNS + Phase 5 join/큐/스위퍼.
- 스펙 섹션 6 UI → Phase 6 Orbitron 대시보드 + 랜딩.
- 스펙 섹션 7 보안 → 각 Task 에 검증 조건 명시 (path traversal, 게스트 링크 HMAC, read-only 컨테이너).
- 스펙 섹션 8 테스트 → 각 서비스 모듈 `__tests__` + E2E(Task 3.6, 7.3).
- 스펙 섹션 9 롤아웃 → Phase 7 체크리스트와 1:1.
- 스펙 섹션 11 열린 질문 → Phase 0 에 매핑.
- 스펙 부록 B 템플릿 기능 → Task 0.5.3~0.5.10 에 1:1.

### 타입/네이밍 일관성
- `ps_slot_templates.version` (문자열) · `ps_slots.template_version` 참조 — 매칭.
- `ps_sessions.state` 값 `queued|active` 전역 고정.
- 서비스 함수명: `runtimeControl.startSlot/stopSlot/statusSlot`, `joinService.join/leave/heartbeat/kick`, `sessionDao.createActive/createQueued/promoteFirstQueued/removeSession/pruneGhostSessions/heartbeat` — 전 Phase 에서 일관 사용.
- 상수: `MAX_PLAYERS_PER_SLOT=6`, `SESSION_HEARTBEAT_GRACE_S=90`, `START_TIMEOUT_S=90` — 코드 전반 상수 import.

### 플레이스홀더 없음
모든 step 이 구체 파일 경로 · 명시된 로직 · 테스트 조건을 포함. "적절한 에러 처리" 같은 모호 표현 없음.

---

## 핸드오프 안내

이 계획은 **외부 Orbitron 개발 AI/개발자 전달용**이며, Phase 0 조사 완료 → Steven 승인 게이트를 거쳐야 Phase 0.5 (템플릿 레포) 착수 가능합니다.

Phase 0.5 는 UE5 작업이므로 Orbitron 개발자만으로는 진행 불가 — Steven 또는 별도 UE5 엔지니어가 병행해야 합니다. 두 Phase 는 병렬로 진행 가능:

- Orbitron 개발: Phase 1~5 백엔드는 템플릿 없어도 스키마/API/세션 관리 작업 가능
- UE5 개발: Phase 0.5 템플릿 독립 작업

Phase 6 (UI) 는 백엔드 API 확정 후, Phase 7 (cutover) 는 양쪽 모두 완료 후 진행.
