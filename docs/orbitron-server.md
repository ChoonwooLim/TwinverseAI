# Orbitron 서버 사양

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.
> 마지막 업데이트: 2026-04-07

## 하드웨어

| 항목 | 사양 |
|------|------|
| 호스트명 | stevenlim-Z270X-Gaming-5 |
| CPU | Intel Core i7-7700K @ 4.20GHz (4코어 8스레드) |
| RAM | 64GB DDR4 (가용 ~51GB) |
| 스토리지 | NVMe SSD 457GB (사용 370GB / 가용 64GB, 사용률 86%) |
| GPU 0 | NVIDIA GeForce GTX 1080 8GB (PCIe 01:00.0) |
| GPU 1 | NVIDIA GeForce GTX 1080 8GB (PCIe 02:00.0) |
| 네트워크 | 192.168.219.101/24 (내부) |

## 소프트웨어

| 항목 | 버전 |
|------|------|
| OS | Ubuntu 24.04.4 LTS (Noble Numbat) |
| 커널 | 6.17.0-20-generic |
| NVIDIA Driver | 580.126.09 |
| CUDA | 13.0 (드라이버 레벨) |
| Docker | 29.2.1 |
| nvidia-container-toolkit | 1.19.0 |
| Node.js | v24.13.1 |
| Orbitron | 서비스 실행 중 (systemd) |

## GPU 환경

- Docker GPU Runtime: nvidia-container-runtime 등록 완료
- NVENC 하드웨어 인코딩: GTX 1080 지원 (Pixel Streaming용)
- GPU 0: 디스플레이 출력 + 연산 (VRAM ~876MB 사용 중)
- GPU 1: 연산 전용 (VRAM 여유 ~8GB)

## Docker 네트워크

| 네트워크 | 대역 |
|----------|------|
| docker0 | 172.17.0.0/16 |
| br-0c9f89535da8 | 172.19.0.0/16 |
| br-9c5078e85f56 | 172.18.0.0/16 |
| br-82fec117db6c | 172.20.0.0/16 |

## 실행 중인 컨테이너

| 컨테이너 | 이미지 | 포트 | 용도 |
|----------|--------|------|------|
| orbitron-twinverseai-mnn1g0gb | orbitron-twinverseai | 3441 | TwinverseAI 웹 앱 |
| orbitron-twinverseai-db | postgres:15-alpine | 3718 | TwinverseAI DB |
| orbitron-twinverse-mm5z66ak | orbitron-twinverse | 3500 | Twinverse |
| orbitron-sodamfn-mnmfojc8 | orbitron-sodamfn | 3788 | 소담FN |
| orbitron-kcontentshub-mn5x41qx | orbitron-kcontentshub | 3555 | K-ContentsHub |
| orbitron-k-contenthub-db | postgres:15-alpine | 3776 | K-ContentsHub DB |
| orbitron-wra-mmu17h1h | orbitron-wra | 3480 | WRA |
| orbitron-remoteagt-* | orbitron-remoteagt | 4100~4101 | Remote Agent (4개) |
| iiff-nginx | nginx:alpine | 3473 | IIFF Nginx |
| iiff-backend | iiff-backend | 8000 (내부) | IIFF 백엔드 |
| iiff-postgres | postgres:16-alpine | 5433 | IIFF DB |
| iiff-frontend | iiff-frontend | 80 (내부) | IIFF 프론트엔드 |
| dev-nginx | nginx | 80, 443 | 리버스 프록시 |
| dev-postgres | postgres | 5432 | 개발 DB |
| dev-pgadmin | pgadmin4 | 5050 | pgAdmin |

## Orbitron 대시보드

| 항목 | 값 |
|------|------|
| 포트 | 3100 (메인), 3102 (Next.js), 3103 (Next.js) |
| 런타임 | Node.js (MainThread) |
| PID | 2340762 |

## 접속 정보

| 항목 | 값 |
|------|------|
| IP | 192.168.219.101 |
| SSH 포트 | 22 |
| SSH 사용자 | stevenlim |
| SSH 인증 | SSH 키 (Windows PC에서 등록 완료) |

## Pixel Streaming 배포 준비 상태

| 항목 | 상태 | 비고 |
|------|------|------|
| GPU 하드웨어 | ✅ | GTX 1080 x 2 (NVENC 지원) |
| NVIDIA Driver | ✅ | 580.126.09 |
| Docker GPU Runtime | ✅ | nvidia-container-toolkit 설치 완료 |
| CUDA Toolkit (nvcc) | ❌ | 필요 시 설치 (Pixel Streaming은 드라이버만으로 동작) |
| UE5 Linux 빌드 | ⏳ | 프로젝트 패키징 후 Docker 이미지 생성 필요 |
| 동시 접속 예상 | 1~3명 | GTX 1080 NVENC 인코더 제한 |
