# EOS Online Framework

> Epic Online Services 연동 플러그인 — Redpoint Games 개발, TwinverseDesk 적용 분석

## 플러그인 정보

| 항목 | 내용 |
|------|------|
| **이름** | EOS Online Framework (Paid Edition) |
| **개발사** | Redpoint Games |
| **Fab** | [Fab 마켓플레이스](https://www.fab.com/listings/b900b244-0ff6-49e3-8562-5fc630ba9515) |
| **문서** | [docs.redpoint.games](https://docs.redpoint.games/) |
| **사용자** | 3,000+ 개발자 |
| **가격** | 연수입 $30k 미만 무료 / 이상 유료 |

## 주요 기능

### 1. 인증 (Authentication)
자동 플랫폼 인증을 지원합니다:

| 플랫폼 | 지원 |
|--------|------|
| Epic Games | O |
| Steam | O |
| itch.io | O |
| Meta Quest (VR) | O |
| Apple (iOS) | O |
| Google (Android) | O |
| Nintendo Switch | O (유료 에디션) |
| PlayStation | O (유료 에디션) |
| Xbox | O (유료 에디션) |

### 2. 매치메이킹 (Matchmaking)
- 스킬 기반 팀 매칭 (ELO/MMR)
- 파티 유지하면서 매칭
- **서버 불필요** — P2P 또는 Dedicated Server 모두 지원
- 월 고정비 없음
- 팀 기반 매치메이킹 (2v2, 5v5 등)

### 3. 로비 & 세션
- 최대 64명 로비 지원
- 세션 생성/참가/관리
- 크로스플랫폼 세션

### 4. Dedicated Server 지원
- 서버 예약 시스템 (Reserve/Unreserve)
- 팀 배정 자동화
- 예약 타임아웃 관리
- `Dedicated Server Matchmaking Beacon Host` 액터 기반

### 5. 크로스플랫폼
- PC, Mac, Linux, iOS, Android, VR, 콘솔
- 크로스플랫폼 친구 목록, 초대, 프레즌스
- **400+ Blueprint 노드** 제공

## TwinverseDesk 적용 분석

### EOS가 해결할 수 있는 것

| 기능 | 현재 구현 | EOS 적용 시 |
|------|----------|------------|
| 사용자 인증 | JWT (자체 구현) | Epic 계정 소셜 로그인 추가 |
| 세션 라우팅 | PS2 Spawner API | EOS Sessions로 보강 |
| 서버 상태 관리 | heartbeat + psutil | EOS Dedicated Server 예약 |

### EOS가 해결할 수 없는 것

| 기능 | 이유 |
|------|------|
| **GPU 서버 프로비저닝** | EOS는 서버 인스턴스 생성/스케일링 미지원 |
| **Pixel Streaming 관리** | WebRTC/Wilbur는 별도 관리 필요 |
| **오토스케일링** | 수요에 따른 인스턴스 증감 미지원 |

### 아키텍처 포지션

```
┌─────────────────────────────────────────┐
│            TwinverseDesk Platform        │
├─────────────────────────────────────────┤
│                                          │
│  [EOS Layer]                             │
│   ├── Epic 계정 로그인                    │
│   ├── 세션 관리 (유저 → 서버 라우팅)       │
│   └── 매치메이킹 (빈 서버 찾기)            │
│                                          │
│  [GPU Hosting Layer]  ← EOS 범위 밖      │
│   ├── AWS / CoreWeave / 자체 GPU 서버     │
│   ├── UE5 인스턴스 프로비저닝              │
│   └── 오토스케일링                        │
│                                          │
│  [Pixel Streaming Layer]                 │
│   ├── Wilbur 시그널링                     │
│   └── WebRTC 스트리밍                     │
│                                          │
└─────────────────────────────────────────┘
```

## 설치 상태

- **UE5 프로젝트에 설치됨**: Fab에서 구매 완료
- **플러그인 활성화**: 아직 미활성화 (OnlineSubsystemEOS 미설정)
- **Epic Developer Portal**: Product/Client ID 미발급

## 다음 단계

1. Epic Developer Portal에서 Product 등록 및 Client ID 발급
2. `TwinverseDesk.uproject`에 OnlineSubsystemEOS 플러그인 활성화
3. `DefaultEngine.ini`에 EOS 설정 추가
4. TwinverseAI 백엔드에 Epic 계정 OAuth 연동
