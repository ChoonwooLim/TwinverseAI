# OfficeMain — UE5 맵 빌드 사양서

> **목적**: TwinverseDesk UE5 프로젝트에서 3D 오피스 메타버스의 첫 번째 플레이어블 맵 `OfficeMain`을 구성하기 위한 단계별 빌드 가이드.
>
> **대상 프로젝트**: `C:\WORK\TwinverseDesk` (UE5 5.7.4)
> **최종 산출 경로**: `Content/Maps/Office/OfficeMain.umap`
> **참조 C++**: `Source/TwinverseDesk/Office/` (17개 클래스, 컴파일 전)

---

## 0. 사전 요구사항

| 항목 | 상태 | 비고 |
|------|------|------|
| Office/ C++ 17개 클래스 | 작성 완료 | 컴파일 미확인 |
| `ServerDefaultMap` 등록 | 완료 | `DefaultEngine.ini:15`에 이미 지정됨 |
| `Content/Maps/Office/` 디렉토리 | 미생성 | 본 작업에서 생성 |
| `Content/Office/Blueprints/` | 미생성 | 본 작업에서 생성 |
| NavMesh 시스템 | UE5 기본 제공 | RecastNavMesh 사용 |

> ⚠️ `DefaultEngine.ini:16`의 `GlobalDefaultGameMode`가 아직 `GM_SuperheroFlight`. **OfficeMain의 GameMode는 World Settings로만 override** (전역 default는 건드리지 않음 — 다른 맵 영향 방지).

---

## 1. 맵 컨셉

- **테마**: 미래형 오피스 (Dark Glass Neon — twinverse.org 디자인 톤 매칭)
- **인원**: 동시 접속 최대 20명 + NPC 최대 10명 (`OfficeGameMode::MaxPlayersPerOffice`, `OfficeNPCManager::MaxNPCsPerOffice`)
- **규모**: 약 4000×3000 UU (40m × 30m), 2층 권장
- **밝기**: 실내, 천장 라이트 + 모니터/네온 광원

### 영역 구분 (Zone Layout)

```
┌─────────────────────────────────────────────────────────┐
│  [Lounge & Spawn]    [개방형 데스크 영역 ×20]           │
│     ▓ Plant            ▢ ▢ ▢ ▢ ▢                        │
│                        ▢ ▢ ▢ ▢ ▢                        │
│  ┌─────────┐           ▢ ▢ ▢ ▢ ▢                        │
│  │Meeting A│           ▢ ▢ ▢ ▢ ▢                        │
│  │ (Auto)  │                                            │
│  └─────────┘    [TaskBoard 화이트보드]                  │
│                                                         │
│  ┌─────────┐    [NPC 스폰 영역 (×10 home points)]       │
│  │Meeting B│                                            │
│  │ (Manual)│    [Bookshelf / Plant 장식]                │
│  └─────────┘                                            │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 빌드 단계 (UE5 에디터)

### Step 1 — 디렉토리 & 빈 맵 생성

UE5 에디터 Content Browser에서:

```
Content/
├── Maps/Office/
│   └── OfficeMain.umap          ← File > New Level > Empty Open World 또는 Basic
└── Office/
    ├── Blueprints/              ← BP_* 자산 보관
    ├── Materials/
    ├── Meshes/                  ← 책상/의자 메쉬 import
    └── UI/                      ← UMG 위젯
```

> 💡 **Empty Level** 권장 (Open World 아님 — 실내 맵이라 World Partition 불필요).

### Step 2 — Blueprint 자산 생성 (필수)

C++ 클래스를 직접 배치하지 말고 BP wrapper를 만들어 mesh/속성을 에디터에서 편집할 수 있게 함.

| Blueprint | 부모 클래스 | 위치 | 용도 |
|-----------|------------|------|------|
| `BP_OfficeGameMode` | `OfficeGameMode` | `Content/Office/Blueprints/` | World Settings에서 override |
| `BP_OfficeCharacter` | `OfficeCharacter` | `Content/Office/Blueprints/` | 임시 메쉬 (Mannequin), 추후 MetaHuman 교체 |
| `BP_OfficeNPC` | `OfficeNPC` | `Content/Office/Blueprints/` | NPCManager.NPCClass에 지정 |
| `BP_Desk` | `OfficeFurniture` | `Content/Office/Blueprints/Furniture/` | `FurnitureType=Desk`, mesh + SitOffset |
| `BP_Chair` | `OfficeFurniture` | 동상 | `FurnitureType=Chair` |
| `BP_Whiteboard` | `OfficeFurniture` | 동상 | `FurnitureType=Whiteboard` |
| `BP_MeetingTable` | `OfficeFurniture` | 동상 | `FurnitureType=MeetingTable` |
| `BP_Bookshelf` | `OfficeFurniture` | 동상 | `FurnitureType=Bookshelf` |
| `BP_Plant` | `OfficeFurniture` | 동상 | `FurnitureType=Plant`, `bIsInteractable=false` |
| `BP_Monitor` | `OfficeFurniture` | 동상 | `FurnitureType=Monitor` |
| `BP_OfficeMeetingRoom` | `OfficeMeetingRoom` | `Content/Office/Blueprints/` | MeetingZone 박스 크기 조정 |

### Step 3 — World Settings 설정

OfficeMain 맵 열린 상태에서:

1. **Window > World Settings** 열기
2. **Game Mode Override**: `BP_OfficeGameMode`
3. **Default Pawn Class**: `BP_OfficeCharacter` (이미 GameMode에서 설정되지만 override 가능)
4. **Player Controller Class**: `OfficePlayerController` (자동)

### Step 4 — 바닥 / 벽 / 천장 (Geometry)

**임시 단계** (나중에 KB3D / Brushify 에셋으로 교체):

| 액터 | 크기 | 위치 |
|------|------|------|
| Floor (Cube) | 4000×3000×20 | (0,0,-10) |
| Wall North | 4000×20×400 | (0,1500,200) |
| Wall South | 4000×20×400 | (0,-1500,200) |
| Wall East  | 20×3000×400 | (2000,0,200) |
| Wall West  | 20×3000×400 | (-2000,0,200) |
| Ceiling | 4000×3000×20 | (0,0,400) — 실내감 |

> 💡 이미 import된 [Content/KB3D/](C:\WORK\TwinverseDesk\Content\KB3D\), [Content/BrutalistLevelKit/](C:\WORK\TwinverseDesk\Content\BrutalistLevelKit\) 모듈러 키트 활용 가능.

### Step 5 — PlayerStart 배치 (스폰 포인트)

`OfficeGameMode::ChoosePlayerStart_Implementation`이 **`PlayerStartTag == "Desk"`** 인 액터만 round-robin으로 사용.

- **PlayerStart 액터 20개** 배치 (개방형 데스크 영역의 의자 위치)
- 각 액터 Detail 패널에서 **Player Start Tag = `Desk`** 설정 (대소문자 정확히)
- 격자: 5열 × 4행, 간격 약 250 UU
- 회전: 책상 정면 향하도록

> ⚠️ 태그가 비어 있거나 다른 값이면 기본 fallback이 사용됨 → 데스크가 아닌 곳에 스폰되니 주의.

### Step 6 — 데스크 + 의자 + 모니터 배치

각 PlayerStart 위치 근처에:
- `BP_Desk` 1개
- `BP_Chair` 1개 (PlayerStart 정확히 위에)
- `BP_Monitor` 1개 (책상 위)

> 💡 **블루프린트 타일링 헬퍼**: 개수가 많으니 Construction Script로 PlayerStart 자동 생성하는 헬퍼 액터를 만들어도 좋음 (선택).

### Step 7 — Meeting Room 액터 배치

- `BP_OfficeMeetingRoom` 액터 **2개** 배치 (Auto 모드 1, Manual 모드 1)
- 각 미팅룸 안에 `BP_MeetingTable` 1개 + `BP_Chair` 6~8개
- `MeetingZone` BoxComponent 크기를 미팅룸 벽 안쪽에 맞춰 조정 (참가자 자동 감지)
- Detail 패널: `Mode`, `Topic` 초기값 설정

### Step 8 — TaskBoard / 장식 액터

- `BP_Whiteboard` 1개 — 메인 영역 벽에 부착 (TaskBoard용 UI 부착 예정)
- `BP_Bookshelf` 2~4개 — 벽면
- `BP_Plant` 6~8개 — 코너/통로 장식

### Step 9 — NPC Home Points

NPC 스폰/귀가 위치를 표시할 `TargetPoint` 액터를 **10개** 배치.
- 태그 `NPCHome` 부여 (`Actor Tags` 배열에 추가, NOT PlayerStartTag)
- 빈 데스크 또는 별도 NPC 워크스테이션에 배치
- `OfficeNPCManager::GetAvailableDeskLocations()`가 이 리스트를 읽도록 추후 수정 필요 (현재 구현 확인 후 보완)

### Step 10 — 라이팅

- **Directional Light** 1개 (Atmosphere Sun Light = false, 약한 fill)
- **Sky Light** 1개 (Mobility = Movable, Real Time Capture)
- **Rect Light × 6~8** — 천장 패널 조명
- **Point Light** — 모니터 글로우 (저강도, 시안/마젠타 색상으로 네온 톤)
- **Post Process Volume** (Unbound = true)
  - Bloom Intensity ~0.8
  - Auto Exposure: Manual, EV100 ≈ 8
  - Vignette ~0.3

### Step 11 — NavMesh

- `Place Actors > Volumes > Nav Mesh Bounds Volume` 배치
- 크기: 맵 전체 영역 + 약간 여유 (4200 × 3200 × 500)
- `P` 키로 NavMesh 시각화 → 모든 통행 가능 영역이 녹색인지 확인
- Project Settings > Navigation Mesh > **Runtime Generation = Dynamic** (런타임 furniture 배치 대응)

### Step 12 — Pixel Streaming 호환성 체크

- **Lumen vs Static Lighting**: Pixel Streaming은 GPU 부담이 크므로 Lumen Global Illumination + Hardware Ray Tracing **OFF** 권장 (초기 단계)
- 해상도: 1920×1080 기준으로 시야 확인
- Window > Project Settings > Rendering > **Forward Shading = ON** (Pixel Streaming 권장)
  - ⚠️ Forward Shading 변경 시 셰이더 전체 재컴파일 (시간 소요)

### Step 13 — 저장 & 테스트

1. `OfficeMain.umap` 저장
2. PIE (Play In Editor) 실행 → PlayerStart "Desk" 태그에서 스폰되는지 확인
3. 멀티플레이 테스트: Toolbar > Number of Players = 2, Net Mode = **Play As Listen Server**
4. 두 캐릭터가 다른 데스크에 스폰되는지 확인 (round-robin)

---

## 3. 검증 체크리스트

- [ ] `Content/Maps/Office/OfficeMain.umap` 생성됨
- [ ] World Settings의 GameMode Override = `BP_OfficeGameMode`
- [ ] PlayerStart 20개, **모두 PlayerStartTag = "Desk"**
- [ ] BP_OfficeNPC 생성 + `OfficeNPCManager::NPCClass`에 지정
- [ ] BP_OfficeMeetingRoom 2개 배치 + MeetingZone 트리거 작동
- [ ] NavMeshBoundsVolume이 전체 영역 커버, P키 녹색 확인
- [ ] PIE 단일 플레이어 스폰 정상
- [ ] PIE 멀티플레이어(2명) 서로 다른 데스크 스폰
- [ ] Forward Shading 활성화 (Pixel Streaming 대비)

---

## 4. 알려진 후속 작업 (이 문서 범위 외)

1. **MetaHuman 아바타** — `BP_OfficeCharacter`의 임시 Mannequin → MetaHuman 교체
2. **Dedicated Server 패키징** — `Build > Cook > LinuxServer` 후 PS2 Spawner 연동
3. **NPC AI BehaviorTree** — `OfficeNPC` 클래스 BT/BB 자산 생성
4. **TaskBoard UMG 위젯** — `BP_Whiteboard`에 부착될 Kanban UI
5. **OfficeMapEditor UI** — Tab 토글 시 표시될 furniture palette UMG
6. **에셋 폴리싱** — KB3D / BrutalistLevelKit / NeoDubai 모듈러 메쉬로 임시 큐브 교체

---

## 5. 참조

- C++ 클래스: [Source/TwinverseDesk/Office/](C:\WORK\TwinverseDesk\Source\TwinverseDesk\Office\) (17 files)
- GameMode 스폰 로직: [OfficeGameMode.cpp:37-59](C:\WORK\TwinverseDesk\Source\TwinverseDesk\Office\OfficeGameMode.cpp#L37-L59)
- 엔진 설정: [DefaultEngine.ini:15](C:\WORK\TwinverseDesk\Config\DefaultEngine.ini#L15) — `ServerDefaultMap` 이미 지정됨
- Furniture 타입: [OfficeFurniture.h:13-24](C:\WORK\TwinverseDesk\Source\TwinverseDesk\Office\OfficeFurniture.h#L13-L24)
- NPC 페르소나 프리셋: [OfficeNPCManager.h:62-63](C:\WORK\TwinverseDesk\Source\TwinverseDesk\Office\OfficeNPCManager.h#L62-L63) — Secretary/Developer/Designer/Marketer/Analyst
