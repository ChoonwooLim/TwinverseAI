# OpenClaw 관리 콘솔 운영 가이드

**접근 권한**: admin / superadmin
**경로**: `/admin/openclaw-console` (탭: 에이전트 · 플러그인 · 설정 · 채팅 · 로그)
**대상 인스턴스**: twinverse-ai (192.168.219.117) 의 LAN OpenClaw 컨테이너
**게이트웨이**: `wss://openclaw.twinverse.org` (Cloudflare Tunnel → port 18789)

## 아키텍처

```
Browser (admin JWT)
  │ REST + WSS (same origin)
  ▼
TwinverseAI FastAPI backend
  ├─ REST  /api/admin/openclaw/console/{agents,plugins,config,rpc,...}
  │   └─ paramiko SSH → docker exec openclaw openclaw <cmd>
  ├─ WS    /api/admin/openclaw/console/chat   ← first-msg JWT auth, relay to OpenClaw WS
  └─ WS    /api/admin/openclaw/console/logs   ← docker logs -f (SSH)
  ▼
twinverse-ai (192.168.219.117)
  ├─ OpenClaw gateway ws://localhost:18789 → wss://openclaw.twinverse.org
  └─ CLI  docker exec openclaw openclaw <subcommand>
```

## 환경변수 (`backend/.env`)

| 키 | 용도 |
|---|---|
| `OPENCLAW_WS_URL` | 백엔드→게이트웨이 내부 WS URL (LAN 직접 연결 권장) |
| `OPENCLAW_TOKEN` | 게이트웨이 bearer 토큰 (백엔드만 보유, 브라우저 노출 금지) |
| `OPENCLAW_SSH_HOST/USER/PASSWORD` | twinverse-ai SSH 접속 |
| `OPENCLAW_CONTAINER` | `openclaw` (기본값) |

**보안 규칙**
- `OPENCLAW_TOKEN` 은 프론트엔드 번들에 절대 들어가면 안 됨 (CI 에서 grep 검증)
- WS 응답에서 `token`, `apiKey`, `secret`, `password` 등 필드는 서버에서 strip
- REST config 조회 시 같은 패턴의 값은 `***<마지막4자>` 로 마스킹

## 재시작 회피 설계 (중요)

`docker restart openclaw` 은 entrypoint 의 "Fixing data permissions" 가 `openclaw.json`
을 재생성 → 토큰 로테이트. 콘솔은 이를 절대 유발하지 않도록 아래 규칙을 따른다:

| 작업 | 방법 | 재시작? |
|---|---|---|
| 에이전트 생성 | `openclaw agents add --id ... --name ... --model ...` | **아니오** (plugin slot 미추가) |
| 에이전트 삭제 | `openclaw agents delete <id> --yes` | ⚠️ **상황 따라 예** — 2026-05-01 회귀: agents.delete 가 `commands.ownerDisplay` / 일부 `plugins.entries.*.config` 변경을 동반해 SIGUSR1 → full process restart 트리거. 운영 중에는 가능하면 회피하거나 사용자가 적은 시간대에 수행. |
| 에이전트 이름/테마/이모지 | `openclaw agents set-identity` | 아니오 |
| 에이전트 모델 | `gateway call agents.update {model}` | 아니오 |
| 에이전트 IDENTITY.md | `gateway call agents.files.set` | 아니오 |
| 플러그인 on/off | `config set plugins.entries.<id>.enabled=bool` (+SIGUSR1 reload) | 아니오 |
| 플러그인 config | `config set --batch-file --strict-json --dry-run` → 실제 적용 | 아니오 |
| 전역 config | 동일 (dry-run 선행) | 아니오 |
| 금지 | `docker restart openclaw`, RPC `agents.create` (plugin slot 추가) | **예 — 금지** |

**재시작 시 발생하는 영향**: 모든 기존 WS 연결이 끊김 (TwinverseAI 백엔드의 `chat_ws` 세션, DeskRPG 의 OpenClaw 게이트웨이 세션 포함). 클라이언트 자동 재연결이 항상 보장되지는 않으므로 사용자는 새로고침이 필요할 수 있다. 2026-05-01 인시던트에서 agents.delete 가 트리거한 재시작이 Windows admin 채팅을 갑자기 끊어 사용자 panic 을 유발했다 (재발 방지: 다음 시도 전 사용자 공지 + DeskRPG/TwinverseAI 양쪽 reconnect 로직 강화).

## 부트스트랩 강제 덮어쓰기 동작 (2026-04-29 회귀로 학습)

`/hostinger/server.mjs` 의 함수 `j()` 가 컨테이너 시작 시마다 `openclaw.json` 의
일부 키를 환경변수 기반으로 강제 갱신한다. 다음 키는 사용자가 `config set` 해도
재시작/재생성 시 되돌아간다:

| 키 | `TRAEFIK_HOST` 미설정 (현재 운영값) | `TRAEFIK_HOST` 설정 |
|---|---|---|
| `gateway.controlUi.dangerouslyDisableDeviceAuth` | `true` 강제 | **delete** (안전 기본값) |
| `gateway.controlUi.allowInsecureAuth` | `true` 강제 | **delete** |
| `gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback` | `true` 강제 | **delete** |
| `gateway.trustedProxies` | `["127.0.0.1/32"]` 강제 | **delete** |

### ⚠️ TRAEFIK_HOST 사용 금지 (현재 환경)

처음에는 보안 강화를 위해 `TRAEFIK_HOST=openclaw.twinverse.org` 를 추가해서 dangerous
플래그를 끄려 했으나, **device 인증이 켜지면 TwinverseAI 백엔드(Python websockets)가
controlUi WebSocket 연결을 device 페어링으로 강제당해 거부됨** (1008 close, "control ui
requires device identity"). 동시에 `gateway.trustedProxies` 도 함께 삭제되어 wrapper
loopback 연결이 "외부 클라이언트"로 분류되어 device 페어링 요건을 더욱 강화시켰다.

**결론**: 현재 wrapper Express + Cloudflare Tunnel 더블 프록시 구조에서는
`TRAEFIK_HOST` 를 설정하면 안 된다. 보안 강화는 다른 방향으로 풀어야 한다 (예: 백엔드를
device 로 페어링, 또는 controlUi 가 아닌 RPC 경로로 연결).

`audit` 의 "Reverse proxy headers are not trusted" WARN 은 wrapper Express 가
X-Forwarded 헤더를 strip 해서 보내는 우리 환경에선 의미 없음 (무시).

### 보안 critical 잔존 (다음 세션 처리)

`openclaw security audit` 결과 critical 3 개가 그대로 남아 있다. 처리는 별도 세션에서
controlUi 우회 없이 푸는 방식으로 계획.

## 주요 REST 엔드포인트

```
GET    /api/admin/openclaw/console/health
GET    /api/admin/openclaw/console/agents
POST   /api/admin/openclaw/console/agents            {id, displayName, model, systemPrompt?}
DELETE /api/admin/openclaw/console/agents/{id}
PATCH  /api/admin/openclaw/console/agents/{id}       {displayName?, model?, theme?, emoji?, systemPrompt?}
GET    /api/admin/openclaw/console/agents/{id}/files
GET    /api/admin/openclaw/console/agents/{id}/files/{name}
PUT    /api/admin/openclaw/console/agents/{id}/files/{name}   {content}

GET    /api/admin/openclaw/console/plugins
GET    /api/admin/openclaw/console/plugins/{id}
POST   /api/admin/openclaw/console/plugins/{id}/enable
POST   /api/admin/openclaw/console/plugins/{id}/disable
GET    /api/admin/openclaw/console/plugins/{id}/config
PUT    /api/admin/openclaw/console/plugins/{id}/config        {config, dryRun?}

GET    /api/admin/openclaw/console/config?key=...
GET    /api/admin/openclaw/console/config/schema
PUT    /api/admin/openclaw/console/config                     {pairs, dryRun?}
GET    /api/admin/openclaw/console/config/audit?lines=50

POST   /api/admin/openclaw/console/rpc                        {method, params}   # allowlisted methods only
```

## WebSocket 엔드포인트

**공통**: 첫 프레임은 반드시 `{"op":"auth","token":"<jwt>"}` — 실패 시 `close(4401)` / `close(4403)`.

### `/chat` — JSON-RPC 릴레이
- 서버는 OpenClaw 게이트웨이에 Authorization 헤더로 토큰 부착
- 클라이언트는 표준 JSON-RPC envelope 전송: `{id, method, params}`
- 허용 메서드 예: `sessions.create`, `sessions.send`, `sessions.messages.subscribe`, `agents.list`, `chat.history`
- 응답 메시지에서 `token`/`apiKey`/`secret` 등 필드는 자동 strip

### `/logs` — 로그 스트리밍
- 서버가 SSH 채널로 `docker logs -f --tail 200 openclaw` 실행
- 라인별로 `{op:"log.line", stream:"stdout|stderr", line:"..."}` 푸시
- 클라이언트 연결 해제 시 SSH 채널 자동 종료

## 배포 체크리스트 (Orbitron)

- [ ] Orbitron 대시보드에 `OPENCLAW_TOKEN`, `OPENCLAW_SSH_PASSWORD` secrets 등록
- [ ] Orbitron 배포본 컨테이너 → twinverse-ai SSH 접근 가능한지 확인
- [ ] `wss://twinverseai.twinverse.org/api/admin/openclaw/console/chat` 직접 연결 테스트
- [ ] 번들(`dist/`) 에 토큰 grep 0건 확인 (CI)

## 트러블슈팅

| 증상 | 원인 / 조치 |
|---|---|
| 콘솔 접속 시 "Gateway 응답 없음" | `ssh twinverse-ai docker ps` 로 openclaw 컨테이너 live 확인. `systemctl status cloudflared`. |
| 채팅 `sessions.send` 실패 (`must have required property 'key'`) | 먼저 `sessions.create` 로 key 발급 필요. 자동 처리되지만 에이전트 id 잘못 지정 시 실패 |
| 플러그인 config 저장 시 `dry-run failed` | `--strict-json` 파싱 오류. JSON 형식 재확인, `config schema <plugin-id>` 참고 |
| 로그가 흐르지 않음 | SSH 연결 정상인데 stdout 없음 → `docker logs openclaw` 직접 실행해 비교 |
| 콘솔 작업 후 디바이스 페어링 끊김 | `docker restart` 유발된 것. audit log 확인, 해당 작업 재발 방지 |
