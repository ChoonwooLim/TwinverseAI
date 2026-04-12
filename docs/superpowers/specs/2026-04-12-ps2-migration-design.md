# Pixel Streaming GPU 서버 이전 설계

> 2026-04-12 | PS2 (Windows) → twinverse-ai (Linux) 이전

## 배경

현재 Pixel Streaming은 PS2 Windows GPU PC에서 운영 중이다.
파워 교체 이슈 등 하드웨어 안정성 문제와 개발/운영 분리를 위해
twinverse-ai Linux 서버 (RTX 3090, 192.168.219.117)로 이전한다.

## 아키텍처

### 역할 분리

| 서버 | 역할 |
|------|------|
| PS2 Windows PC | 개발/패키징 전용 (UE5 에디터, Linux 크로스 컴파일) |
| Orbitron (192.168.219.101) | 빌드 오케스트레이터 (Docker build → 원격 배포) |
| twinverse-ai (192.168.219.117) | GPU 렌더링 전용 워커 (Pixel Streaming 프로덕션) |

### 배포 파이프라인

```
개발자 PC: UE5 Linux 패키징 → TwinversePS2-Deploy/build/ 복사 → git push main
    ↓
Orbitron: 감지 → docker build → docker save | ssh → twinverse-ai
    ↓
twinverse-ai: docker load → docker compose up --gpus all → 헬스체크
    ↓
Cloudflare Tunnel: ps2-api.twinverse.org / ps2.twinverse.org
```

### 전체 구성도

```
┌─ 개발자 PC (Windows) ─────────────────────────────────────┐
│  UE5 Editor → Package (Linux) → build/ → git push main    │
└──────────────────────────────────┬─────────────────────────┘
                                   ▼
                            ┌─ GitHub ─────────────┐
                            │ TwinversePS2-Deploy   │
                            └──────┬───────────────┘
                                   ▼
┌─ Orbitron (192.168.219.101) ──────────────────────────────┐
│  git pull → docker build → SSH 전송 → 원격 배포            │
│  (기존: TwinverseAI 웹앱 + PostgreSQL 호스팅 유지)         │
└──────────────────────────────────┬─────────────────────────┘
                                   ▼
┌─ twinverse-ai (192.168.219.117) ──────────────────────────┐
│  Docker Container (--gpus all, RTX 3090):                  │
│  ├── UE5 Linux Build (렌더링)                              │
│  ├── Wilbur (WebRTC 시그널링, 8080/8888)                   │
│  └── PS2 Backend (스포너 API, 9000)                        │
│                                                            │
│  Cloudflare Tunnel:                                        │
│  ├── ps2-api.twinverse.org → :9000                         │
│  └── ps2.twinverse.org     → :8080                         │
│                                                            │
│  기존 서비스 (공존):                                        │
│  ├── Ollama (11434)                                        │
│  └── AI Image Service (8100)                               │
└────────────────────────────────────────────────────────────┘
```

## TwinversePS2-Deploy 리포 구조

```
ChoonwooLim/TwinversePS2-Deploy (Private)
├── build/                          # UE5 Linux 패키지 (Git LFS)
│   ├── TwinverseDesk               # Linux 실행파일
│   └── TwinverseDesk/              # Content, Config, 에셋
├── wilbur/                         # Pixel Streaming 2 시그널링 서버
│   ├── package.json
│   ├── dist/
│   └── www/
├── backend/                        # PS2 전용 백엔드
│   ├── ps2_server.py               # FastAPI (port 9000)
│   ├── services/
│   │   ├── ps2_service.py          # Linux 호환 스포너
│   │   ├── ps2_dedicated_service.py
│   │   └── ps2_launcher.py
│   ├── models/
│   │   ├── ps2_session.py
│   │   └── ps2_dedicated_server.py
│   └── requirements.txt
├── scripts/
│   ├── deploy-to-gpu.sh            # Orbitron → twinverse-ai 배포
│   ├── healthcheck.sh
│   └── entrypoint.sh               # Wilbur + Backend 동시 기동
├── tunnel/
│   └── config.yml                  # Cloudflare Tunnel
├── Dockerfile                      # CUDA + Node + Python 멀티스테이지
├── docker-compose.yml              # --gpus all, 포트, 볼륨
├── Orbitron.yaml
├── .gitattributes                  # LFS 규칙
└── .gitignore
```

## Dockerfile

멀티스테이지 빌드:

1. **Stage 1 (node:20-slim)**: Wilbur npm ci
2. **Stage 2 (nvidia/cuda:13.0.0-runtime-ubuntu24.04)**: CUDA 런타임 + Vulkan + Python 3.12 + Node.js + UE5 빌드

컨테이너 내부 구조:
- `/opt/ue5/` — UE5 Linux 빌드
- `/opt/wilbur/` — Wilbur 시그널링 서버
- `/opt/backend/` — PS2 Backend + venv
- `/entrypoint.sh` — Wilbur (백그라운드) + uvicorn (포그라운드)

포트: 8080 (Wilbur Player), 8888 (Wilbur Signaling), 9000 (PS2 API), 7777 (Dedicated Server)

## 배포 스크립트 (deploy-to-gpu.sh)

Orbitron이 실행하는 4단계:
1. `docker build` — 이미지 빌드
2. `docker save | ssh docker load` — twinverse-ai로 전송
3. `ssh docker compose down && up` — 컨테이너 교체
4. 헬스체크 대기 (최대 60초, 5초 간격)

첫 배포 ~10분, 이후 업데이트 ~5분 (Docker 레이어 캐시).

## 백엔드 Linux 호환 수정

| 파일 | 변경 |
|------|------|
| ps2_service.py | `CREATE_NEW_PROCESS_GROUP` → `start_new_session=True` |
| ps2_service.py | 기본 경로: `/opt/ue5/TwinverseDesk` |
| ps2_service.py | 에디터 폴백 제거, 패키지 전용 |
| ps2_launcher.py | Wilbur 기본 경로: `/opt/wilbur` |
| ps2_dedicated_service.py | 서버 바이너리 기본 경로: `/opt/ue5/TwinverseDeskServer` |
| ps2_server.py | 변경 없음 |
| models/*.py | 변경 없음 |

API 계약, DB 스키마, JWT 인증 흐름: 변경 없음.

## twinverse-ai 서버 세팅

설치 필요:
- Node.js 20 (Wilbur 빌드용, 호스트 레벨)
- cloudflared (Cloudflare Tunnel 데몬)
- UFW 포트 개방: 8080, 8888, 9000, 7777
- /opt/twinverse-ps2/ 디렉토리 (docker-compose.yml 배치)

Docker + nvidia-container-toolkit: 이미 설치됨.

## Cloudflare Tunnel 이전

새 터널 생성 방식 (무중단):
1. twinverse-ai에 cloudflared 설치
2. `cloudflared tunnel create twinverse-ps2-linux`
3. DNS 라우팅: ps2-api.twinverse.org, ps2.twinverse.org → 새 터널
4. systemd 서비스 등록 (재부팅 생존)
5. 확인 후 PS2 Windows의 기존 터널 삭제

## 프론트엔드 변경

없음. URL 동일 (ps2-api.twinverse.org, ps2.twinverse.org).
코드 수정, 빌드, 재배포 불필요.

## 개발자 워크플로우

Steven이 직접 해야 하는 것: **UE5 에디터에서 Linux 패키징 (1가지만)**

나머지 전부 자동:
1. UE5 에디터: File → Package → Linux
2. `build/` 폴더에 복사
3. `git push main`
4. (자동) Orbitron 감지 → Docker 빌드 → twinverse-ai 배포 → 헬스체크

## 롤백 계획

배포 실패 시 5분 내 원복:
1. twinverse-ai 컨테이너 중지
2. PS2 Windows에서 start_gpu_server.bat 재실행
3. Cloudflare 터널을 PS2로 원복

## 확장 경로

```
현재:  Orbitron → twinverse-ai 1대 (RTX 3090, 동시 3명)
중기:  Orbitron → twinverse-ai + 클라우드 GPU N대 (Orbitron.yaml에 타겟 추가)
장기:  Orbitron → K8s 클러스터 (자동 스케일링, 수백명)
```

Docker 이미지 동일 → 확장 시 코드 변경 없음.
GPU 스케일링: 작은 GPU 여러 대 수평 확장 (유저당 GPU 렌더링 독점, 오토스케일링 비용 효율).
