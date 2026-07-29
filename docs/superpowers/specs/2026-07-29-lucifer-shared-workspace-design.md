# Lucifer — 사람·AI 공동 작업 공간 설계

작성일: 2026-07-29
상태: 설계 승인 대기

## 목적

Steven, Claude Code, 지니, 로이 네 참가자가 **한 곳에서 대화하고 콘텐츠·데이터를
주고받으며 공동 개발**할 수 있는 상시 접근 가능한 공간을 만든다.

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
것이 이 설계의 중심 문제**이며, 아래 "미러링"이 그 해법이다.

## 구조 — 두 개의 면(surface)

### 면 1: 텔레그램 그룹 "Lucifer" — 대화

봇 3개가 같은 그룹에 들어간다. OpenClaw의 라우팅이 `channel:accountId` 단위이므로
에이전트마다 봇 계정이 하나씩 필요하다.

```
telegram:jini   -> agent myjini  (지니)
telegram:roy    -> agent main    (로이)
telegram:claude -> Claude Code   (별도 시스템)
```

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
  chat/      2026-07-29.md     세션 .jsonl -> 마크다운 자동 변환 (네 명 통합 시간순)
  memo/                        넷이 자유롭게 쓰는 공동 메모
  data/                        공유 콘텐츠·데이터·산출물
  handoff/                     Claude Code -> Steven 작업 지시서 (기존 TODO-*.txt 이관)
```

## 데이터 흐름

```
Steven --텔레그램--> 지니/로이 (이름 부를 때만 응답)
                         |
      세션 .jsonl --변환--> Lucifer/chat/YYYY-MM-DD.md
                         |
Steven이 Claude Code 호출 --> chat/ 읽고 그동안의 대화 전부 파악 --> 합류
                         |
        Claude Code가 memo/ · handoff/ 에 기록 --> 지니·로이·Steven이 읽음
```

## 미러링 설계 (핵심 결정)

**LLM에게 "로그를 남겨줘"라고 지시하지 않는다.** 지니가 잊거나 바쁘면 기록이 유실되고,
그 유실은 조용히 일어나 나중에 알아채기 어렵다.

대신 **OpenClaw가 이미 남기는 세션 파일을 변환**한다.

- 소스: `/data/.openclaw/agents/{myjini,main}/sessions/*.jsonl`
- 변환: 호스트 측 스크립트가 주기 실행 (systemd timer 또는 cron)
- 출력: `Lucifer/chat/YYYY-MM-DD.md` — 두 에이전트 대화를 시간순으로 병합, 발화자 표기
- 증분 처리: 파일별 마지막 처리 오프셋을 상태 파일에 기록해 중복 append 방지

이렇게 하면 지니·로이의 행동과 무관하게 기록이 반드시 남는다.

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
- 컨테이너에는 `Lucifer/`만 마운트한다. `TwinverseFolder` 루트의 기존 자료
  (사건자료, forest-archive 등)는 AI 시야에서 제외된다.

## 설정 순서

| # | 작업 | 담당 |
|---|---|---|
| 1 | @BotFather에서 봇 3개 생성 (jini/roy/claude) → 토큰 | **Steven** |
| 2 | 그룹 "Lucifer" 생성, 봇 3개 초대, privacy mode 해제 | **Steven** |
| 3 | `Lucifer/` 폴더 + 하위 구조 생성 | Claude Code |
| 4 | 컨테이너 재생성 (`-v .../Lucifer:/shared` 추가) | Claude Code |
| 5 | 텔레그램 채널 계정 3개 설정 + 에이전트 바인딩 + 멘션 트리거 | Claude Code |
| 6 | 세션 → 마크다운 미러링 스크립트 + 주기 실행 | Claude Code |
| 7 | Claude Code 텔레그램 봇 연결 (`telegram:configure`) | Claude Code |

Steven이 직접 할 일은 1·2번뿐이다. 봇 토큰은 채팅에 노출하지 않고 서버에서 직접
입력하는 방식으로 처리한다.

## 제약과 리스크

- **컨테이너 재생성 1회 필요.** `OPENCLAW_GATEWAY_TOKEN`이 env로 고정돼 있어 토큰
  드리프트가 없고 TwinverseAI 재배포도 불필요하다. 수십 초 중단.
- **텔레그램 봇 파일 한도 50MB.** UE5 pak 같은 대용량은 그룹에 올리지 않고 `data/`에
  두고 경로만 공유한다.
- **CIFS 의존.** Orbitron이 내려가면 공유 폴더가 끊긴다. 대화(텔레그램)는 계속되지만
  미러링은 멈춘다. 복구 시 밀린 세션을 다시 변환하면 되므로 유실은 없다.
- **봇 3개 관리 부담.** 토큰 3개, privacy mode 3회 해제, 그룹 초대 3회. 초기 1회 작업.
- **기존 `Z:\TwinverseFolder\TODO-*.txt` 위치 변경** → `Lucifer/handoff/`.
  Claude Code 메모리 규칙도 함께 갱신한다.

## 검증 기준

1. 텔레그램 그룹에서 `지니야 안녕` → 지니만 응답, 로이는 침묵
2. `로이야 안녕` → 로이만 응답, 지니는 침묵
3. 아무 이름도 부르지 않은 메시지 → 둘 다 침묵
4. 위 대화가 몇 분 내 `Lucifer/chat/YYYY-MM-DD.md`에 시간순으로 나타남
5. Claude Code 세션에서 그 파일을 읽어 대화 맥락 파악 가능
6. `data/`에 파일을 넣으면 Windows·호스트·컨테이너 세 곳에서 모두 보임
7. 게이트웨이 토큰 해시가 컨테이너 재생성 전후 동일 (재배포 불필요 확인)

## 범위 밖 (나중에)

- 팀원 추가 및 권한 분리
- 오비(codex-pro) 등 다른 에이전트 참여
- 대화 검색 기능 (당장은 파일 grep으로 충분)
- 로이 모델 변경 (지금은 codex 유지 — 관점 다양성 목적)
