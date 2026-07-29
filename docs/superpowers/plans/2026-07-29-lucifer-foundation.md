# Lucifer 공유 공간 기반 구현 계획 (계획 1/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Steven·지니·로이·Claude Code 넷이 같은 폴더를 읽고 쓸 수 있게 만든다. 텔레그램 없이도 파일로 소통 가능한 상태가 이 계획의 완성점이다.

**Architecture:** Orbitron의 Samba 공유(`/srv/TwinverseFolder`) 아래 `Lucifer/` 트리를 만들고, twinverse-ai 호스트가 이미 CIFS로 마운트하고 있는 경로를 openclaw 컨테이너에 `/shared`로 bind mount 한다. 컨테이너 재생성이 필요하며, 게이트웨이 토큰은 env로 고정돼 있어 드리프트하지 않는다.

**Tech Stack:** Docker, CIFS/Samba, bash, JSON

## Global Constraints

- **모든 `docker exec`는 `-u node`로 실행한다.** root로 실행하면 `openclaw.json`이 root 소유가 되어 config watcher가 EACCES로 죽고, 이후 모든 설정 변경이 반영되지 않는다.
- 컨테이너 `node` = uid/gid **1000**, 호스트 `stevenlim` = uid/gid **1000**, CIFS 강제 `uid=1000,gid=1000`. 세 값이 일치해야 쓰기가 된다.
- `OPENCLAW_GATEWAY_TOKEN` 값을 **절대 화면에 출력하지 않는다.** 셸 변수로만 전달한다.
- 컨테이너 재생성 시 기존 인자를 하나도 빠뜨리지 않는다. 정확한 현재 구성:
  - image `ghcr.io/hostinger/hvps-openclaw:latest`
  - cmd `node server.mjs`
  - `--network host`, `--restart unless-stopped`
  - bind `/srv/openclaw/data:/data`
  - env `OPENCLAW_PORT=18789`, `OPENCLAW_HOST=0.0.0.0`, `OPENCLAW_GATEWAY_TOKEN=<기존값>`
- `TRAEFIK_HOST` 환경변수를 추가하지 않는다 (2026-04-29 회귀 사례).
- 서버 접속: `ssh stevenlim@192.168.219.117`

## 경로 대응표

| 보는 위치 | 경로 |
|---|---|
| Steven (Windows) | `Z:\TwinverseFolder\Lucifer\` |
| twinverse-ai 호스트 | `/media/stevenlim/TwinverseFolder/Lucifer/` |
| 컨테이너 (지니·로이) | `/shared/` |

---

## File Structure

| 파일 | 책임 |
|---|---|
| `Lucifer/_registry.json` | 등록된 프로젝트 ↔ 토픽 매핑. 계획 3·4가 소비하는 인터페이스 |
| `Lucifer/_common/` | 프로젝트 무관 공용 (에러 로그 등) |
| `Lucifer/TwinverseAI/{chat,memo,data,handoff}/` | TwinverseAI 방 |
| `~/.claude/projects/c--WORK-TwinverseAI/memory/feedback_handoff_txt_z_drive.md` | 핸드오프 경로 규칙 (갱신 대상) |

---

## Task 1: 공유 폴더 구조와 레지스트리 생성

**Files:**
- Create: `/media/stevenlim/TwinverseFolder/Lucifer/_registry.json`
- Create: `Lucifer/_common/`, `Lucifer/TwinverseAI/{chat,memo,data/_ai,handoff}/`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `_registry.json` 스키마 — 계획 3이 `projects.<name>.topicId`를 채우고, 계획 4의 `/lucifer add`가 항목을 추가한다.

- [ ] **Step 1: 아직 없음을 확인 (실패 검증)**

```bash
ssh stevenlim@192.168.219.117 "ls -d /media/stevenlim/TwinverseFolder/Lucifer 2>&1"
```

Expected: `ls: cannot access ...: No such file or directory`

- [ ] **Step 2: 디렉토리 생성**

```bash
ssh stevenlim@192.168.219.117 "
R=/media/stevenlim/TwinverseFolder/Lucifer
mkdir -p \$R/_common \$R/TwinverseAI/chat \$R/TwinverseAI/memo \$R/TwinverseAI/data/_ai \$R/TwinverseAI/handoff
find \$R -type d | sort
"
```

Expected: 7개 디렉토리가 나열됨

- [ ] **Step 3: `_registry.json` 작성**

로컬에서 파일을 만들어 scp 한다 (SSH 따옴표 중첩으로 JSON이 깨지는 것을 피한다).

`_registry.json` 내용:

```json
{
  "version": 1,
  "group": {
    "title": "Lucifer",
    "chatId": null
  },
  "projects": {
    "TwinverseAI": {
      "windowsPath": "C:\\WORK\\TwinverseAI",
      "folder": "TwinverseAI",
      "topicId": null,
      "addedAt": "2026-07-29"
    }
  }
}
```

`chatId`와 `topicId`는 계획 3(텔레그램 연결)에서 채운다. 지금은 `null`이 정상이다.

```bash
scp _registry.json stevenlim@192.168.219.117:/media/stevenlim/TwinverseFolder/Lucifer/_registry.json
```

- [ ] **Step 4: JSON 유효성과 소유권 검증**

```bash
ssh stevenlim@192.168.219.117 "
python3 -c 'import json;d=json.load(open(\"/media/stevenlim/TwinverseFolder/Lucifer/_registry.json\"));print(\"projects:\", list(d[\"projects\"]))'
ls -l /media/stevenlim/TwinverseFolder/Lucifer/_registry.json
"
```

Expected: `projects: ['TwinverseAI']` 그리고 소유자가 `stevenlim stevenlim`

- [ ] **Step 5: Windows 쪽에서 보이는지 확인**

```bash
ls -R /z/TwinverseFolder/Lucifer/ | head -20
```

Expected: 같은 트리가 보임. 안 보이면 CIFS 캐시 문제이므로 `ls /z/TwinverseFolder/` 를 먼저 실행해 갱신한다.

- [ ] **Step 6: 커밋**

공유 드라이브는 git 대상이 아니므로 커밋할 것이 없다. 대신 진행 상황을 계획 문서에 체크만 하고 다음 태스크로 넘어간다.

---

## Task 2: 컨테이너에 `/shared` 마운트 (재생성)

**Files:**
- Modify: openclaw 컨테이너 (재생성)

**Interfaces:**
- Consumes: Task 1의 `Lucifer/` 디렉토리
- Produces: 컨테이너 내부 경로 `/shared` — 계획 2(변환 워처)와 계획 3(미러링)이 이 경로에 의존한다.

- [ ] **Step 1: 현재 상태를 기록 (재생성 후 비교용)**

```bash
ssh stevenlim@192.168.219.117 "
echo '--- 토큰 해시 (전) ---'
docker exec -u node openclaw node -e 'const fs=require(\"fs\"),cr=require(\"crypto\");const c=JSON.parse(fs.readFileSync(\"/data/.openclaw/openclaw.json\",\"utf8\"));const g=c.gateway||{};const h=v=>v?cr.createHash(\"sha256\").update(v).digest(\"hex\").slice(0,16):\"(none)\";console.log(\"auth\",h(g.auth&&g.auth.token));console.log(\"remote\",h(g.remote&&g.remote.token));'
echo '--- 인증 (전) ---'
docker exec openclaw openclaw models status 2>&1 | grep -A1 'claude-cli\$' | head -3
echo '--- 에이전트 수 (전) ---'
docker exec openclaw openclaw agents list 2>&1 | grep -c '^- '
"
```

이 출력을 메모해 둔다. Step 6에서 그대로 대조한다.

- [ ] **Step 2: `/shared` 가 아직 없음을 확인 (실패 검증)**

```bash
ssh stevenlim@192.168.219.117 "docker exec -u node openclaw ls -d /shared 2>&1"
```

Expected: `ls: /shared: No such file or directory`

- [ ] **Step 3: 컨테이너 재생성**

토큰은 기존 컨테이너에서 읽어 셸 변수로만 넘긴다. 출력하지 않는다.

```bash
ssh stevenlim@192.168.219.117 '
set -e
TOKEN=$(docker inspect openclaw --format "{{range .Config.Env}}{{println .}}{{end}}" | grep "^OPENCLAW_GATEWAY_TOKEN=" | cut -d= -f2-)
if [ -z "$TOKEN" ]; then echo "FATAL: token not found, aborting"; exit 1; fi

docker rm -f openclaw

docker run -d \
  --name openclaw \
  --restart unless-stopped \
  --network host \
  -v /srv/openclaw/data:/data \
  --mount type=bind,source=/media/stevenlim/TwinverseFolder/Lucifer,target=/shared,bind-propagation=rslave \
  -e OPENCLAW_PORT=18789 \
  -e OPENCLAW_HOST=0.0.0.0 \
  -e OPENCLAW_GATEWAY_TOKEN="$TOKEN" \
  ghcr.io/hostinger/hvps-openclaw:latest \
  node server.mjs

echo "recreated"
'
```

`bind-propagation=rslave`를 쓰는 이유: 공유 드라이브가 `x-systemd.automount` CIFS 마운트이므로, 호스트에서 나중에 (재)마운트되어도 컨테이너 안에 반영되게 하기 위함이다.

- [ ] **Step 4: 기동 대기**

```bash
ssh stevenlim@192.168.219.117 '
for i in $(seq 1 15); do
  sleep 4
  if docker exec openclaw sh -c "curl -s -o /dev/null --max-time 3 http://127.0.0.1:18789/" 2>/dev/null; then
    echo "gateway up after $((i*4))s"; break
  fi
  echo "waiting ${i}"
done
'
```

Expected: `gateway up after ...`

- [ ] **Step 5: `/shared` 읽기·쓰기 검증**

```bash
ssh stevenlim@192.168.219.117 "
docker exec -u node openclaw sh -c 'ls -la /shared/ && touch /shared/_common/.container-write-test && echo WRITE_OK'
ls -l /media/stevenlim/TwinverseFolder/Lucifer/_common/.container-write-test
docker exec -u node openclaw rm -f /shared/_common/.container-write-test
"
```

Expected: `Lucifer/` 트리가 보이고 `WRITE_OK`, 호스트에서도 같은 파일이 보임

- [ ] **Step 6: 재생성 전후 대조 (회귀 검증)**

```bash
ssh stevenlim@192.168.219.117 "
echo '--- 토큰 해시 (후) ---'
docker exec -u node openclaw node -e 'const fs=require(\"fs\"),cr=require(\"crypto\");const c=JSON.parse(fs.readFileSync(\"/data/.openclaw/openclaw.json\",\"utf8\"));const g=c.gateway||{};const h=v=>v?cr.createHash(\"sha256\").update(v).digest(\"hex\").slice(0,16):\"(none)\";console.log(\"auth\",h(g.auth&&g.auth.token));console.log(\"remote\",h(g.remote&&g.remote.token));'
echo '--- 인증 (후) ---'
docker exec openclaw openclaw models status 2>&1 | grep -A1 'claude-cli\$' | head -3
echo '--- 에이전트 수 (후) ---'
docker exec openclaw openclaw agents list 2>&1 | grep -c '^- '
echo '--- config 소유권 (node:node 여야 함) ---'
docker exec openclaw sh -c 'ls -l /data/.openclaw/openclaw.json'
"
```

Expected:
- 토큰 해시 2개가 Step 1과 **동일** → TwinverseAI 재배포 불필요
- `anthropic:claude-cli ok expires in 365d` 유지
- 에이전트 수 동일 (24)
- `openclaw.json` 소유자가 `node node`

**해시가 다르면 즉시 중단하고 보고한다.** TwinverseAI 백엔드의 `OPENCLAW_TOKEN` 재동기화가 필요해진다.

---

## Task 3: 지니·로이 종단 검증

**Files:** 없음 (동작 검증만)

**Interfaces:**
- Consumes: Task 2의 `/shared` 마운트
- Produces: 없음

- [ ] **Step 1: 지니에게 `/shared` 쓰기를 시킨다**

```bash
ssh stevenlim@192.168.219.117 "
timeout 200 docker exec openclaw openclaw agent --agent myjini \
  -m '/shared/TwinverseAI/memo/hello-from-jini.md 파일을 만들고 거기에 자기소개를 한 문단 써줘. 다 쓰면 완료했다고만 답해.' \
  --json 2>&1 | head -30
"
```

Expected: `status: ok`

- [ ] **Step 2: 감독님 Windows 에서 보이는지 확인**

```bash
cat "/z/TwinverseFolder/Lucifer/TwinverseAI/memo/hello-from-jini.md"
```

Expected: 지니가 쓴 한국어 자기소개가 보임

이것이 이 계획의 핵심 성공 신호다. **AI가 쓴 파일을 감독님이 탐색기에서 바로 열 수 있다.**

- [ ] **Step 3: 로이도 같은 경로를 읽는지 확인**

```bash
ssh stevenlim@192.168.219.117 "
timeout 200 docker exec openclaw openclaw agent --agent main \
  -m '/shared/TwinverseAI/memo/hello-from-jini.md 를 읽고 지니가 뭐라고 썼는지 한 문장으로 요약해줘.' \
  --json 2>&1 | node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const j=JSON.parse(s);console.log(((j.result.payloads||[])[0]||{}).text);}catch(e){console.log(s.slice(0,400));}})'
"
```

Expected: 로이가 지니의 글을 요약해서 답함 → 두 에이전트가 같은 파일 공간을 공유함이 증명됨

- [ ] **Step 4: 파일 소유권 확인**

```bash
ssh stevenlim@192.168.219.117 "ls -l /media/stevenlim/TwinverseFolder/Lucifer/TwinverseAI/memo/"
```

Expected: 소유자 `stevenlim stevenlim` (CIFS가 uid 1000으로 강제하므로 정상)

---

## Task 4: 핸드오프 위치 이관과 메모리 규칙 갱신

**Files:**
- Move: `Z:\TwinverseFolder\TODO-claude-max-recovery-20260729.txt` → `Lucifer/TwinverseAI/handoff/`
- Modify: `~/.claude/projects/c--WORK-TwinverseAI/memory/feedback_handoff_txt_z_drive.md`

**Interfaces:**
- Consumes: Task 1의 `handoff/` 디렉토리
- Produces: 갱신된 메모리 규칙 — 이후 모든 세션의 핸드오프 문서가 새 경로로 간다.

- [ ] **Step 1: 기존 핸드오프 문서 이동**

```bash
mv "/z/TwinverseFolder/TODO-claude-max-recovery-20260729.txt" \
   "/z/TwinverseFolder/Lucifer/TwinverseAI/handoff/TODO-claude-max-recovery-20260729.txt"
ls -l "/z/TwinverseFolder/Lucifer/TwinverseAI/handoff/"
```

Expected: 파일이 새 위치에 있음

- [ ] **Step 2: 메모리 규칙 갱신**

`~/.claude/projects/c--WORK-TwinverseAI/memory/feedback_handoff_txt_z_drive.md` 의
frontmatter `description` 을 다음으로 교체:

```
description: 감독님이 직접 수행해야 할 작업 절차는 항상 Lucifer 공유 공간의 handoff 폴더에 txt 파일로 작성할 것
```

본문 첫 문단을 다음으로 교체:

```markdown
감독님이 직접 실행해야 하는 단계(브라우저 인증, 물리적 조작, 대화형 명령 등)가 생기면
채팅으로만 안내하지 말고 **항상 txt 파일로 작성**한다.

- Lucifer 에 등록된 프로젝트: `Z:\TwinverseFolder\Lucifer\<프로젝트>\handoff\`
- 등록되지 않은 프로젝트: `Z:\TwinverseFolder\` 루트 (기존 방식)

등록 여부는 `Z:\TwinverseFolder\Lucifer\_registry.json` 의 `projects` 키로 확인한다.
2026-07-29 지시: "앞으로는 항상 이 방식으로 텍스트 만들어줘".
```

파일 마지막 `관련:` 줄에 `[[reference-lucifer-workspace]]` 를 추가한다.

- [ ] **Step 3: MEMORY.md 인덱스 문구 갱신**

`~/.claude/projects/c--WORK-TwinverseAI/memory/MEMORY.md` 의 해당 줄을 교체:

```markdown
- [핸드오프 txt는 Lucifer로](feedback_handoff_txt_z_drive.md) — 감독님이 직접 할 작업은 Z:\TwinverseFolder\Lucifer\<프로젝트>\handoff\ 에 txt로 작성 (미등록 프로젝트는 루트)
```

- [ ] **Step 4: 검증**

```bash
grep -n "Lucifer" ~/.claude/projects/c--WORK-TwinverseAI/memory/feedback_handoff_txt_z_drive.md
grep -n "Lucifer" ~/.claude/projects/c--WORK-TwinverseAI/memory/MEMORY.md
```

Expected: 두 파일 모두 새 경로를 언급함

- [ ] **Step 5: 계획 문서 커밋**

```bash
git add docs/superpowers/plans/2026-07-29-lucifer-foundation.md
git commit -m "docs: Lucifer 기반 구현 계획 (1/4) 완료 체크"
```

---

## 완료 조건

이 계획이 끝나면 다음이 모두 참이어야 한다.

1. `Z:\TwinverseFolder\Lucifer\TwinverseAI\{chat,memo,data,handoff}\` 가 존재한다
2. `_registry.json` 에 TwinverseAI 가 등록돼 있다 (`topicId`는 아직 `null`)
3. 컨테이너에서 `/shared` 로 읽고 쓸 수 있다
4. 게이트웨이 토큰 해시가 재생성 전후 동일하다 (재배포 불필요)
5. `anthropic:claude-cli` 인증이 365d 로 유지된다
6. 지니가 쓴 파일을 감독님이 Windows 탐색기에서 연다
7. 로이가 그 파일을 읽는다
8. 핸드오프 문서가 새 경로로 이관되고 메모리 규칙이 갱신됐다

## 다음 계획

- **계획 2: 미디어 변환** — libreoffice·yt-dlp 설치, `data/` → `data/_ai/` 워처
- **계획 3: 텔레그램 연결** — 감독님이 봇 3개를 만든 뒤 진행
- **계획 4: 전역 스킬** — `/lucifer` 명령과 등록제
