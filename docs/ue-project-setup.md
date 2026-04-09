# UE5 프로젝트 설정

> TwinverseDesk UE5.7.4 프로젝트 구조 및 설정 가이드

## 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프로젝트명** | TwinverseDesk |
| **엔진 버전** | Unreal Engine 5.7.4 |
| **프로젝트 경로** | `C:\WORK\TwinverseDesk` |
| **언어** | C++ + Blueprint |
| **타겟 플랫폼** | Windows 64-bit |

## 디렉토리 구조

```
C:\WORK\TwinverseDesk\
├── Config/
│   ├── DefaultEngine.ini    ← PS2, EOS, 렌더링 설정
│   ├── DefaultGame.ini      ← 패키징, 맵 쿡 설정
│   └── DefaultInput.ini     ← 입력 매핑
├── Content/
│   ├── PCG/                 ← PCG 기반 맵
│   ├── Maps/                ← 수동 제작 맵 (NewYork 등)
│   └── SuperheroFlight/     ← 캐릭터/GameMode Blueprint
├── Source/TwinverseDesk/
│   ├── TwinverseDesk.Build.cs        ← 모듈 의존성
│   ├── TwinverseDeskGameMode.h/cpp   ← 베이스 GameMode
│   ├── TwinverseDeskGameInstance.h/cpp ← 맵 오버라이드 로직
│   ├── TwinverseDeskPlayerController.h/cpp
│   └── Variant_*/                    ← 게임 모드 변형
├── Package/Windows/          ← 패키지 빌드 출력
│   └── TwinverseDesk.exe
└── TwinverseDesk.uproject
```

## 모듈 의존성 (Build.cs)

```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "Core", "CoreUObject", "Engine",
    "InputCore", "EnhancedInput",
    "AIModule", "StateTreeModule", "GameplayStateTreeModule",
    "UMG", "Slate",
    "PixelStreaming2"   // PS2 플러그인
});
```

## 핵심 설정 파일

### DefaultEngine.ini

```ini
[/Script/EngineSettings.GameMapsSettings]
GameDefaultMap=/Game/PCG/PCG_Study_Modern.PCG_Study_Modern
GameInstanceClass=/Script/TwinverseDesk.TwinverseDeskGameInstance
GlobalDefaultGameMode=/Game/SuperheroFlight/Blueprints/System/GM_SuperheroFlight.GM_SuperheroFlight_C

[/Script/PixelStreaming2.PixelStreaming2Settings]
bAutoStart=True
DefaultStreamerID=TwinverseDesk
SignalingServerPort=8888
PlayerPort=80
```

### DefaultGame.ini (패키징)

```ini
[/Script/UnrealEd.ProjectPackagingSettings]
Build=IfProjectHasCode
BuildConfiguration=PPBC_Development
UsePakFile=True
bUseIoStore=True
bCompressed=True
PackageCompressionFormat=Oodle
PackageCompressionMethod=Kraken

+MapsToCook=(FilePath="/Game/PCG/PCG_Study_Modern")
+MapsToCook=(FilePath="/Game/Maps/NewYork")
```

## GameInstance — 맵 오버라이드

패키지 빌드에서 커맨드라인으로 맵을 선택하기 위한 핵심 C++ 클래스입니다.

> **배경**: UE5 패키지 빌드는 positional 맵 인자나 `-ExecCmds`를 무시합니다. GameMode의 BeginPlay도 맵별 GameMode Override 때문에 신뢰할 수 없습니다. GameInstance는 맵/GameMode와 무관하게 게임 시작 시 한 번 실행되므로 가장 확실한 방법입니다.

### 동작 원리

```
TwinverseDesk.exe -MapOverride=/Game/Maps/NewYork
         │
         ▼
GameInstance::OnStart()
         │
         ├── -MapOverride 인자 파싱
         ├── 현재 맵과 비교
         └── 다르면 UGameplayStatics::OpenLevel() 호출
```

### 코드

```cpp
// TwinverseDeskGameInstance.cpp
void UTwinverseDeskGameInstance::OnStart()
{
    Super::OnStart();
    FString MapOverride;
    if (FParse::Value(FCommandLine::Get(), TEXT("-MapOverride="), MapOverride))
    {
        FString CurrentMap = GetWorld()->GetMapName();
        // ... 비교 후 OpenLevel 호출
        UGameplayStatics::OpenLevel(World, FName(*MapOverride));
    }
}
```

## 활성 플러그인

| 플러그인 | 용도 |
|---------|------|
| **PixelStreaming2** | WebRTC 원격 스트리밍 |
| **StateTree** | AI 행동 트리 |
| **GameplayStateTree** | 게임플레이 상태 관리 |
| **CesiumForUnreal** | 3D 지도/지형 데이터 |
| **EOS Online Framework** | Epic Online Services (설치됨, 미활성화) |

## 빌드 방법

### Visual Studio 빌드 (C++ 변경 시)

1. UE5 에디터 닫기
2. `TwinverseDesk.sln` 열기
3. Solution Explorer → TwinverseDesk 우클릭 → Build
4. 빌드 완료 후 에디터 재시작

### 패키지 빌드

1. UE5 에디터 → Platforms → Windows → Package Project
2. 출력: `C:\WORK\TwinverseDesk\Package\Windows\`
3. 빌드 시간: ~10~15분

> **주의**: Live Coding이 활성화된 상태(에디터 실행 중)에서 VS 빌드하면 ExitCode 6 오류 발생. 반드시 에디터를 닫고 빌드하세요.

## 맵 추가 방법

1. UE5 에디터에서 맵 제작
2. Project Settings → Packaging → "List of maps to include" 에 추가
3. 패키지 빌드
4. TwinverseAI 프론트엔드 `DeskLaunch.jsx`의 `LEVELS` 배열에 항목 추가
5. 커밋 & 배포
