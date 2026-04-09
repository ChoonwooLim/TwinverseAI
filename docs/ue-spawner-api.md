# PS2 Spawner API 레퍼런스

> 유저별 독립 UE5 인스턴스를 생성/관리하는 백엔드 API

## 개요

PS2 Spawner는 TwinverseAI 백엔드에 통합된 서비스로, 웹사이트에서 버튼 클릭 한 번으로 독립 UE5 Pixel Streaming 인스턴스를 생성합니다.

## API 엔드포인트

### 사용자 API

| Method | Path | 인증 | Rate Limit | 설명 |
|--------|------|------|-----------|------|
| `POST` | `/api/ps2/spawn` | JWT 필수 | 3/분 | 새 UE5 인스턴스 생성 |
| `GET` | `/api/ps2/status/{session_id}` | JWT 필수 | 30/분 | 세션 상태 조회 |
| `POST` | `/api/ps2/heartbeat/{session_id}` | JWT 필수 | 60/분 | 세션 활성 유지 |
| `POST` | `/api/ps2/terminate/{session_id}` | JWT 필수 | 5/분 | 세션 종료 |
| `GET` | `/api/ps2/sessions` | JWT 필수 | 10/분 | 내 활성 세션 목록 |
| `GET` | `/api/ps2/health` | 없음 | 10/분 | 스포너 상태 (공개) |

### 관리자 API

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| `GET` | `/api/ps2/admin/sessions` | Admin | 전체 활성 세션 목록 |
| `POST` | `/api/ps2/admin/terminate/{session_id}` | Admin | 강제 종료 |
| `GET` | `/api/ps2/server/status` | 없음 | Wilbur/PS2 서버 상태 |
| `POST` | `/api/ps2/server/start` | JWT 필수 | 서버 시작 |

## Spawn 요청/응답

### Request

```json
POST /api/ps2/spawn
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "map": "/Game/Maps/NewYork"   // 선택적, 기본값: /Game/PCG/PCG_Study_Modern
}
```

### Response

```json
{
  "session_id": "session_abc123def456",
  "streamer_id": "session_abc123def456",
  "player_url": "https://ps2.twinverse.org?StreamerId=session_abc123def456",
  "status": "starting"
}
```

## 세션 라이프사이클

```
spawn 요청
    │
    ▼
[starting] ──(10초 경과 + 프로세스 살아있음)──▶ [running]
    │                                              │
    │ (프로세스 죽음)                                │ (heartbeat 정상)
    ▼                                              │
[error] ◀──────(heartbeat 90초 타임아웃)───────────┘
    │                                              │
    │                                     (terminate 요청)
    │                                              │
    └──────────────────────────────────────▶ [stopped]
```

### 상태 전이

| 상태 | 설명 | 전이 조건 |
|------|------|----------|
| `starting` | UE5 프로세스 시작됨, 아직 준비 안 됨 | spawn 직후 |
| `running` | 정상 실행 중, 스트리밍 가능 | starting + 10초 + 프로세스 alive |
| `stopped` | 정상 종료됨 | terminate 요청 또는 heartbeat 타임아웃 |
| `error` | 오류로 종료됨 | 프로세스 비정상 종료 |

## 핵심 로직

### Idempotent Spawn

같은 유저가 spawn을 여러 번 호출해도 기존 활성 세션을 반환합니다. 단, **맵이 다르면** 기존 세션을 종료하고 새로 생성합니다.

```python
# 같은 맵 → 기존 세션 반환
# 다른 맵 → 기존 세션 종료 → 새 세션 생성
if existing.map_path == effective_map:
    return existing  # 재사용
else:
    _kill_process(existing.pid)  # 기존 종료
    # 새 세션 생성...
```

### 좀비 프로세스 정리

```python
# 매 spawn 시 실행
cleanup_stale_sessions(db)
# - PID가 존재하지 않는 세션 → stopped
# - heartbeat가 90초 이상 없는 세션 → stopped + 프로세스 kill
```

### UE5 실행 커맨드

```python
# 패키지 빌드
cmd = [
    "C:\\WORK\\TwinverseDesk\\Package\\Windows\\TwinverseDesk.exe",
    "-PixelStreamingConnectionURL=ws://127.0.0.1:8888",
    "-PixelStreamingID=session_abc123",
    "-MapOverride=/Game/Maps/NewYork",
    "-RenderOffScreen",
    "-ResX=1280", "-ResY=720", "-ForceRes",
    "-AudioMixer", "-Unattended", "-NoPause", "-log",
]
```

## DB 모델 (PS2Session)

```
┌──────────────────────────────────────┐
│            ps2session                 │
├──────────────────────────────────────┤
│ id             │ int (PK, auto)      │
│ session_id     │ str (unique, index) │
│ user_id        │ int (FK → user.id)  │
│ streamer_id    │ str (unique)        │
│ status         │ str                 │
│ pid            │ int (nullable)      │
│ map_path       │ str (nullable)      │
│ player_url     │ str                 │
│ last_heartbeat │ datetime            │
│ created_at     │ datetime            │
│ updated_at     │ datetime            │
│ stopped_at     │ datetime (nullable) │
│ error_message  │ str (nullable)      │
└──────────────────────────────────────┘
```

## 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `UE_PACKAGED_PATH` | `C:\WORK\TwinverseDesk\Package\Windows\TwinverseDesk.exe` | 패키지 빌드 경로 |
| `UE_EDITOR_PATH` | `D:\Program Files\UE_5.7\...` | 에디터 경로 (패키지 없을 때) |
| `UE_MAP` | `/Game/PCG/PCG_Study_Modern` | 기본 맵 |
| `PS2_MAX_INSTANCES` | `3` | 최대 동시 인스턴스 |
| `PS2_HEARTBEAT_TIMEOUT` | `90` | heartbeat 타임아웃 (초) |
| `WILBUR_SIGNALING_URL` | `ws://127.0.0.1:8888` | Wilbur WebSocket URL |
| `WILBUR_PLAYER_URL` | `http://localhost:8080` | Wilbur Player URL |
| `WILBUR_PLAYER_EXTERNAL_URL` | `https://ps2.twinverse.org` | 외부 접근 URL |

## 프론트엔드 연동

```javascript
// ps2api.js — PS2 전용 API 클라이언트
const PS2_API_URL = import.meta.env.VITE_PS2_API_URL
  || (import.meta.env.PROD ? "https://ps2-api.twinverse.org" : "");

// DeskLaunch.jsx — spawn 호출
const res = await ps2api.post("/api/ps2/spawn", { map: selectedLevel.map });
```
