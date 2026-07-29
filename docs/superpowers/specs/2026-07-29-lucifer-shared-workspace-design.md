# Lucifer — 사람·AI 공동 작업 공간 설계

작성일: 2026-07-29
상태: 설계 승인됨

## 목적

Steven, Claude Code, 지니, 로이 네 참가자가 **한 곳에서 대화하고 콘텐츠·데이터를
주고받으며 공동 개발**할 수 있는 상시 접근 가능한 공간을 만든다.
`C:\WORK\` 하위 어느 프로젝트에서든 동일하게 쓸 수 있어야 한다.

현재는 각자 단절돼 있다. 지니와 로이는 어드민 콘솔에서만 만날 수 있고, Claude Code는
터미널에만 있으며, 셋 사이에 공유되는 문맥이 없다. 감독님이 같은 얘기를 세 번 해야 한다.

## 참가자

| 참가자 | 정체 | 모델 | 상시성 | 응답 조건 |
|---|---|---|---|---|
| Steven | 사람 | — | — | — |
| 지니 🧞 | OpenClaw `myjini` | `claude-cli/claude-opus-5` | 상시 | `지니야` / @멘션 |
| 로이 🦊 | OpenClaw `main` | `openai-codex/gpt-5.6-sol` | 상시 | `로이야` / @멘션 |
| 클로드 | Claude Code | opus-5 | **세션 중에만** | 세션 중 실시간 |

지니와 로이의 모델 계열을 일부러 다르게 둔다. 같은 문제를 Anthropic 계열과 OpenAI
계열이 다르게 보는 것이 공동 개발에서 이점이 된다.

### 핵심 비대칭

Claude Code는 상시 동작하지 않는다. 감독님이 세션을 열 때만 존재한다. 따라서 대화가
텔레그램에만 쌓이면 Claude Code는 그동안 오간 내용을 알 수 없다. **이 비대칭을 메우는
것이 이 설계의 중심 문제**이며, "미러링"이 그 해법이다.

---

## 구조

### 3계층

```
1. 전역 스킬      ~/.claude/skills/lucifer/SKILL.md
                  어느 프로젝트에서든 /lucifer 호출. 배포·설치 불필요.

2. 서버 공용 기계  미러링 · 변환 워처 · systemd timer  (twinverse-ai 호스트)
                  한 벌만 설치하고 프로젝트별 폴더로 분기한다.

3. 레지스트리      Lucifer/_registry.json  (프로젝트 <-> 토픽 매핑, SSOT)
                  infra-docs/ai-shared-registry.md 에 Lucifer 항목 추가.
```

플러그인이 아니라 **전역 스킬**을 택한 이유: 배포도 MCP 서버도 필요 없고,
`~/.claude/skills/`는 이미 `/start` `/end` `/init`이 쓰는 검증된 경로이며
모든 프로젝트에서 자동으로 잡힌다.

### 면 1: 텔레그램 슈퍼그룹 "Lucifer" — 대화

**토픽(Topics) 모드 슈퍼그룹.** 토픽 하나가 프로젝트 하나에 대응한다.

봇 3개가 그룹에 들어간다. 이 중 2개는 OpenClaw가, 1개는 Claude Code가 관리한다 —
서로 다른 시스템이므로 설정 방법도 다르다.

**OpenClaw 관리 (봇 2개).** 라우팅이 `channel:accountId` 단위이므로 에이전트마다
봇 계정이 하나씩 필요하다.

```
telegram:jini -> agent myjini  (지니)
telegram:roy  -> agent main    (로이)
```

`openclaw agents bind --agent myjini --bind telegram:jini` 형태로 바인딩한다.
프로젝트별 분리는 `threadBindings`(토픽 바인딩)로 처리한다.

**Claude Code 관리 (봇 1개).** OpenClaw와 무관하며 `telegram:configure` 스킬로
별도 설정한다. OpenClaw의 라우팅 테이블에는 등장하지 않는다.

각 봇은 자기 이름이 불릴 때만 응답한다. 감독님과 Claude Code가 설계 얘기를 길게
주고받아도 끼어들지 않는다.

### 면 2: 공유 폴더 `Lucifer/` — 기록과 데이터

| 보는 위치 | 경로 |
|---|---|
| Steven (Windows) | `Z:\TwinverseFolder\Lucifer\` |
| twinverse-ai 호스트 | `/media/stevenlim/TwinverseFolder/Lucifer/` |
| 지니·로이 (컨테이너) | `/shared/` (신규 bind mount) |

실체는 Orbitron(192.168.219.101)의 Samba 공유 `/srv/TwinverseFolder`이다.

```
Lucifer/
  _registry.json              등록 명단 + 토픽 ID 매핑 (SSOT)
  _common/                    프로젝트 무관 공용 (인프라 메모 등)
  TwinverseAI/
    chat/    2026-07-29.md    세션 .jsonl -> 마크다운 (지니·로이 통합 시간순)
    memo/                     넷이 자유롭게 쓰는 공동 메모
    data/                     공유 콘텐츠·데이터 (원본)
      _ai/                    AI가 읽을 수 있게 변환한 파생물 (자동 생성)
    handoff/                  Claude Code -> Steven 작업 지시서
  <등록한 다른 프로젝트>/
```

`data/_ai/`는 `data/`의 구조를 그대로 따라간다. 예: `data/기획/deck.pptx` →
`data/_ai/기획/deck.pdf`. 사람은 원본만 보면 되고, AI는 파생물이 있으면 그것을 읽는다.

---

## 등록제 (중요)

`C:\WORK\` 하위에는 프로젝트가 20개가 넘는다. 전부 자동 등록하면 그룹이 순식간에
쓰레기통이 된다. **감독님이 명시적으로 지정한 프로젝트만** 방을 갖는다.

| 명령 | 하는 일 |
|---|---|
| `/lucifer` | 현재 프로젝트 방의 최근 대화를 읽고 합류 |
| `/lucifer add` | **현재 프로젝트를 등록** (토픽 + 폴더 생성). 유일한 추가 경로 |
| `/lucifer send <말>` | 그룹의 해당 토픽에 메시지 전송 |
| `/lucifer list` | 등록된 프로젝트 목록 |

등록되지 않은 프로젝트에서 `/lucifer`를 부르면 **방을 만들지 않고** "등록할까요?"만
묻는다. `add` 없이는 어떤 부작용도 일어나지 않는다.

프로젝트 식별은 `/start` 스킬과 같은 방식을 쓴다 — `git rev-parse --show-toplevel`의
마지막 디렉토리명.

---

## 미러링 설계 (핵심 결정)

**LLM에게 "로그를 남겨줘"라고 지시하지 않는다.** 지니가 잊거나 바쁘면 기록이 유실되고,
그 유실은 조용히 일어나 나중에 알아채기 어렵다.

대신 **OpenClaw가 이미 남기는 세션 파일을 변환**한다.

- 소스: `/data/.openclaw/agents/{myjini,main}/sessions/*.jsonl`
- 변환: 호스트 측 스크립트를 **systemd timer로 1분 주기** 실행
  (cron은 분 단위가 하한이고 systemd timer가 실패 로그·재시도를 다루기 쉬움)
- 출력: `Lucifer/<프로젝트>/chat/YYYY-MM-DD.md` — 두 에이전트 대화를 시간순 병합, 발화자 표기
- 프로젝트 분기: 세션의 토픽 ID를 `_registry.json`으로 역참조해 해당 프로젝트 폴더로 보낸다
- 증분 처리: 파일별 마지막 처리 오프셋을 `Lucifer/.mirror-state.json`에 기록해
  중복 append 방지. 상태 파일이 없거나 깨지면 당일 분만 재생성한다.
- 실패 시: 스크립트는 조용히 죽지 않고 `Lucifer/_common/_mirror-errors.log`에 남긴다.
  기록 유실을 눈에 보이게 하는 것이 목적이다.

---

## 미디어·문서 처리

### 형식별 이해 가능 여부

파일을 **보관·전달**하는 것은 형식과 무관하게 전부 된다 (`data/`는 그냥 폴더다).
문제는 **AI가 내용을 이해하는가**이며, 이는 형식마다 다르다.

| 형식 | Steven | 지니 | 로이 | 클로드 | 조치 |
|---|---|---|---|---|---|
| 이미지 | O | O 네이티브 | O | O 네이티브 | 없음 |
| PDF | O | O 네이티브 | △ | O 네이티브 | 없음 |
| PPTX·DOCX·XLSX | O | X | X | X | **PDF 변환** |
| 동영상 | O | X | X | X | **프레임 + 자막 추출** |
| 유튜브 링크 | O | X | X | X | **자막 추출** |
| 음성 | O | O | O | — | 없음 (openai 전사 설정됨) |

### 현재 프로바이더 상태 (2026-07-29 실측)

| 기능 | 상태 |
|---|---|
| `image.describe` | 설정됨 — openai (gpt-5.4-mini) |
| `audio.transcribe` | 설정됨 — openai (gpt-4o-transcribe) |
| `image.generate` | 설정됨 — openai (gpt-image-1) |
| `video.describe` | **미설정** — Google 키 필요 |
| `web.search` / `web.fetch` | **미설정** |

로컬 Ollama에 비전 모델(`qwen2.5vl:7b`, `llava:7b`)이 이미 떠 있어, 외부 API 키 없이
프레임 분석을 붙일 수 있다. 미설정 항목 3개를 외부 키로 메우는 대신 **로컬 변환으로
우회**하는 것이 이 설계의 선택이다. 키 발급·비용·유출 위험이 모두 사라진다.

### 변환 파이프라인

`data/`에 파일이 들어오면 호스트 측 워처가 `data/_ai/`에 파생물을 만든다.

| 입력 | 출력 | 도구 | 설치 |
|---|---|---|---|
| `.pptx` `.docx` `.xlsx` | 같은 이름 `.pdf` | `libreoffice --headless --convert-to pdf` | **필요** |
| `.mp4` 등 영상 | `<name>.frames/*.jpg` + `<name>.md` (프레임 설명) | ffmpeg + Ollama `qwen2.5vl:7b` | ffmpeg 있음 |
| 유튜브 링크 (`.url` / `links.md`) | `<id>.transcript.md` | `yt-dlp --write-auto-sub` | **필요** |
| `.pdf` | 그대로 (변환 불필요) | — | — |

호스트 도구 실측: `ffmpeg` `ffprobe` `pdftotext` `python3` 있음.
`libreoffice`(약 1GB)와 `yt-dlp` 설치 필요. 디스크 270GB 여유.

프레임 추출은 장면 전환 기준(`ffmpeg -vf select='gt(scene,0.3)'`)으로 뽑아 분량을
제한한다. 영상 전체를 초당 프레임으로 뜨면 디스크와 추론 시간이 폭증한다.

변환은 **원본을 절대 건드리지 않는다.** 실패해도 원본은 그대로 남고, 실패 사실은
`data/_ai/_convert-errors.log`에 남긴다.

---

## 권한 (검증 완료)

| 주체 | uid/gid |
|---|---|
| 컨테이너 `node` | 1000 / 1000 |
| 호스트 `stevenlim` | 1000 / 1000 |
| CIFS 마운트 강제 | `uid=1000,gid=1000,file_mode=0755,dir_mode=0755` |

세 값이 일치하므로 지니·로이가 `/shared`에 쓸 수 있다. 호스트에서 쓰기 테스트 통과 확인.

## 접근 제어

- `groupAllowFrom`으로 Steven만 허용. 팀원 추가는 나중에 열면 된다.
- 각 봇은 Telegram privacy mode 해제 필요 (그룹 메시지를 읽으려면 필수).
- 토픽 생성을 위해 봇에 `can_manage_topics` 관리자 권한 필요.
- 컨테이너에는 `Lucifer/`만 마운트한다. `TwinverseFolder` 루트의 기존 자료
  (사건자료, forest-archive 등)는 AI 시야에서 제외된다.

---

## 설정 순서

| # | 작업 | 담당 |
|---|---|---|
| 1 | @BotFather에서 봇 3개 생성 (jini/roy/claude) → 토큰 | **Steven** |
| 2 | 슈퍼그룹 "Lucifer" 생성 + **Topics 모드 켜기** | **Steven** |
| 3 | 봇 3개 초대, privacy mode 해제, `can_manage_topics` 부여 | **Steven** |
| 4 | `Lucifer/` 폴더 + `_registry.json` 초기화 | Claude Code |
| 5 | 컨테이너 재생성 (`-v .../Lucifer:/shared` 추가) | Claude Code |
| 6 | 텔레그램 채널 계정 3개 + 에이전트 바인딩 + 멘션 트리거 | Claude Code |
| 7 | 세션 → 마크다운 미러링 스크립트 + systemd timer | Claude Code |
| 8 | 변환 도구 설치 (libreoffice, yt-dlp) + 변환 워처 | Claude Code |
| 9 | 전역 스킬 `~/.claude/skills/lucifer/SKILL.md` 작성 | Claude Code |
| 10 | Claude Code 텔레그램 봇 연결 (`telegram:configure`) | Claude Code |
| 11 | TwinverseAI 첫 등록 (`/lucifer add`) | Claude Code |
| 12 | `infra-docs/ai-shared-registry.md` 에 Lucifer 항목 추가 | Claude Code |

Steven이 직접 할 일은 1~3번뿐이다. 봇 토큰은 채팅에 노출하지 않고 서버에서 직접
입력하는 방식으로 처리한다.

---

## 제약과 리스크

- **컨테이너 재생성 1회 필요.** `OPENCLAW_GATEWAY_TOKEN`이 env로 고정돼 있어 토큰
  드리프트가 없고 TwinverseAI 재배포도 불필요하다. 수십 초 중단.
- **텔레그램 봇 파일 한도 50MB.** UE5 pak 같은 대용량은 그룹에 올리지 않고 `data/`에
  두고 경로만 공유한다.
- **CIFS 의존.** Orbitron이 내려가면 공유 폴더가 끊긴다. 대화(텔레그램)는 계속되지만
  미러링은 멈춘다. 복구 시 밀린 세션을 다시 변환하면 되므로 유실은 없다.
- **봇 3개 관리 부담.** 토큰 3개, privacy mode 3회 해제, 그룹 초대 3회. 초기 1회 작업.
- **일반 그룹은 토픽을 지원하지 않는다.** 반드시 슈퍼그룹 + Topics 모드여야 한다.
- **기존 `Z:\TwinverseFolder\TODO-*.txt` 위치 변경** → `Lucifer/TwinverseAI/handoff/`.
  Claude Code 메모리 규칙도 함께 갱신한다.

## 검증 기준

1. 텔레그램 그룹에서 `지니야 안녕` → 지니만 응답, 로이는 침묵
2. `로이야 안녕` → 로이만 응답, 지니는 침묵
3. 아무 이름도 부르지 않은 메시지 → 둘 다 침묵
4. 위 대화가 몇 분 내 `Lucifer/TwinverseAI/chat/YYYY-MM-DD.md`에 시간순으로 나타남
5. Claude Code 세션에서 그 파일을 읽어 대화 맥락 파악 가능
6. `data/`에 파일을 넣으면 Windows·호스트·컨테이너 세 곳에서 모두 보임
7. 게이트웨이 토큰 해시가 컨테이너 재생성 전후 동일 (재배포 불필요 확인)
8. `data/`에 `.pptx`를 넣으면 몇 분 내 `data/_ai/`에 `.pdf`가 생기고,
   지니에게 그 경로를 주면 내용을 설명함
9. 짧은 `.mp4`를 넣으면 `_ai/`에 프레임과 설명 마크다운이 생김
10. 변환 실패 시 원본이 손상되지 않고 `_convert-errors.log`에 기록됨
11. **등록 안 된 프로젝트**(예: `C:\WORK\AssetHub`)에서 `/lucifer` 호출 시
    방을 만들지 않고 등록 여부만 물음
12. 그 프로젝트에서 `/lucifer add` 실행 시 토픽과 폴더가 생기고
    `_registry.json`에 매핑이 추가됨

## 범위 밖 (나중에)

- 팀원 추가 및 권한 분리
- 오비(codex-pro) 등 다른 에이전트 참여
- 대화 검색 기능 (당장은 파일 grep으로 충분)
- 로이 모델 변경 (지금은 codex 유지 — 관점 다양성 목적)
- 프로젝트 등록 해제(`/lucifer remove`) — 수요 확인 후
