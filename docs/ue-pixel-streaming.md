# Pixel Streaming 2 아키텍처

> TwinverseDesk의 핵심 기술 — UE5.7 Pixel Streaming 2 기반 원격 스트리밍 파이프라인

## 개요

Pixel Streaming 2는 UE5 인스턴스를 GPU 서버에서 렌더링하고, WebRTC를 통해 웹 브라우저로 실시간 스트리밍하는 기술입니다. 사용자는 고사양 PC 없이 웹 브라우저만으로 AAA급 3D 환경을 경험할 수 있습니다.

## 시스템 구조

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  웹 브라우저      │────▶│  Wilbur 서버     │────▶│  UE5 인스턴스    │
│  (WebRTC Client) │◀────│  (Signaling)     │◀────│  (GPU 렌더링)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                        Port 8080 (Player)
                        Port 8888 (Streamer)
```

### 구성 요소

| 구성 요소 | 역할 | 포트 |
|-----------|------|------|
| **Wilbur Signaling Server** | WebRTC 연결 중개 (SDP/ICE 교환) | 8080 (Player), 8888 (Streamer) |
| **UE5 Instance** | GPU 렌더링 + 비디오/오디오 인코딩 | 동적 할당 |
| **Web Browser** | WebRTC 수신 + 입력 전송 | - |

## UE5.7 커맨드라인 인자

> **중요**: UE5.7에서 PS2 커맨드라인 인자 이름이 변경되었습니다.

### CVar → CLI 매핑 규칙

UE5.7의 `PixelStreaming2PluginSettings.cpp`에서 다음 변환 규칙이 적용됩니다:

```cpp
// 소스: PixelStreaming2PluginSettings.cpp:103
InCVarName.Replace(TEXT("."), TEXT(""))
          .Replace(TEXT("PixelStreaming2"), TEXT("PixelStreaming"))
```

### 주요 인자

| CVar (설정 변수) | CLI 인자 (커맨드라인) | 설명 |
|-----------------|---------------------|------|
| `PixelStreaming2.ID` | `-PixelStreamingID` | 스트리머 고유 ID |
| `PixelStreaming2.ConnectionURL` | `-PixelStreamingConnectionURL` | Wilbur 시그널링 서버 WebSocket URL |

> **주의**: 이전 버전의 `-PixelStreamingSignallingURL`, `-PixelStreaming2.ID`는 더 이상 사용되지 않습니다.

### 실행 예시

```bash
# 패키지 빌드
TwinverseDesk.exe -PixelStreamingConnectionURL=ws://127.0.0.1:8888 -PixelStreamingID=session_abc123 -RenderOffScreen -ResX=1280 -ResY=720

# 에디터 모드
UnrealEditor.exe TwinverseDesk.uproject /Game/PCG/PCG_Study_Modern -game -PixelStreamingConnectionURL=ws://127.0.0.1:8888 -PixelStreamingID=session_abc123
```

## DefaultEngine.ini 설정

```ini
[/Script/PixelStreaming2.PixelStreaming2Settings]
bAutoStart=True
DefaultStreamerID=TwinverseDesk
SignalingServerPort=8888
PlayerPort=80
```

## Wilbur 시그널링 서버

Wilbur는 UE5.7에 내장된 Node.js 기반 WebRTC 시그널링 서버입니다.

**위치**: `{UE5 설치 경로}/Engine/Plugins/Media/PixelStreaming2/Resources/WebServers/SignallingWebServer/`

```bash
# 실행 명령
node dist/index.js --serve --http_root www --streamer_port 8888 --player_port 8080
```

### Player URL 형식

```
https://ps2.twinverse.org?StreamerId=session_abc123
```

`StreamerId` 파라미터로 특정 UE5 인스턴스에 1:1 연결됩니다.

## 멀티 인스턴스 구조

현재 TwinverseDesk는 유저별 독립 UE5 인스턴스를 생성합니다:

```
User A → session_abc → UE5 Process (PID 1234) → Wilbur StreamerId=session_abc
User B → session_def → UE5 Process (PID 5678) → Wilbur StreamerId=session_def
User C → session_ghi → UE5 Process (PID 9012) → Wilbur StreamerId=session_ghi
```

- **최대 동시 인스턴스**: 3개 (환경변수 `PS2_MAX_INSTANCES`로 조절)
- **하트비트 타임아웃**: 90초 (프론트엔드에서 30초마다 heartbeat 전송)
- **좀비 프로세스 자동 정리**: psutil 기반 PID 모니터링

## 외부 접근 (Cloudflare Tunnel)

| 외부 도메인 | 내부 포트 | 용도 |
|------------|----------|------|
| `ps2-api.twinverse.org` | localhost:8000 | Backend API (세션 관리) |
| `ps2.twinverse.org` | localhost:8080 | Wilbur Player (WebRTC 스트림) |

Tunnel 설정: `C:\Users\choon\.cloudflared\config.yml`
