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
| 감독님 user_id | `1958446460` (Task 1 실측, username `춘우`) |

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

- [x] **Step 1: 봇 3종이 살아 있고 그룹에 있는지 확인**

```bash
ssh stevenlim@192.168.219.117 "python3 ~/lucifer-secrets/tg_check.py"
```

Expected: 세 봇의 username 이 `@OpenclawJini_bot` / `@Openclaw2Roy_bot` / `@VScodeOpus_bot`
로 나오고 프라이버시 모드가 전부 해제(`can_read_all_group_messages: true`)로 표시된다.

- [x] **Step 2: 감독님이 그룹에 아무 메시지나 한 줄 보내게 한다**

봇은 **자기가 들어온 이후** 메시지만 본다. `getUpdates` 가 비어 있으면 이 단계가 빠진 것이다.
감독님께 "텔레그램 `Lucifers` 그룹에 아무 메시지나 한 줄 보내주세요" 라고 요청한다.

- [x] **Step 3: user ID 를 조회한다 (토큰은 출력하지 않는다)**

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

- [x] **Step 4: 확인한 값을 계획서에 못박는다**

이 문서의 "경로·식별자 대응표" 바로 아래에 다음 줄을 추가하고 커밋한다.
(실측값: `1958446460`)

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

- [x] **Step 3: 봇 토큰 2개를 컨테이너의 영구 위치에 node 소유로 넣는다**

> **중요 (2026-07-29 실측으로 정정):** `--token-file` 은 토큰 **값을 복사하지 않고 경로를
> 참조로만 저장**한다 (`channels.telegram.accounts.<id>.tokenFile`). 그래서 `/tmp` 에 두고
> 등록 후 지우면 봇이 조용히 인증 불능이 된다. 반드시 **`/data` 하위 영구 경로**에 두고,
> 등록 후에도 **지우지 않는다.** `/data` 는 호스트 `/srv/openclaw/data` 바인드 마운트라
> 컨테이너 재시작에도 살아남는다.

토큰이 argv 에 노출되지 않도록 stdin 으로 흘린다.

```bash
ssh stevenlim@192.168.219.117 'set -a; . ~/lucifer-secrets/bot-tokens.env; set +a; \
docker exec -u node openclaw sh -c "mkdir -p /data/.openclaw/lucifer-secrets && chmod 700 /data/.openclaw/lucifer-secrets"; \
printf "%s" "$JINI_TOKEN" | docker exec -i -u node openclaw sh -c "cat > /data/.openclaw/lucifer-secrets/jini.token && chmod 600 /data/.openclaw/lucifer-secrets/jini.token"; \
printf "%s" "$ROY_TOKEN" | docker exec -i -u node openclaw sh -c "cat > /data/.openclaw/lucifer-secrets/roy.token && chmod 600 /data/.openclaw/lucifer-secrets/roy.token"; \
docker exec -u node openclaw sh -c "ls -la /data/.openclaw/lucifer-secrets/"'
```

Expected: `jini.token` 과 `roy.token` 이 각각 **46 바이트**, `-rw------- node node` 로 보인다.
크기가 `0` 이면 env 파일의 변수명을 확인한다.

- [x] **Step 4: 지니 계정을 등록한다**

```bash
ssh stevenlim@192.168.219.117 'docker exec -u node openclaw \
  openclaw channels add --channel telegram --account jini --name "지니" \
  --token-file /data/.openclaw/lucifer-secrets/jini.token'
```

Expected: `Added Telegram account "jini".` — 토큰 파일은 **지우지 않는다.**

- [x] **Step 5: 로이 계정을 등록한다**

```bash
ssh stevenlim@192.168.219.117 'docker exec -u node openclaw \
  openclaw channels add --channel telegram --account roy --name "로이" \
  --token-file /data/.openclaw/lucifer-secrets/roy.token'
```

Expected: `Added Telegram account "roy".`

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

> **설정을 두 번에 나눠 쓴다 (2026-07-29 실측으로 정정).** 원래 계획은 접근 제어와
> `requireMention` 을 한 번에 쓰고, 그 **전에** "이름 없이 보내면 둘 다 응답" 을 실패
> 검증으로 삼았다. 그런데 `groups` 허용목록이 없는 상태에서는 게이트웨이가 애초에
> `skipping group message (reason: not-allowed)` 로 전부 버린다. 즉 그 시점의 침묵은
> `requireMention` 과 무관해서 검증이 성립하지 않는다.
>
> 그래서 **접근 제어만 먼저 켜서 "둘 다 응답" 을 확인한 뒤**, `requireMention` 을 얹어
> 침묵으로 바뀌는 것을 본다. 이래야 침묵이 멘션 조건의 효과임이 증명된다.

- [x] **Step 1: 설정을 백업한다**

```bash
ssh stevenlim@192.168.219.117 'docker exec -u node openclaw sh -c \
  "cp /data/.openclaw/openclaw.json /data/.openclaw/openclaw.json.pre-telegram-access && ls -la /data/.openclaw/openclaw.json.pre-telegram-access"'
```

Expected: 백업 파일이 `node:node` 소유로 생성된다.

- [x] **Step 2: 접근 제어만 먼저 쓴다 (멘션 조건 없이)**

`docker exec -i -u node` 로 실행해 **파일 소유권이 root 로 넘어가지 않게** 한다.
토픽 키 `"10"` 은 **문자열**이어야 한다 — 숫자로 쓰면 JSON 키가 달라져 매칭되지 않는다.

```bash
ssh stevenlim@192.168.219.117 'docker exec -i -u node openclaw python3 - <<"PYEOF"
import json, pathlib
p = pathlib.Path("/data/.openclaw/openclaw.json")
d = json.loads(p.read_text(encoding="utf-8"))
tg = d.setdefault("channels", {}).setdefault("telegram", {})
tg["groupPolicy"] = "allowlist"
tg["groupAllowFrom"] = ["1958446460"]
tg["groups"] = {
    "-1004482716134": {
        "enabled": True,
        "topics": {"10": {"enabled": True}},
    }
}
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(tg, ensure_ascii=False, indent=1))
PYEOF'
```

Expected: `groupPolicy` / `groupAllowFrom` / `groups` 가 위 내용대로 출력된다.
로그에 `restarting telegram channel` 과 `[jini] starting provider (@OpenclawJini_bot)` /
`[roy] starting provider (@Openclaw2Roy_bot)` 가 이어서 나온다. 두 줄의 봇 username 이
서로 달라야 한다 — 같으면 Task 3 에서 토큰이 섞인 것이다.

- [x] **Step 3: 접근 게이트가 열렸는지 확인 (거부 사유 전환으로 검증)**

감독님께 `TwinverseAI` 토픽에서 **이름 없이** `테스트` 라고 보내달라고 요청한 뒤 로그를 본다.

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw openclaw channels logs 2>&1 | grep -E 'reason' | tail -5"
```

Expected: 거부 사유가 **`not-allowed` → `no-mention` 으로 바뀐다.**

> **실측으로 알게 된 것 (2026-07-29):** 이 빌드는 그룹에서 `requireMention` 이
> **기본값으로 이미 켜져 있다.** 그래서 원래 기대했던 "둘 다 응답" 은 나오지 않는다.
> 대신 거부 사유의 전환이 그보다 나은 증거다 — `not-allowed` 는 접근 게이트에서 막힌
> 것이고 `no-mention` 은 접근을 통과해 멘션 게이트에서만 막힌 것이라, 두 게이트를
> 정확히 분리해 보여준다.
>
> 여전히 `not-allowed` 면 Step 2 의 `groupAllowFrom` 숫자나 토픽 키가 틀린 것이다.

- [ ] **Step 4: 멘션 조건을 얹는다**

```bash
ssh stevenlim@192.168.219.117 'docker exec -i -u node openclaw python3 - <<"PYEOF"
import json, pathlib
p = pathlib.Path("/data/.openclaw/openclaw.json")
d = json.loads(p.read_text(encoding="utf-8"))
g = d["channels"]["telegram"]["groups"]["-1004482716134"]
g["requireMention"] = True
g["topics"]["10"]["requireMention"] = True
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(g, ensure_ascii=False, indent=1))
PYEOF'
```

Expected: 그룹·토픽 양쪽에 `"requireMention": true` 가 붙는다.

양쪽에 쓰는 이유: 토픽 설정이 우선하지만, 아직 등록 안 된 다른 토픽에서도 조용해야
하므로 그룹 레벨이 안전망이 된다.

- [ ] **Step 5: 소유권과 hot-reload 를 확인한다**

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

`printf %s` 를 써서 **개행 없이** 해시한다. `printenv | sha256sum` 은 printenv 가 붙이는
줄바꿈까지 해시해 전혀 다른 값(`cc373f4ee3336c22`)을 내므로, 토큰이 멀쩡한데도
"바뀌었다" 고 오판하게 된다. 2026-07-29 에 실제로 한 번 헛짚었다.

```bash
ssh stevenlim@192.168.219.117 'docker exec -u node openclaw sh -c \
  "printf %s \"\$OPENCLAW_GATEWAY_TOKEN\" | sha256sum | cut -c1-16"'
```

Expected: `ddda846ba5f129b4` (2026-07-29 기준값). 다르면 멈추고 원인을 먼저 밝힌다.
`docker inspect openclaw --format "{{.Created}}"` 로 컨테이너 재생성 여부부터 확인할 것 —
이 값은 컨테이너 생성 시 env 로 고정되므로 재생성 없이는 바뀔 수 없다.

- [x] **Step 6: 한글 이름용 `mentionPatterns` 를 명시한다 (필수)**

> **2026-07-29 실측으로 추가된 단계.** 이걸 빼면 `지니야` 라고 불러도 **영원히 응답하지
> 않는다.** 원인은 OpenClaw 가 아니라 JavaScript 정규식이다.
>
> `mentionPatterns` 를 명시하지 않으면 OpenClaw 는 에이전트 identity 이름에서
> `deriveMentionPatterns()` 로 `\b@?<이름>\b` 패턴을 자동 생성한다. 그런데 JS 의 `\b` 는
> **ASCII `[A-Za-z0-9_]` 기준**이라 한글 앞뒤에서는 경계가 성립하지 않는다. 실측:
>
> | 패턴 | 입력 | 결과 |
> |---|---|---|
> | `\b@?지니\b` | `지니야 안녕` | **false** |
> | `\b@?지니\b` | `지니 안녕` | **false** (정확히 그 단어인데도) |
> | `지니` | `지니야 안녕` | true |
>
> 즉 한글 이름 에이전트는 자동 파생 패턴으로는 **어떤 입력과도 매치되지 않는다.**
> 로그에는 `reason: "no-mention"` 만 찍혀서 원인이 드러나지 않는다.
>
> 해결은 `agents.list[].groupChat.mentionPatterns` 를 직접 주는 것이다. 이 값이 있으면
> `resolveMentionPatterns()` 가 파생 패턴 대신 이것을 쓴다 (우선순위:
> 에이전트 `groupChat.mentionPatterns` → 전역 `messages.groupChat.mentionPatterns` →
> identity 파생). `\b` 를 빼고 부분일치로 두면 `지니야`·`지니가`·`지니 안녕` 이 모두 걸린다.

```bash
ssh stevenlim@192.168.219.117 'docker exec -i -u node openclaw python3 - <<"PYEOF"
import json, pathlib
p = pathlib.Path("/data/.openclaw/openclaw.json")
d = json.loads(p.read_text(encoding="utf-8"))
PATTERNS = {
    "myjini": ["지니", "@OpenclawJini_bot", "🧞"],
    "main":   ["로이", "@Openclaw2Roy_bot", "🦊"],
}
for a in d["agents"]["list"]:
    pats = PATTERNS.get(a["id"])
    if pats:
        a.setdefault("groupChat", {})["mentionPatterns"] = pats
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
for a in d["agents"]["list"]:
    if a["id"] in PATTERNS:
        print(a["id"], "->", json.dumps(a["groupChat"], ensure_ascii=False))
PYEOF'
```

Expected: 두 에이전트에 `mentionPatterns` 가 붙고, 로그에
`config hot reload applied (agents.list)` 가 뜬다.

감독님께 테스트를 부탁하기 전에 패턴이 실제로 갈라지는지 먼저 확인한다:

```bash
ssh stevenlim@192.168.219.117 'docker exec -i -u node openclaw node -e "
const P = { myjini: [\"지니\",\"@OpenclawJini_bot\",\"🧞\"], main: [\"로이\",\"@Openclaw2Roy_bot\",\"🦊\"] };
for (const t of [\"지니야 안녕\", \"로이야 안녕\", \"안녕\"]) {
  const hit = Object.entries(P).filter(([, ps]) => ps.some(p => new RegExp(p, \"i\").test(t.toLowerCase()))).map(([k]) => k);
  console.log(t, \"-> \", hit.length ? hit.join(\",\") : \"(none)\");
}
"'
```

Expected: `지니야 안녕 -> myjini`, `로이야 안녕 -> main`, `안녕 -> (none)`

- [ ] **Step 7: 종단 검증 — 이름 호출 3종**

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

## Task 5·6: 세션 → `chat/` 미러링 (구현 + 배포) — 완료

> **설계 변경 (2026-07-29 실측).** 원래 계획은 세션 본문의 `Sender (untrusted metadata)`
> 블록을 재귀 탐색해 토픽 ID 를 찾는 방식이었다. 실제 파일을 보고 세 가지가 드러나 접근을 바꿨다.
>
> 1. **토픽 ID 는 `Sender` 블록에 없다.** 사용자 메시지 앞에는 `(untrusted)` 블록이
>    **3종** 붙고(`Conversation info` / `Sender` / `Chat history since last reply`),
>    `topic_id` 는 `Conversation info` 에 있다. 원래 파서는 영영 못 찾았을 것이다.
> 2. **더 나은 소스가 있다.** `sessions.json` 인덱스가 세션키를
>    `agent:<id>:telegram:group:<chatId>:topic:<topicId>` 로 두고
>    `deliveryContext = {"channel":"telegram","to":"telegram:<chatId>","threadId":10}` 를
>    함께 준다. 본문 파싱보다 훨씬 견고해 라우팅을 이쪽으로 옮겼다.
> 3. **세션 `.jsonl` 은 인덱스보다 늦게 생긴다.** OpenClaw 는 `sessions.json` 에 먼저
>    올리고 파일은 나중에 flush 한다 (실측: `main` 은 있고 `myjini` 는 아직 없었다).
>    **파일 부재는 오류가 아니라 정상 상태**로 다뤄야 한다 — 오류로 처리하면
>    `_mirror-errors.log` 가 매분 쓰레기로 찬다.

**구현 파일** (커밋 `852481d`):

| 파일 | 책임 |
|---|---|
| `scripts/lucifer/session_index.py` | `sessions.json` 에서 텔레그램 그룹 세션만 추출, 컨테이너→호스트 경로 변환 |
| `scripts/lucifer/session_parse.py` | `.jsonl` 증분 파싱, `(untrusted)` 블록 3종 제거 |
| `scripts/lucifer/mirror.py` | 레지스트리 역참조, 시간순 병합, 마크다운 append, 상태·에러 관리 |
| `scripts/lucifer/test_mirror.py` | 위 3종 단위 테스트 23개 |
| `scripts/lucifer/lucifer-mirror.{service,timer}` | 1분 주기 systemd 유닛 |
| `scripts/lucifer/deploy.sh` | 배포 (미러 파일·유닛 추가) |

- [x] **Step 1: 호스트에서 세션 파일 읽기 가능 확인**

컨테이너 `node` 와 호스트 `stevenlim` 이 둘 다 uid 1000 이라 그대로 읽힌다. 실측 확인됨.

- [x] **Step 2: 실제 텔레그램 세션의 형식 관찰** — 위 "설계 변경" 3건이 여기서 나왔다.

- [x] **Step 3~7: 테스트 우선 구현**

```bash
cd scripts/lucifer && python -m unittest test_mirror
```

Expected: `Ran 23 tests ... OK`

- [x] **Step 8: 배포**

```bash
bash scripts/lucifer/deploy.sh
```

Expected: 서버 테스트 `OK`, `lucifer-convert.timer` 와 `lucifer-mirror.timer` 둘 다 활성.
`enable --now` 라 배포 직후 1회 즉시 실행된다 — 이때 이미 밀린 세션을 소비하므로,
직후 수동 실행이 `mirrored 0` 이어도 실패가 아니다. 출력 파일을 봐야 한다.

- [x] **Step 9: 결과 확인**

```bash
ssh stevenlim@192.168.219.117 'cat /media/stevenlim/TwinverseFolder/Lucifer/TwinverseAI/chat/$(TZ=Asia/Seoul date +%F).md'
```

실측 결과 (2026-07-29):

```markdown
# 2026-07-29

### 19:36 감독님

로이야 안녕?

### 19:36 로이 🦊

안녕하세요, 춘우님! 로이입니다 🦊 반가워요.
```

UTC 10:36 → KST 19:36 변환, 발화자 표기, `_mirror-errors.log` 비어 있음 모두 확인.

### 알려진 공백: 이름을 안 부른 메시지는 미러링되지 않는다

`requireMention` 때문에 이름을 부르지 않은 메시지는 **어느 에이전트의 세션에도
사용자 메시지로 들어가지 않는다.** 따라서 감독님이 그룹에 혼잣말처럼 남긴 내용은
현재 `chat/` 에 안 쌓인다. 설계의 "Claude Code 가 그동안 오간 내용을 따라잡는다" 는
목적에서 보면 실제 손실이다.

복구 경로는 있다 — 사용자 메시지의 `Chat history since last reply` 블록에
`{sender, timestamp_ms, body}` 형태로 그 메시지들이 들어 있다. 다만 같은 메시지가
직접 사용자 메시지로도, 다른 에이전트의 history 블록으로도 나타나므로 **중복 제거가
필요**하고, 그 상태를 유지해야 한다. 이번 범위에서는 구현하지 않았고 후속으로 남긴다.

---

## Task 7: Claude Code 봇 연결 — 완료

`@VScodeOpus_bot` 은 OpenClaw 가 아니라 Claude Code 의 `telegram` 플러그인이 관리한다.
설정이 Windows 쪽(`~/.claude/channels/telegram/`)에 있고 라우팅 테이블도 별개다.

- [x] **Step 1: 토큰을 전사에 남기지 않고 저장한다**

서버에서 로컬 파일로 **직접 파이프**한다. 값이 화면·대화기록에 찍히지 않는다.

```bash
mkdir -p ~/.claude/channels/telegram
ssh stevenlim@192.168.219.117 'set -a; . ~/lucifer-secrets/bot-tokens.env; set +a;   printf "TELEGRAM_BOT_TOKEN=%s
" "$CLAUDE_TOKEN"' > ~/.claude/channels/telegram/.env
```

검증(마스킹된 형태로만):

```bash
awk -F= '/^TELEGRAM_BOT_TOKEN=/{printf "%s...(len=%d)
", substr($2,1,10), length($2)}'   ~/.claude/channels/telegram/.env
```

Expected: `8909970902...(len=46)` — `tg_check.py` 가 보고한 클로드 봇 접두와 일치해야 한다.

- [x] **Step 2: 파일 권한을 잠근다 (Windows)**

Git Bash 의 `chmod 600` 은 Windows 에서 실효가 없다 (`-rw-r--r--` 로 남는다).
자격증명이므로 ACL 로 잠근다.

```powershell
$p = "$env:USERPROFILE\.claude\channels	elegram\.env"
icacls $p /inheritance:r /grant:r "$($env:USERNAME):(R,W)"
```

- [x] **Step 3: 접근 정책을 allowlist 로 잠근다**

감독님 숫자 ID 를 Task 1 에서 이미 확보했으므로 `pairing` 단계를 건너뛴다.
`pairing` 은 ID 를 모를 때 쓰는 임시 수단이지 유지할 정책이 아니다.

`~/.claude/channels/telegram/access.json`:

```json
{
  "dmPolicy": "allowlist",
  "allowFrom": ["1958446460"],
  "groups": {
    "-1004482716134": { "requireMention": true, "allowFrom": ["1958446460"] }
  },
  "pending": {},
  "mentionPatterns": ["클로드", "@VScodeOpus_bot"]
}
```

`mentionPatterns` 에 `` 를 쓰지 않는다 — Task 4 Step 6 과 같은 이유로 한글에서
ASCII 단어경계는 성립하지 않는다.

- [ ] **Step 4: 세션 재시작 후 종단 검증**

플러그인 서버는 `.env` 를 **부팅 시 1회만** 읽는다. 토큰을 새로 넣었으므로
`/reload-plugins` 또는 Claude Code 세션 재시작이 필요하다.
(`access.json` 은 매 인바운드마다 다시 읽으므로 재시작 불필요.)

재시작 뒤 감독님이 `TwinverseAI` 토픽에서 `클로드야 안녕` → 클로드만 응답,
지니·로이 침묵이어야 한다.

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
