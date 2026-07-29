# Lucifer 텔레그램 연결 구현 계획 (계획 3/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 텔레그램 슈퍼그룹 `Lucifers` 에서 감독님이 `지니야` / `로이야` 라고 부르면 해당 에이전트만 응답하고, 그 대화가 몇 분 내 `Lucifer/<프로젝트>/chat/YYYY-MM-DD.md` 에 시간순으로 쌓여 Claude Code 가 나중에 읽을 수 있게 한다.

**Architecture:** OpenClaw 게이트웨이에 텔레그램 채널 계정 2개(`jini`, `roy`)를 등록하고 각각 에이전트 `myjini`, `main` 에 바인딩한다. 접근 제어와 멘션 트리거는 `openclaw.json` 의 `channels.telegram` 트리로 선언한다. 미러링은 호스트에서 Python 스크립트가 systemd timer 로 1분마다 세션 `.jsonl` 을 증분 읽어 마크다운으로 append 한다. LLM 에게 로그를 남기라고 지시하지 않는다 — 잊으면 조용히 유실되기 때문이다.

**Tech Stack:** OpenClaw 2026.4.12, Telegram Bot API, Python 3.12 (표준 라이브러리만), systemd

---

## Global Constraints

- **컨테이너 명령은 반드시 `docker exec -u node openclaw ...`.** root 로 실행하면 `openclaw.json` 소유권이 root 로 넘어가고 config watcher 가 `EACCES` 로 죽는다. watcher 는 한 번 죽으면 재무장되지 않아 "설정을 바꿔도 반영 안 되는" 상태가 된다. 2026-07-29 에 실제로 겪은 회귀다.
- **봇 토큰을 명령줄 인자로 넘기지 않는다.** 토큰은 서버의 `~/lucifer-secrets/bot-tokens.env` 에만 있고, 원격 셸 안에서 전개해 stdin 으로 흘려보낸다. 토큰 문자열이 로컬 명령문·대화 기록·`ps` 출력에 남으면 안 된다.
- **`TRAEFIK_HOST` 를 설정하지 않는다.** 설정하면 `trustedProxies` 가 삭제되고 device 인증이 켜져 TwinverseAI 백엔드의 WS 연결이 거부된다 (2026-04-29 회귀).
- **`OPENCLAW_GATEWAY_TOKEN` 은 env 로 고정돼 있다.** 이 계획은 컨테이너를 재생성하지 않으므로 토큰 드리프트가 없고 TwinverseAI 재배포도 불필요하다.
- 스크립트는 **호스트에서** 실행된다. 컨테이너 경로 `/shared/` 가 아니라 호스트 경로 `/media/stevenlim/TwinverseFolder/Lucifer/` 를 쓴다.
- 미러링 실패는 조용히 넘기지 않고 `Lucifer/_common/_mirror-errors.log` 에 남긴다. **기록 유실을 눈에 보이게 하는 것이 목적이다.**
- 서버 접속: `ssh stevenlim@192.168.219.117` (무암호 sudo 가능).
- Python 은 표준 라이브러리만 쓴다. 서버에 pip 패키지를 추가하지 않는다.

## 경로·식별자 대응표

| 항목 | 값 |
|---|---|
| 서버 | `twinverse-ai` = `192.168.219.117` |
| 컨테이너 | `openclaw` |
| config (컨테이너) | `/data/.openclaw/openclaw.json` |
| config (호스트) | `/srv/openclaw/data/.openclaw/openclaw.json` |
| 세션 (호스트) | `/srv/openclaw/data/.openclaw/agents/<agent>/sessions/*.jsonl` |
| Lucifer (호스트) | `/media/stevenlim/TwinverseFolder/Lucifer/` |
| Lucifer (컨테이너) | `/shared/` |
| Lucifer (Windows) | `Z:\Lucifer\` |
| 그룹 chat_id | `-1004482716134` (supergroup, Topics ON) |
| 토큰 파일 | `~/lucifer-secrets/bot-tokens.env` (`JINI_TOKEN`/`ROY_TOKEN`/`CLAUDE_TOKEN`) |

| 역할 | 봇 username | OpenClaw account | 에이전트 | 표기 |
|---|---|---|---|---|
| 지니 | `@OpenclawJini_bot` | `jini` | `myjini` | 지니 🧞 |
| 로이 | `@Openclaw2Roy_bot` | `roy` | `main` | 로이 🦊 |
| 클로드 | `@VScodeOpus_bot` | (OpenClaw 밖) | Claude Code | 클로드 🤖 |

## 확인된 사실 (2026-07-29 실측)

| 항목 | 상태 |
|---|---|
| `/shared` bind mount | **있음** (`/media/stevenlim/TwinverseFolder/Lucifer -> /shared`) |
| 에이전트 `myjini` / `main` | **둘 다 있음** (`main` 이 default) |
| `channels` config | **비어 있음** (`{}`) — 텔레그램 미설정 |
| `openclaw channels add` | `--channel telegram --account <id> --token-file <path>` 지원 |
| `openclaw agents bind` | `--agent <id> --bind telegram:<accountId>` 지원 |
| 세션 레코드 형식 | `{"type":"message","id","parentId","timestamp","message":{"role","content":[{"type":"text","text"}]}}` |
| 세션 타임스탬프 | UTC ISO8601 (`2026-07-29T06:23:06.194Z`) |

### 설계 문서 정정 1건

설계 문서(`specs/2026-07-29-lucifer-shared-workspace-design.md`)는 *"프로젝트별 분리는
`threadBindings`(토픽 바인딩)로 처리한다"* 고 썼지만 **틀렸다.** 실제 빌드를 뜯어보니
텔레그램의 `threadBindings` 는 24시간 idle timeout 을 갖는 **런타임 임시 세션 바인딩
스토어**이고, 정적 설정 수단이 아니다. 정적 토픽 설정의 실제 경로는 다음이다.

```
channels.telegram.groups.<chatId>.topics.<topicId>.{enabled, requireMention, allowFrom}
```

우선순위(코드 실측): `accounts.<id>.groups` → `groups`, 그 안에서
`groups[chatId].topics[topicId]` → `groups["*"].topics[topicId]` → `groups[chatId]` 순.
`"*"` 와일드카드가 그룹·토픽 양쪽에서 동작한다.

`groupPolicy` 가 받는 값은 `"allowlist"` | `"open"` | `"disabled"` 이고 기본값은
`"allowlist"` 다. `groupAllowFrom` 은 **숫자 텔레그램 user ID 만** 받는다 — username
문자열을 넣으면 `Invalid allowFrom entry` 경고와 함께 무시된다. 그래서 Task 1 이 필요하다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `scripts/lucifer/session_parse.py` | 세션 `.jsonl` 증분 파싱, 텔레그램 메타데이터(chat/topic) 추출 |
| `scripts/lucifer/mirror.py` | 레지스트리 역참조, 시간순 병합, 마크다운 append, 상태·에러 관리 |
| `scripts/lucifer/test_mirror.py` | 위 두 모듈의 단위 테스트 |
| `scripts/lucifer/lucifer-mirror.service` | systemd 서비스 유닛 |
| `scripts/lucifer/lucifer-mirror.timer` | systemd 타이머 유닛 (1분 주기) |
| `scripts/lucifer/deploy.sh` | 기존 파일 — 미러 스크립트·유닛 배포를 추가 |

파싱과 출력을 두 파일로 나눈 이유: 파싱은 외부 형식(OpenClaw 세션 스키마)에 종속돼
버전이 오르면 깨질 수 있고, 출력은 우리 포맷이라 안정적이다. 깨질 쪽을 격리해 둔다.

---

## Task 1: 감독님 Telegram user ID 확보

`groupAllowFrom` 이 숫자 user ID 만 받으므로 실제 값을 먼저 알아야 한다.

**Files:**
- Modify: 없음 (조회만)

**Interfaces:**
- Consumes: 없음
- Produces: 감독님의 숫자 텔레그램 user ID — Task 4 의 `groupAllowFrom` 이 쓴다.

> **순서 제약:** 이 Task 는 **반드시 Task 3 보다 먼저** 끝내야 한다. Task 3 에서 채널을
> 등록하면 OpenClaw 가 long polling 을 시작하고, 그 뒤에 `getUpdates` 를 호출하면
> `409 Conflict` 가 나거나 게이트웨이의 업데이트를 가로채 메시지를 유실시킨다.

- [ ] **Step 1: 봇 3종이 살아 있고 그룹에 있는지 확인**

```bash
ssh stevenlim@192.168.219.117 "python3 ~/lucifer-secrets/tg_check.py"
```

Expected: 세 봇의 username 이 `@OpenclawJini_bot` / `@Openclaw2Roy_bot` / `@VScodeOpus_bot`
로 나오고 프라이버시 모드가 전부 해제(`can_read_all_group_messages: true`)로 표시된다.

- [ ] **Step 2: 감독님이 그룹에 아무 메시지나 한 줄 보내게 한다**

봇은 **자기가 들어온 이후** 메시지만 본다. `getUpdates` 가 비어 있으면 이 단계가 빠진 것이다.
감독님께 "텔레그램 `Lucifers` 그룹에 아무 메시지나 한 줄 보내주세요" 라고 요청한다.

- [ ] **Step 3: user ID 를 조회한다 (토큰은 출력하지 않는다)**

```bash
ssh stevenlim@192.168.219.117 'set -a; . ~/lucifer-secrets/bot-tokens.env; set +a; \
python3 - <<"EOF"
import json, os, urllib.request
tok = os.environ["CLAUDE_TOKEN"]
with urllib.request.urlopen(f"https://api.telegram.org/bot{tok}/getUpdates?limit=100", timeout=15) as r:
    data = json.load(r)
seen = {}
for u in data.get("result", []):
    msg = u.get("message") or u.get("edited_message") or {}
    frm = msg.get("from") or {}
    if frm and not frm.get("is_bot"):
        seen[frm["id"]] = frm.get("username") or frm.get("first_name")
    chat = msg.get("chat") or {}
    if chat:
        print("chat:", chat.get("id"), chat.get("type"), chat.get("title"),
              "thread:", msg.get("message_thread_id"))
print("HUMAN SENDERS:", json.dumps(seen, ensure_ascii=False))
EOF'
```

Expected: `HUMAN SENDERS: {"<숫자ID>": "<감독님 계정명>"}` 이 나오고,
`chat:` 줄에 `-1004482716134 supergroup Lucifers` 가 보인다.

`HUMAN SENDERS: {}` 가 나오면 Step 2 가 안 된 것이다. `getUpdates` 는 24시간만 보관하므로
감독님께 다시 한 줄 보내달라고 요청하고 재실행한다.

- [ ] **Step 4: 확인한 값을 계획서에 못박는다**

이 문서의 "경로·식별자 대응표" 바로 아래에 다음 줄을 추가하고 커밋한다.
(`<STEVEN_USER_ID>` 는 Step 3 에서 얻은 숫자로 치환)

```markdown
| 감독님 user_id | `<STEVEN_USER_ID>` (Task 1 실측) |
```

```bash
git add docs/superpowers/plans/2026-07-29-lucifer-telegram.md
git commit -m "docs(plan): 감독님 텔레그램 user ID 실측값 반영"
```

---

## Task 2: TwinverseAI 토픽 생성 + `_registry.json` 채우기

**Files:**
- Modify: `/media/stevenlim/TwinverseFolder/Lucifer/_registry.json` (서버, git 저장소)

**Interfaces:**
- Consumes: Task 1 이 확인한 chat_id `-1004482716134`
- Produces: `_registry.json` 의 `group.chatId` 와 `projects.TwinverseAI.topicId` —
  Task 4 의 토픽 설정과 Task 5 의 `load_registry()` 가 읽는다.

- [ ] **Step 1: 현재 레지스트리가 비어 있음을 확인 (실패 검증)**

```bash
ssh stevenlim@192.168.219.117 "cat /media/stevenlim/TwinverseFolder/Lucifer/_registry.json"
```

Expected: `"chatId": null` 이고 `"topicId": null`

- [ ] **Step 2: 토픽 `TwinverseAI` 를 생성한다**

```bash
ssh stevenlim@192.168.219.117 'set -a; . ~/lucifer-secrets/bot-tokens.env; set +a; \
python3 - <<"EOF"
import json, os, urllib.parse, urllib.request
tok = os.environ["CLAUDE_TOKEN"]
q = urllib.parse.urlencode({"chat_id": "-1004482716134", "name": "TwinverseAI"})
with urllib.request.urlopen(f"https://api.telegram.org/bot{tok}/createForumTopic?{q}", timeout=15) as r:
    print(json.dumps(json.load(r), ensure_ascii=False, indent=1))
EOF'
```

Expected: `{"ok": true, "result": {"message_thread_id": <숫자>, "name": "TwinverseAI", ...}}`

`{"ok": false, ..., "description": "Bad Request: not enough rights to manage topics"}` 가
나오면 `@VScodeOpus_bot` 에 `can_manage_topics` 관리자 권한이 없는 것이다. 감독님께
그룹 설정 → 관리자 → `@VScodeOpus_bot` → "토픽 관리" 를 켜달라고 요청한 뒤 재실행한다.

- [ ] **Step 3: 레지스트리를 갱신한다**

`<TOPIC_ID>` 는 Step 2 의 `message_thread_id` 로 치환한다.

```bash
ssh stevenlim@192.168.219.117 'python3 - <<EOF
import json, pathlib
p = pathlib.Path("/media/stevenlim/TwinverseFolder/Lucifer/_registry.json")
d = json.loads(p.read_text(encoding="utf-8"))
d["group"]["title"] = "Lucifers"
d["group"]["chatId"] = "-1004482716134"
d["projects"]["TwinverseAI"]["topicId"] = "<TOPIC_ID>"
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(p.read_text(encoding="utf-8"))
EOF'
```

Expected: `chatId` 와 `topicId` 가 채워진 JSON 이 출력된다.
`title` 을 `Lucifers` 로 고치는 이유: 실제 그룹명은 끝에 `s` 가 붙는다.

- [ ] **Step 4: Lucifer 저장소에 커밋한다**

```bash
ssh stevenlim@192.168.219.117 'cd /media/stevenlim/TwinverseFolder/Lucifer && \
git add _registry.json && \
git -c user.name=lucifer -c user.email=lucifer@twinverse.local \
    commit -m "chore: TwinverseAI 토픽 ID 등록" && git log --oneline -1'
```

Expected: 커밋 1건 생성

---

## Task 3: 텔레그램 채널 계정 2개 등록 + 에이전트 바인딩

**Files:**
- Modify: `/data/.openclaw/openclaw.json` (컨테이너 내부, CLI 가 수정)

**Interfaces:**
- Consumes: 없음
- Produces: `channels.telegram.accounts.jini` / `.roy` 와 두 에이전트의 라우팅 바인딩 —
  Task 4 가 이 위에 접근 제어를 얹는다.

- [ ] **Step 1: 현재 채널이 없음을 확인 (실패 검증)**

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw openclaw channels list"
```

Expected: `Chat channels:` 아래가 비어 있다 (auth provider 목록만 나온다).

- [ ] **Step 2: 설정 파일 소유권 기준선을 기록한다**

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw stat -c '%U:%G %a' /data/.openclaw/openclaw.json"
```

Expected: `node:node 600`
`root:root` 로 나오면 **여기서 멈추고** 먼저 고친다:
`ssh ... "docker exec -u root openclaw chown node:node /data/.openclaw/openclaw.json && docker restart openclaw"`

- [ ] **Step 3: 지니 봇 토큰을 컨테이너에 node 소유로 넣는다**

토큰이 argv 에 노출되지 않도록 stdin 으로 흘린다.

```bash
ssh stevenlim@192.168.219.117 'set -a; . ~/lucifer-secrets/bot-tokens.env; set +a; \
printf "%s" "$JINI_TOKEN" | docker exec -i -u node openclaw sh -c "cat > /tmp/jini.token && chmod 600 /tmp/jini.token && wc -c < /tmp/jini.token"'
```

Expected: 40 대 초반의 바이트 수 (텔레그램 봇 토큰 길이). `0` 이면 env 파일의 변수명을 확인한다.

- [ ] **Step 4: 지니 계정을 등록한다**

```bash
ssh stevenlim@192.168.219.117 'docker exec -u node openclaw \
  openclaw channels add --channel telegram --account jini --name "지니" --token-file /tmp/jini.token; \
  docker exec -u node openclaw rm -f /tmp/jini.token'
```

Expected: 등록 성공 메시지. 마지막 명령이 임시 토큰 파일을 지운다.

- [ ] **Step 5: 로이 봇도 같은 방식으로 등록한다**

```bash
ssh stevenlim@192.168.219.117 'set -a; . ~/lucifer-secrets/bot-tokens.env; set +a; \
printf "%s" "$ROY_TOKEN" | docker exec -i -u node openclaw sh -c "cat > /tmp/roy.token && chmod 600 /tmp/roy.token"; \
docker exec -u node openclaw openclaw channels add --channel telegram --account roy --name "로이" --token-file /tmp/roy.token; \
docker exec -u node openclaw rm -f /tmp/roy.token'
```

Expected: 등록 성공 메시지

- [ ] **Step 6: 두 계정이 붙었는지 확인한다**

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw openclaw channels list; \
  docker exec -u node openclaw openclaw channels status --probe 2>&1 | head -20"
```

Expected: `telegram:jini` 와 `telegram:roy` 가 보이고, probe 가 두 봇의 username 을
각각 `OpenclawJini_bot` / `Openclaw2Roy_bot` 으로 돌려준다. 두 계정이 같은 username 을
가리키면 Step 3/5 에서 토큰이 섞인 것이다.

- [ ] **Step 7: 에이전트에 바인딩한다**

```bash
ssh stevenlim@192.168.219.117 'docker exec -u node openclaw openclaw agents bind --agent myjini --bind telegram:jini; \
docker exec -u node openclaw openclaw agents bind --agent main --bind telegram:roy'
```

Expected: 각각 바인딩 추가 확인 출력

- [ ] **Step 8: 라우팅과 소유권을 함께 검증한다**

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw openclaw agents list 2>&1 | grep -A3 -E '^- (main|myjini)'; \
  echo '=== OWNER ==='; docker exec -u node openclaw stat -c '%U:%G %a' /data/.openclaw/openclaw.json"
```

Expected: `myjini` 의 Routing 에 `telegram:jini`, `main` 의 Routing 에 `telegram:roy` 가
나오고, 소유권이 여전히 `node:node 600` 이다.

- [ ] **Step 9: 커밋**

이 Task 는 서버 설정만 바꾸므로 저장소 변경이 없다. 대신 다음 Task 로 넘어가기 전
게이트웨이 로그에 에러가 없는지 확인한다.

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw openclaw channels logs 2>&1 | tail -20"
```

Expected: `telegram` 관련 에러 스택이 없다.

---

## Task 4: 접근 제어 · 멘션 트리거 설정 + 종단 검증

**Files:**
- Modify: `/data/.openclaw/openclaw.json` — `channels.telegram` 트리

**Interfaces:**
- Consumes: Task 1 의 `<STEVEN_USER_ID>`, Task 2 의 `<TOPIC_ID>`, Task 3 의 계정 2개
- Produces: 이름을 부를 때만 응답하는 동작 — Task 5 의 미러링 대상 세션이 여기서 생긴다.

- [ ] **Step 1: 이름을 안 불러도 응답하는지 확인 (실패 검증)**

감독님께 그룹의 `TwinverseAI` 토픽에서 **이름 없이** `테스트` 라고 보내달라고 요청한다.

Expected(현재 상태): 지니와 로이가 **둘 다 응답한다.** `requireMention` 이 아직 없기 때문이다.
이 단계는 다음 Step 이 실제로 뭔가를 바꿨다는 증거를 만들기 위한 것이다.
둘 다 침묵한다면 Task 3 의 바인딩이 안 붙은 것이므로 되돌아가 확인한다.

- [ ] **Step 2: 설정을 백업한다**

```bash
ssh stevenlim@192.168.219.117 'docker exec -u node openclaw sh -c \
  "cp /data/.openclaw/openclaw.json /data/.openclaw/openclaw.json.pre-telegram-access && ls -la /data/.openclaw/openclaw.json.pre-telegram-access"'
```

Expected: 백업 파일이 `node:node` 소유로 생성된다.

- [ ] **Step 3: 접근 제어와 멘션 트리거를 쓴다**

`<STEVEN_USER_ID>` 와 `<TOPIC_ID>` 를 실측값으로 치환한다.
`docker exec -i -u node` 로 실행해 **파일 소유권이 root 로 넘어가지 않게** 한다.

```bash
ssh stevenlim@192.168.219.117 'docker exec -i -u node openclaw python3 - <<EOF
import json, pathlib
p = pathlib.Path("/data/.openclaw/openclaw.json")
d = json.loads(p.read_text(encoding="utf-8"))
tg = d.setdefault("channels", {}).setdefault("telegram", {})
tg["groupPolicy"] = "allowlist"
tg["groupAllowFrom"] = ["<STEVEN_USER_ID>"]
tg["groups"] = {
    "-1004482716134": {
        "enabled": True,
        "requireMention": True,
        "topics": {
            "<TOPIC_ID>": {"enabled": True, "requireMention": True}
        },
    }
}
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(d["channels"]["telegram"], ensure_ascii=False, indent=1))
EOF'
```

Expected: `channels.telegram` 트리가 위 내용대로 출력된다.

`requireMention` 을 그룹 레벨과 토픽 레벨 양쪽에 쓰는 이유: 토픽 설정이 우선하지만,
아직 등록 안 된 다른 토픽에서도 조용해야 하므로 그룹 레벨이 안전망이 된다.

- [ ] **Step 4: 소유권과 hot-reload 를 확인한다**

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw stat -c '%U:%G %a' /data/.openclaw/openclaw.json; \
  docker exec -u node openclaw openclaw channels logs 2>&1 | tail -15"
```

Expected: `node:node 600` 이고, 로그에 config 재로딩 흔적이 있으며 `EACCES` 가 없다.

`EACCES` 가 보이면 watcher 가 죽은 것이다. 재시작한다:
`ssh ... "docker restart openclaw"` — 게이트웨이 토큰은 env 고정이라 재배포는 불필요하다.

- [ ] **Step 5: 게이트웨이 토큰 해시가 그대로인지 확인한다**

Step 4 에서 재시작했든 아니든 한 번 확인한다. 이 값이 바뀌면 TwinverseAI 백엔드의
`OPENCLAW_TOKEN` 도 갱신해야 한다.

```bash
ssh stevenlim@192.168.219.117 'docker exec -u node openclaw sh -c \
  "printenv OPENCLAW_GATEWAY_TOKEN | sha256sum | cut -c1-16"'
```

Expected: `ddda846ba5f129b4` (2026-07-29 기준값). 다르면 멈추고 원인을 먼저 밝힌다.

- [ ] **Step 6: 종단 검증 — 이름 호출 3종**

감독님께 `TwinverseAI` 토픽에서 다음 세 가지를 순서대로 보내달라고 요청한다.

| # | 보낼 말 | 기대 |
|---|---|---|
| 1 | `지니야 안녕` | 지니만 응답, 로이 침묵 |
| 2 | `로이야 안녕` | 로이만 응답, 지니 침묵 |
| 3 | `안녕` | 둘 다 침묵 |

셋 다 통과해야 이 Task 가 끝난다. 3번에서 누가 응답하면 `requireMention` 이 안 먹은 것이므로
Step 3 의 `<TOPIC_ID>` 가 실제 토픽 ID 와 맞는지 확인한다 (문자열이어야 한다 — 숫자로 쓰면
JSON 키가 달라진다).

- [ ] **Step 7: 감독님 외 발신자가 차단되는지 확인한다**

`groupAllowFrom` 이 실제로 좁히고 있는지 로그로 확인한다.

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw openclaw channels logs 2>&1 | grep -iE 'allow|denied|policy' | tail -10"
```

Expected: 감독님 메시지가 거부되지 않았고, `Invalid allowFrom entry` 경고가 **없다.**
그 경고가 보이면 `groupAllowFrom` 에 숫자가 아닌 값이 들어간 것이다.

---

## Task 5: 세션 → `chat/` 미러링 스크립트

**Files:**
- Create: `scripts/lucifer/session_parse.py`
- Create: `scripts/lucifer/mirror.py`
- Create: `scripts/lucifer/test_mirror.py`

**Interfaces:**
- Consumes: Task 2 의 `_registry.json`, Task 4 가 만든 실제 텔레그램 세션
- Produces:
  - `session_parse.Msg` — `ts: datetime(UTC)`, `agent: str`, `role: str`, `text: str`, `chat_id: str|None`, `topic_id: str|None`
  - `session_parse.read_new(path, offset, agent, chat_id=None, topic_id=None) -> tuple[list[Msg], int, str|None, str|None]`
  - `mirror.main() -> int` — Task 6 의 systemd 유닛이 호출한다.

- [ ] **Step 1: 호스트에서 세션 파일을 읽을 수 있는지 확인한다**

스크립트는 호스트에서 돌지만 세션 파일은 컨테이너가 `node`(uid 1000) 로 쓴다.
호스트 `stevenlim` 도 uid 1000 이라 읽혀야 하는데, 상위 디렉터리 통과 권한이 관건이다.

```bash
ssh stevenlim@192.168.219.117 "ls -la /srv/openclaw/data/.openclaw/agents/myjini/sessions/ | tail -3; \
  head -c 200 \$(ls -t /srv/openclaw/data/.openclaw/agents/myjini/sessions/*.jsonl | head -1)"
```

Expected: 파일 목록과 첫 200바이트가 보인다.
`Permission denied` 가 나오면 유닛을 root 로 돌려야 하므로 Task 6 Step 3 의 `User=` 를
`root` 로 바꾸고, 출력 파일 소유권을 `stevenlim:stevenlim` 으로 맞추는 `chown` 을 추가한다.

- [ ] **Step 2: 실제 텔레그램 세션의 메타데이터 형태를 눈으로 확인한다**

Task 4 의 대화가 남긴 최신 세션에서 발신자 메타데이터 블록을 뽑아본다.

```bash
ssh stevenlim@192.168.219.117 'python3 - <<EOF
import glob, json, os, re
f = max(glob.glob("/srv/openclaw/data/.openclaw/agents/myjini/sessions/*.jsonl"), key=os.path.getmtime)
print("FILE:", f)
for line in open(f, encoding="utf-8"):
    r = json.loads(line)
    if r.get("type") != "message":
        continue
    m = r.get("message", {})
    if m.get("role") != "user":
        continue
    for c in m.get("content") or []:
        t = c.get("text") if isinstance(c, dict) else None
        if t and "Sender (untrusted metadata)" in t:
            print(t[:800]); raise SystemExit
EOF'
```

Expected: `Sender (untrusted metadata):` 다음의 JSON 블록이 보이고, 그 안에 그룹
chat id(`-1004482716134`)와 토픽 id 가 어떤 키 이름으로든 들어 있다.

Step 3 의 파서는 키 이름을 하드코딩하지 않고 후보 목록을 재귀 탐색하므로, 여기서 본
키 이름이 후보에 없을 때만 `TOPIC_KEYS` / `CHAT_KEYS` 에 추가하면 된다.

- [ ] **Step 3: 실패하는 테스트를 쓴다**

Create `scripts/lucifer/test_mirror.py`:

```python
"""session_parse / mirror 단위 테스트."""
import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

import mirror
import session_parse as sp

SENDER = (
    "Sender (untrusted metadata):\n"
    "```json\n"
    '{"label": "Lucifers", "id": "telegram:jini",'
    ' "chat": {"chat_id": "-1004482716134", "message_thread_id": "7"}}\n'
    "```\n\n"
)


# 픽스처는 반드시 newline="" 로 쓴다. 실제 세션 파일은 Linux 에서 "\n" 으로 쓰이는데,
# Windows 텍스트 모드는 "\r\n" 으로 바꿔 바이트 오프셋 검증이 1씩 어긋난다.


def rec(ts, role, text):
    return json.dumps(
        {
            "type": "message",
            "id": "x",
            "parentId": None,
            "timestamp": ts,
            "message": {"role": role, "content": [{"type": "text", "text": text}]},
        },
        ensure_ascii=False,
    )


class TestSenderMeta(unittest.TestCase):
    def test_extracts_chat_and_topic(self):
        meta = sp.extract_sender_meta(SENDER + "지니야 안녕")
        self.assertEqual(sp.find_chat_id(meta), "-1004482716134")
        self.assertEqual(sp.find_topic_id(meta), "7")

    def test_returns_none_without_block(self):
        self.assertIsNone(sp.extract_sender_meta("그냥 본문"))

    def test_strips_block_from_body(self):
        self.assertEqual(sp.strip_sender_block(SENDER + "지니야 안녕"), "지니야 안녕")


class TestReadNew(unittest.TestCase):
    def test_incremental_read_has_no_duplicates(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            p.write_text(rec("2026-07-29T06:00:00.000Z", "user", SENDER + "지니야 안녕") + "\n",
                         encoding="utf-8", newline="")
            first, off, chat, topic = sp.read_new(str(p), 0, "myjini")
            self.assertEqual(len(first), 1)
            self.assertEqual(topic, "7")

            with p.open("a", encoding="utf-8", newline="") as fh:
                fh.write(rec("2026-07-29T06:00:05.000Z", "assistant", "안녕하세요") + "\n")
            second, off2, chat2, topic2 = sp.read_new(str(p), off, "myjini", chat, topic)
            self.assertEqual([m.text for m in second], ["안녕하세요"])
            self.assertEqual(second[0].topic_id, "7", "세션 토픽이 이어져야 한다")
            self.assertGreater(off2, off)

    def test_partial_trailing_line_is_not_consumed(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            full = rec("2026-07-29T06:00:00.000Z", "user", SENDER + "안녕") + "\n"
            p.write_text(full + '{"type": "mess', encoding="utf-8", newline="")
            msgs, off, _, _ = sp.read_new(str(p), 0, "myjini")
            self.assertEqual(len(msgs), 1)
            self.assertEqual(off, len(full.encode("utf-8")),
                             "잘린 마지막 줄은 소비하면 안 된다")

    def test_truncated_file_restarts_from_zero(self):
        with TemporaryDirectory() as d:
            p = Path(d) / "s.jsonl"
            p.write_text(rec("2026-07-29T06:00:00.000Z", "user", SENDER + "안녕") + "\n",
                         encoding="utf-8", newline="")
            msgs, off, _, _ = sp.read_new(str(p), 999999, "myjini")
            self.assertEqual(len(msgs), 1)


class TestRender(unittest.TestCase):
    def test_merges_agents_chronologically(self):
        def m(hhmm, agent, role, text):
            return sp.Msg(
                ts=datetime.fromisoformat(f"2026-07-29T{hhmm}:00+00:00"),
                agent=agent, role=role, text=text,
                chat_id="-1004482716134", topic_id="7",
            )

        msgs = [
            m("06:02", "main", "assistant", "로이입니다"),
            m("06:00", "myjini", "user", "지니야 안녕"),
            m("06:01", "myjini", "assistant", "지니입니다"),
        ]
        out = mirror.render(sorted(msgs, key=lambda x: x.ts))
        self.assertLess(out.index("지니야 안녕"), out.index("지니입니다"))
        self.assertLess(out.index("지니입니다"), out.index("로이입니다"))
        self.assertIn("### 15:00 감독님", out, "UTC 06:00 은 KST 15:00 이어야 한다")
        self.assertIn("지니 🧞", out)
        self.assertIn("로이 🦊", out)


class TestRouting(unittest.TestCase):
    REG = {
        "group": {"chatId": "-1004482716134"},
        "projects": {"TwinverseAI": {"folder": "TwinverseAI", "topicId": "7"}},
    }

    def test_known_topic_resolves_to_folder(self):
        self.assertEqual(mirror.resolve_project("7", self.REG), "TwinverseAI")

    def test_unknown_topic_is_skipped(self):
        self.assertIsNone(mirror.resolve_project("999", self.REG))
        self.assertIsNone(mirror.resolve_project(None, self.REG))


class TestWriteDay(unittest.TestCase):
    def setUp(self):
        self._tmp = TemporaryDirectory()
        self._saved = mirror.LUCIFER
        mirror.LUCIFER = Path(self._tmp.name)

    def tearDown(self):
        mirror.LUCIFER = self._saved
        self._tmp.cleanup()

    def _read(self):
        return (mirror.LUCIFER / "TwinverseAI" / "chat" / "2026-07-29.md").read_text(
            encoding="utf-8"
        )

    def test_append_keeps_previous_content(self):
        mirror.write_day("TwinverseAI", "2026-07-29", "### 15:00 감독님\n\n첫줄\n", overwrite=False)
        mirror.write_day("TwinverseAI", "2026-07-29", "### 15:01 지니 🧞\n\n둘째줄\n", overwrite=False)
        body = self._read()
        self.assertIn("첫줄", body)
        self.assertIn("둘째줄", body)
        self.assertEqual(body.count("# 2026-07-29"), 1, "헤더는 한 번만")

    def test_overwrite_replaces_previous_content(self):
        mirror.write_day("TwinverseAI", "2026-07-29", "### 15:00 감독님\n\n옛날\n", overwrite=False)
        mirror.write_day("TwinverseAI", "2026-07-29", "### 15:00 감독님\n\n재생성\n", overwrite=True)
        body = self._read()
        self.assertNotIn("옛날", body)
        self.assertIn("재생성", body)


class TestFreshStateRebuild(unittest.TestCase):
    """상태 파일이 없거나 깨지면 당일 분만 재생성한다.

    이 규칙이 없으면 상태 유실 시 전 기간 이력이 모든 날짜 파일에 중복 append 된다.
    """

    def _msg(self, iso):
        return sp.Msg(
            ts=datetime.fromisoformat(iso), agent="myjini", role="user",
            text="x", chat_id="-1004482716134", topic_id="7",
        )

    def test_keeps_only_today(self):
        now = datetime.fromisoformat("2026-07-29T06:00:00+00:00")  # KST 15:00
        msgs = [
            self._msg("2026-07-28T06:00:00+00:00"),
            self._msg("2026-07-29T00:30:00+00:00"),  # KST 09:30 같은 날
            self._msg("2026-07-29T05:00:00+00:00"),
        ]
        kept = mirror.filter_today(msgs, now)
        self.assertEqual(len(kept), 2)
        self.assertTrue(all(mirror.day_key(m) == "2026-07-29" for m in kept))

    def test_missing_state_file_reports_fresh(self):
        with TemporaryDirectory() as d:
            saved = mirror.STATE_PATH
            try:
                mirror.STATE_PATH = Path(d) / ".mirror-state.json"
                state, fresh = mirror.load_state()
                self.assertTrue(fresh)
                self.assertEqual(state["files"], {})
            finally:
                mirror.STATE_PATH = saved

    def test_corrupt_state_file_reports_fresh(self):
        with TemporaryDirectory() as d:
            saved = mirror.STATE_PATH
            try:
                mirror.STATE_PATH = Path(d) / ".mirror-state.json"
                mirror.STATE_PATH.write_text("{not json", encoding="utf-8")
                _, fresh = mirror.load_state()
                self.assertTrue(fresh)
            finally:
                mirror.STATE_PATH = saved

    def test_valid_state_file_is_not_fresh(self):
        with TemporaryDirectory() as d:
            saved = mirror.STATE_PATH
            try:
                mirror.STATE_PATH = Path(d) / ".mirror-state.json"
                mirror.STATE_PATH.write_text(
                    json.dumps({"version": 1, "files": {"/a.jsonl": {"offset": 10}}}),
                    encoding="utf-8",
                )
                state, fresh = mirror.load_state()
                self.assertFalse(fresh)
                self.assertEqual(state["files"]["/a.jsonl"]["offset"], 10)
            finally:
                mirror.STATE_PATH = saved


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 4: 테스트가 실패하는지 확인한다**

```bash
cd scripts/lucifer && python -m unittest test_mirror -v 2>&1 | tail -5
```

Expected: `ModuleNotFoundError: No module named 'mirror'` (또는 `session_parse`)

- [ ] **Step 5: `session_parse.py` 를 쓴다**

Create `scripts/lucifer/session_parse.py`:

```python
"""OpenClaw 세션 .jsonl 증분 파싱 + 텔레그램 메타데이터 추출.

이 모듈만 OpenClaw 의 세션 스키마에 종속된다. 버전이 올라 형식이 바뀌면 여기만 고친다.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone

SENDER_BLOCK = re.compile(
    r"Sender \(untrusted metadata\):\s*```json\s*(\{.*?\})\s*```",
    re.DOTALL,
)

# 텔레그램 메타데이터의 키 이름은 버전에 따라 다를 수 있어 후보를 넓게 잡고 재귀 탐색한다.
TOPIC_KEYS = frozenset(
    {"message_thread_id", "messageThreadId", "thread_id", "threadId", "topic_id", "topicId"}
)
CHAT_KEYS = frozenset({"chat_id", "chatId"})


@dataclass(frozen=True)
class Msg:
    ts: datetime          # tz-aware UTC
    agent: str            # "myjini" | "main"
    role: str             # "user" | "assistant"
    text: str
    chat_id: str | None
    topic_id: str | None


def extract_sender_meta(text: str) -> dict | None:
    """본문 앞의 발신자 메타데이터 JSON 블록을 파싱한다. 없으면 None."""
    m = SENDER_BLOCK.search(text)
    if not m:
        return None
    try:
        parsed = json.loads(m.group(1))
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def strip_sender_block(text: str) -> str:
    """메타데이터 블록을 걷어낸 사람이 읽을 본문만 남긴다."""
    return SENDER_BLOCK.sub("", text, count=1).strip()


def _scan(node, keys: frozenset[str]) -> str | None:
    """중첩 dict/list 를 훑어 keys 중 하나에 걸리는 첫 스칼라 값을 문자열로 돌려준다."""
    stack = [node]
    while stack:
        cur = stack.pop()
        if isinstance(cur, dict):
            for k, v in cur.items():
                if k in keys and isinstance(v, (str, int)) and str(v).strip():
                    return str(v)
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(cur, list):
            stack.extend(x for x in cur if isinstance(x, (dict, list)))
    return None


def find_topic_id(meta: dict | None) -> str | None:
    return _scan(meta, TOPIC_KEYS) if meta else None


def find_chat_id(meta: dict | None) -> str | None:
    return _scan(meta, CHAT_KEYS) if meta else None


def message_text(rec: dict) -> str:
    """message.content 의 텍스트 조각을 이어 붙인다."""
    content = rec.get("message", {}).get("content")
    if isinstance(content, str):
        return content.strip()
    parts = [
        c["text"]
        for c in (content or [])
        if isinstance(c, dict) and c.get("type") == "text" and c.get("text")
    ]
    return "\n".join(parts).strip()


def _parse_ts(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)


def read_new(
    path: str,
    offset: int,
    agent: str,
    chat_id: str | None = None,
    topic_id: str | None = None,
) -> tuple[list[Msg], int, str | None, str | None]:
    """offset 이후로 새로 들어온 완결된 줄만 파싱한다.

    반환: (메시지 목록, 새 offset, 갱신된 chat_id, 갱신된 topic_id)

    chat_id/topic_id 는 세션 첫 사용자 메시지에만 들어 있으므로 호출자가 이전 값을
    넘겨주고 여기서 이어받는다. 마지막 줄이 쓰이는 중이면 소비하지 않는다.
    """
    with open(path, "rb") as fh:
        fh.seek(0, 2)
        size = fh.tell()
        start = 0 if offset > size else offset  # 파일이 잘렸거나 교체됨
        fh.seek(start)
        raw = fh.read()

    cut = raw.rfind(b"\n")
    if cut == -1:
        return [], start, chat_id, topic_id
    complete = raw[: cut + 1]
    new_offset = start + len(complete)

    msgs: list[Msg] = []
    for line in complete.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue  # 깨진 줄 하나가 세션 전체를 막지 않게 한다
        if rec.get("type") != "message":
            continue
        role = rec.get("message", {}).get("role")
        if role not in ("user", "assistant"):
            continue
        text = message_text(rec)
        if not text:
            continue
        if role == "user":
            meta = extract_sender_meta(text)
            if meta:
                chat_id = find_chat_id(meta) or chat_id
                topic_id = find_topic_id(meta) or topic_id
                text = strip_sender_block(text)
            if not text:
                continue
        try:
            ts = _parse_ts(rec["timestamp"])
        except (KeyError, ValueError):
            continue
        msgs.append(
            Msg(ts=ts, agent=agent, role=role, text=text, chat_id=chat_id, topic_id=topic_id)
        )
    return msgs, new_offset, chat_id, topic_id
```

- [ ] **Step 6: `mirror.py` 를 쓴다**

Create `scripts/lucifer/mirror.py`:

```python
#!/usr/bin/env python3
"""OpenClaw 세션을 Lucifer/<프로젝트>/chat/YYYY-MM-DD.md 로 미러링한다.

LLM 에게 로그를 남기라고 지시하지 않는다 — 잊으면 조용히 유실되기 때문이다.
대신 OpenClaw 가 이미 남기는 세션 파일을 증분으로 읽어 옮긴다.
"""
from __future__ import annotations

import glob
import json
import sys
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

import session_parse as sp

KST = timezone(timedelta(hours=9))

LUCIFER = Path("/media/stevenlim/TwinverseFolder/Lucifer")
SESSIONS_ROOT = Path("/srv/openclaw/data/.openclaw/agents")
STATE_PATH = LUCIFER / ".mirror-state.json"
ERROR_LOG = LUCIFER / "_common" / "_mirror-errors.log"

AGENT_LABELS = {"myjini": "지니 🧞", "main": "로이 🦊"}
USER_LABEL = "감독님"


def log_error(what: str, exc: BaseException) -> None:
    """실패를 눈에 보이게 남긴다. 기록 유실을 조용히 넘기지 않는 것이 목적이다."""
    ERROR_LOG.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(KST).isoformat(timespec="seconds")
    with ERROR_LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{stamp}] {what}: {exc.__class__.__name__}: {exc}\n")
        fh.write(traceback.format_exc())
        fh.write("\n")


def load_registry() -> dict:
    return json.loads((LUCIFER / "_registry.json").read_text(encoding="utf-8"))


def resolve_project(topic_id: str | None, registry: dict) -> str | None:
    """토픽 ID 를 등록된 프로젝트 폴더명으로 역참조한다. 미등록이면 None."""
    if not topic_id:
        return None
    for entry in (registry.get("projects") or {}).values():
        if str(entry.get("topicId") or "") == str(topic_id):
            return entry.get("folder")
    return None


def load_state() -> tuple[dict, bool]:
    """(상태, 처음부터인가) 를 돌려준다.

    두 번째 값이 True 면 상태가 없거나 깨진 것이다. 이때 전체 이력을 그대로 append 하면
    모든 날짜 파일이 중복되므로, 호출자는 **당일 분만 재생성**해야 한다.
    """
    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        if isinstance(state, dict) and isinstance(state.get("files"), dict):
            return state, False
    except (OSError, json.JSONDecodeError):
        pass
    return {"version": 1, "files": {}}, True


def save_state(state: dict) -> None:
    tmp = STATE_PATH.with_name(STATE_PATH.name + ".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(STATE_PATH)


def render(msgs: list[sp.Msg]) -> str:
    """시간순으로 정렬된 메시지를 마크다운 블록으로 만든다. 시각은 KST."""
    out: list[str] = []
    for m in msgs:
        local = m.ts.astimezone(KST)
        who = USER_LABEL if m.role == "user" else AGENT_LABELS.get(m.agent, m.agent)
        out.append(f"### {local:%H:%M} {who}\n\n{m.text}\n")
    return "\n".join(out)


def day_key(m: sp.Msg) -> str:
    """메시지가 속한 KST 날짜. 파일명이자 버킷 키."""
    return m.ts.astimezone(KST).strftime("%Y-%m-%d")


def filter_today(msgs: list[sp.Msg], now: datetime) -> list[sp.Msg]:
    today = now.astimezone(KST).strftime("%Y-%m-%d")
    return [m for m in msgs if day_key(m) == today]


def write_day(folder: str, day: str, body: str, *, overwrite: bool) -> None:
    path = LUCIFER / folder / "chat" / f"{day}.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    if overwrite or not path.exists():
        path.write_text(f"# {day}\n\n", encoding="utf-8")
    with path.open("a", encoding="utf-8") as fh:
        fh.write(body + "\n")


def session_files() -> list[tuple[str, str]]:
    """(agent, path) 목록. 체크포인트·reset 사본은 제외한다."""
    found: list[tuple[str, str]] = []
    for agent in AGENT_LABELS:
        pattern = str(SESSIONS_ROOT / agent / "sessions" / "*.jsonl")
        for path in sorted(glob.glob(pattern)):
            name = Path(path).name
            if ".checkpoint." in name or ".reset." in name:
                continue
            found.append((agent, path))
    return found


def main() -> int:
    try:
        registry = load_registry()
    except (OSError, json.JSONDecodeError) as exc:
        log_error("레지스트리 읽기 실패", exc)
        return 1

    state, fresh = load_state()
    files = state["files"]
    collected: list[sp.Msg] = []

    for agent, path in session_files():
        entry = files.get(path) or {}
        try:
            msgs, offset, chat_id, topic_id = sp.read_new(
                path, int(entry.get("offset") or 0), agent,
                entry.get("chatId"), entry.get("topicId"),
            )
        except OSError as exc:
            log_error(f"세션 읽기 실패 {path}", exc)
            continue
        files[path] = {"offset": offset, "chatId": chat_id, "topicId": topic_id}
        collected.extend(msgs)

    # 두 에이전트의 새 메시지를 한 번에 모아 시간순으로 병합한다.
    collected.sort(key=lambda m: m.ts)

    # 상태를 잃었으면 전 기간을 다시 읽은 것이므로 그대로 append 하면 중복된다.
    # 설계대로 당일 분만 재생성한다.
    if fresh:
        collected = filter_today(collected, datetime.now(timezone.utc))

    buckets: dict[tuple[str, str], list[sp.Msg]] = {}
    for m in collected:
        folder = resolve_project(m.topic_id, registry)
        if not folder:
            continue  # 등록 안 된 토픽·콘솔 세션은 미러링 대상이 아니다
        buckets.setdefault((folder, day_key(m)), []).append(m)

    written = 0
    for (folder, day), msgs in sorted(buckets.items()):
        try:
            write_day(folder, day, render(msgs), overwrite=fresh)
            written += len(msgs)
        except OSError as exc:
            log_error(f"쓰기 실패 {folder}/chat/{day}.md", exc)

    try:
        save_state(state)
    except OSError as exc:
        log_error("상태 저장 실패", exc)
        return 1

    print(f"mirrored {written} message(s) into {len(buckets)} file(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

```bash
cd scripts/lucifer && python -m unittest test_mirror -v 2>&1 | tail -12
```

Expected: `OK` — 15개 테스트 전부 통과

- [ ] **Step 8: 커밋**

```bash
git add scripts/lucifer/session_parse.py scripts/lucifer/mirror.py scripts/lucifer/test_mirror.py
git commit -m "feat(lucifer): 세션 -> chat 마크다운 미러링"
```

---

## Task 6: 미러링 systemd 타이머 배포

**Files:**
- Create: `scripts/lucifer/lucifer-mirror.service`
- Create: `scripts/lucifer/lucifer-mirror.timer`
- Modify: `scripts/lucifer/deploy.sh`

**Interfaces:**
- Consumes: Task 5 의 `mirror.py`
- Produces: 1분 주기로 도는 `lucifer-mirror.timer` — 검증 기준 4번을 만족시킨다.

- [ ] **Step 1: 타이머가 없음을 확인 (실패 검증)**

```bash
ssh stevenlim@192.168.219.117 "systemctl list-timers --all 2>/dev/null | grep -i lucifer || echo 'NO LUCIFER TIMER'"
```

Expected: `lucifer-convert.timer` 만 보이고 `lucifer-mirror` 는 없다.

- [ ] **Step 2: 서비스 유닛을 쓴다**

Create `scripts/lucifer/lucifer-mirror.service`:

```ini
[Unit]
Description=Lucifer session mirror (OpenClaw sessions -> chat markdown)
After=network-online.target

[Service]
Type=oneshot
User=stevenlim
Group=stevenlim
WorkingDirectory=/home/stevenlim/lucifer
ExecStart=/usr/bin/python3 /home/stevenlim/lucifer/mirror.py
TimeoutStartSec=120
```

- [ ] **Step 3: 타이머 유닛을 쓴다**

Create `scripts/lucifer/lucifer-mirror.timer`:

```ini
[Unit]
Description=Run Lucifer session mirror every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=10s
Unit=lucifer-mirror.service

[Install]
WantedBy=timers.target
```

`OnUnitActiveSec=1min` 을 쓰는 이유: `OnCalendar` 와 달리 앞선 실행이 길어져도 겹치지
않는다. 미러링이 1분을 넘기면 다음 실행이 그만큼 밀릴 뿐 중복되지 않는다.

- [ ] **Step 4: `deploy.sh` 에 미러 배포를 더한다**

Modify `scripts/lucifer/deploy.sh` — `scp` 줄과 systemd 블록을 다음으로 교체한다.

```bash
echo "== 스크립트 전송 =="
ssh "$HOST" "mkdir -p ~/lucifer"
scp "$DIR"/convert.py "$DIR"/converters.py "$DIR"/test_convert.py \
    "$DIR"/mirror.py "$DIR"/session_parse.py "$DIR"/test_mirror.py "$HOST":~/lucifer/

echo "== 테스트 =="
ssh "$HOST" "cd ~/lucifer && python3 -m unittest test_convert test_mirror 2>&1 | tail -3"

echo "== systemd 유닛 설치 =="
scp "$DIR"/lucifer-convert.service "$DIR"/lucifer-convert.timer \
    "$DIR"/lucifer-mirror.service "$DIR"/lucifer-mirror.timer "$HOST":/tmp/
ssh "$HOST" "
  sudo mv /tmp/lucifer-convert.service /tmp/lucifer-convert.timer \
          /tmp/lucifer-mirror.service /tmp/lucifer-mirror.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now lucifer-convert.timer lucifer-mirror.timer
  systemctl list-timers lucifer-convert.timer lucifer-mirror.timer --no-pager
"
```

- [ ] **Step 5: 배포한다**

```bash
bash scripts/lucifer/deploy.sh
```

Expected: 테스트 `OK`, 두 타이머가 `list-timers` 에 나온다.

- [ ] **Step 6: 수동으로 한 번 돌려 결과를 본다**

```bash
ssh stevenlim@192.168.219.117 "cd ~/lucifer && python3 mirror.py"
```

Expected: `mirrored N message(s) into 1 file(s)` — Task 4 에서 주고받은 대화가 잡혀야 한다.

`mirrored 0 message(s) into 0 file(s)` 이면 토픽 매칭이 안 된 것이다. 상태 파일을 지우고
Task 5 Step 2 로 돌아가 실제 키 이름을 확인한다:
`ssh ... "rm -f /media/stevenlim/TwinverseFolder/Lucifer/.mirror-state.json"`

- [ ] **Step 7: 결과 파일을 눈으로 확인한다**

```bash
ssh stevenlim@192.168.219.117 "cat /media/stevenlim/TwinverseFolder/Lucifer/TwinverseAI/chat/\$(TZ=Asia/Seoul date +%F).md"
```

Expected: `# YYYY-MM-DD` 헤더 아래에 `### HH:MM 감독님` / `### HH:MM 지니 🧞` /
`### HH:MM 로이 🦊` 블록이 시간순으로 있다.

- [ ] **Step 8: 증분 동작을 확인한다 (중복 없음)**

```bash
ssh stevenlim@192.168.219.117 "cd ~/lucifer && python3 mirror.py && python3 mirror.py"
```

Expected: 두 번째 실행이 `mirrored 0 message(s)` — 같은 메시지를 다시 쓰지 않는다.

- [ ] **Step 9: 타이머가 실제로 도는지 확인한다**

```bash
ssh stevenlim@192.168.219.117 "sleep 70; systemctl status lucifer-mirror.service --no-pager | tail -8; \
  echo '=== ERRORS ==='; cat /media/stevenlim/TwinverseFolder/Lucifer/_common/_mirror-errors.log 2>/dev/null | tail -20 || echo '(에러 없음)'"
```

Expected: 서비스가 최근 `succeeded` 로 끝났고 에러 로그가 비어 있다.

- [ ] **Step 10: 커밋**

```bash
git add scripts/lucifer/lucifer-mirror.service scripts/lucifer/lucifer-mirror.timer scripts/lucifer/deploy.sh
git commit -m "feat(lucifer): 세션 미러링 systemd 타이머 배포"
```

---

## Task 7: Claude Code 봇 연결

`@VScodeOpus_bot` 은 OpenClaw 가 아니라 Claude Code 의 `telegram` 스킬이 관리한다.
설정이 Windows 쪽에 있고 라우팅 테이블도 별개라 앞선 Task 들과 섞이지 않는다.

**Files:**
- Modify: Claude Code 텔레그램 채널 설정 (`telegram:configure` 스킬이 관리)

**Interfaces:**
- Consumes: Task 1 의 `<STEVEN_USER_ID>`, Task 2 의 `<TOPIC_ID>`
- Produces: 감독님이 텔레그램에서 Claude Code 에 말을 걸 수 있는 경로

- [ ] **Step 1: 현재 채널이 없음을 확인 (실패 검증)**

`telegram:configure` 스킬을 호출해 상태를 조회한다.

Expected: 봇 토큰 미설정 상태로 보고된다.

- [ ] **Step 2: 봇 토큰을 가져온다**

```bash
ssh stevenlim@192.168.219.117 'set -a; . ~/lucifer-secrets/bot-tokens.env; set +a; printf "%s\n" "$CLAUDE_TOKEN"'
```

이 출력은 토큰 원문이다. 스킬 설정에만 쓰고 문서·커밋에 남기지 않는다.

- [ ] **Step 3: `telegram:configure` 로 채널을 설정한다**

`telegram:configure` 스킬을 호출해 Step 2 의 토큰을 등록하고, 접근 정책은
`<STEVEN_USER_ID>` 만 허용으로 좁힌다.

- [ ] **Step 4: 종단 검증**

감독님께 `TwinverseAI` 토픽에서 `클로드야 안녕` 이라고 보내달라고 요청한다.

Expected: 클로드만 응답하고 지니·로이는 침묵한다. 지니나 로이가 같이 응답하면
Task 4 의 `requireMention` 이 이름 매칭을 느슨하게 하고 있는 것이므로,
Task 4 Step 3 의 토픽 설정에 각 계정별 `accounts.<id>.groups` 오버라이드를 넣어 좁힌다.

- [ ] **Step 5: 커밋**

```bash
git add -A docs/superpowers/plans/2026-07-29-lucifer-telegram.md
git commit -m "docs(plan): 계획 3 완료 체크"
```

---

## 검증 기준 (설계 문서 대비)

이 계획이 끝나면 설계 문서의 검증 기준 중 다음이 통과해야 한다.

| # | 기준 | 검증 위치 |
|---|---|---|
| 1 | `지니야 안녕` → 지니만 응답 | Task 4 Step 6 |
| 2 | `로이야 안녕` → 로이만 응답 | Task 4 Step 6 |
| 3 | 이름 없는 메시지 → 둘 다 침묵 | Task 4 Step 6 |
| 4 | 대화가 몇 분 내 `chat/YYYY-MM-DD.md` 에 시간순으로 나타남 | Task 6 Step 7·9 |
| 5 | Claude Code 가 그 파일을 읽어 맥락 파악 | Task 6 Step 7 |
| 7 | 게이트웨이 토큰 해시 불변 (재배포 불필요) | Task 4 Step 5 |

기준 6·8·9·10 은 계획 1·2 에서 이미 통과했고, 11·12 는 계획 4(전역 스킬)의 몫이다.

## 이 계획의 범위 밖

- 전역 스킬 `~/.claude/skills/lucifer/SKILL.md` — 계획 4
- `/lucifer add` 로 다른 프로젝트 등록 — 계획 4
- `infra-docs/ai-shared-registry.md` 에 Lucifer 항목 추가 — 계획 4
- 팀원 추가 및 권한 분리 — 설계 문서의 "범위 밖"
