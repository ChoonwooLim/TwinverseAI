---
name: end
description: 작업 세션 종료 - 프로젝트 문서 자동 업데이트, 커밋, 요약 보고
user-invocable: true
---

# TwinverseAI 프로젝트 - 작업 세션 종료

작업을 마무리할 때 아래 단계를 순서대로 수행합니다.
**프로젝트 문서(docs/) 자동 업데이트가 핵심입니다.**

## 1단계: 세션 작업 내역 수집

아래 두 명령을 실행하여 이번 세션의 작업 내역을 파악합니다.

// turbo
```
cd c:\WORK\TwinverseAI && git status --short
```

// turbo
```
cd c:\WORK\TwinverseAI && git log --since="midnight" --format="%h %ai %s" --reverse
```

→ 커밋 메시지와 변경 파일을 분석하여 아래 카테고리로 분류합니다:
- **feat**: 새 기능 추가 → `upgrade-log.md`에 기록
- **fix**: 버그 수정 → `bugfix-log.md`에 기록
- **style/refactor/docs/infra**: 기타 → `work-log.md`에 기록
- 마일스톤 진행 상황 변화 → `dev-plan.md`에 반영

## 2단계: docs/ 문서 자동 업데이트

`docs/` 디렉토리의 4개 문서를 **현재 내용을 읽은 뒤 기존 내용 아래에 추가(append)**하는 방식으로 업데이트합니다.
이미 기록된 내용은 절대 삭제하지 않습니다.

### 2-1. docs/work-log.md (작업일지) — 매번 반드시 업데이트

기존 내용 아래에 오늘 날짜 섹션을 추가합니다. 같은 날짜 섹션이 이미 있으면 그 아래에 이어서 작성합니다.

추가할 형식:

```markdown
## (오늘 날짜 YYYY-MM-DD)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | (설명) | 완료 |
| fix | (설명) | 완료 |

### 세부 내용

- (커밋별 또는 작업 단위별 설명)

---
```

### 2-2. docs/bugfix-log.md (버그수정 로그) — fix 커밋이 있을 때만 업데이트

기존 테이블 맨 아래에 행을 추가합니다:

```markdown
| (날짜) | (버그 설명) | (원인) | (수정 내용) | (관련 파일) |
```

### 2-3. docs/upgrade-log.md (업그레이드 로그) — feat 커밋이 있을 때만 업데이트

기존 테이블 맨 아래에 행을 추가합니다:

```markdown
| (날짜) | (변경 내용) | (카테고리) | (관련 파일) |
```

### 2-4. docs/orbitron-server.md (Orbitron 서버) — 서버 상태 변화가 있을 때만 업데이트

SSH로 Orbitron 서버에 접속하여 현재 상태를 확인합니다:

```
ssh stevenlim@192.168.219.101 "nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader && echo '---' && docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' && echo '---' && df -h / | tail -1"
```

아래 항목이 변경된 경우 `docs/orbitron-server.md` 문서를 업데이트합니다:
- 새 컨테이너 추가/삭제
- GPU 드라이버/CUDA 버전 변경
- 디스크 사용량 변화
- 새 소프트웨어 설치 (nvidia-container-toolkit 등)
- Pixel Streaming 배포 준비 상태 변경

### 2-5. docs/dev-plan.md (개발계획서) — 마일스톤/기능 상태 변화가 있을 때만 업데이트

마일스톤 테이블의 상태 컬럼이나 기능 목록 테이블의 상태 컬럼을 업데이트합니다.
새 기능이 추가되었으면 기능 목록 테이블에 행을 추가합니다.

### 업데이트 규칙

1. **기존 내용 보존**: 이전에 기록된 내용은 절대 삭제/수정하지 않는다 (dev-plan.md 상태 컬럼 업데이트 제외)
2. **중복 방지**: 같은 날짜에 이미 동일한 내용이 있으면 추가하지 않는다
3. **커밋 기반 분석**: git log의 커밋 메시지 prefix(feat/fix/style 등)로 카테고리를 판단한다
4. **미커밋 변경사항 포함**: git status의 미커밋 변경사항도 분석하여 포함한다
5. **없는 파일은 건너뛰기**: docs/ 디렉토리나 특정 문서 파일이 없으면 해당 업데이트를 건너뛴다

## 2.5단계: AI 스킬 & 플러그인 목록 자동 동기화

`frontend/src/data/` 의 JSON 파일을 실제 설치된 스킬/플러그인과 동기화합니다.

### 2.5-1. 스킬 동기화 (skills.json)

1. `.claude/skills/` 디렉토리의 모든 SKILL.md 파일을 스캔합니다.
2. 각 SKILL.md의 frontmatter(name, description)를 파싱합니다.
3. `frontend/src/data/skills.json`을 읽습니다.
4. 기존 JSON에 없는 새 스킬이 발견되면 **"자동 발견"** 카테고리에 추가합니다:
   - `name`: 디렉토리명
   - `command`: `/{name}`
   - `desc`: frontmatter의 description
   - `features`: ["자동 감지된 스킬입니다. 상세 기능은 추후 업데이트됩니다."]
   - `usage`: `/` + name + ` 명령으로 실행합니다.`
5. 기존에 있던 스킬이 삭제된 경우에는 JSON에서 제거하지 않습니다.
6. 변경사항이 있으면 JSON 파일을 업데이트합니다.

### 2.5-2. 플러그인 동기화 (plugins.json)

1. `.claude/settings.json`과 `.claude/settings.local.json`을 읽습니다.
2. `enabledPlugins` 배열과 `mcpServers` 객체를 파싱합니다.
3. `frontend/src/data/plugins.json`을 읽습니다.
4. 기존 JSON에 없는 새 플러그인/MCP 서버가 발견되면 해당 카테고리에 추가합니다:
   - **enabledPlugins** → "공식 플러그인" 카테고리에 추가
     - `name`: 플러그인 키 (@ 앞부분)
     - `displayName`: name의 첫 글자 대문자화
     - `source`: 전체 플러그인 식별자
     - `desc`: "자동 감지된 플러그인입니다."
     - `features`: ["자동 감지됨. 상세 기능은 추후 업데이트됩니다."]
     - `usage`: "자동 활성화."
     - `requiresKey`: false
   - **mcpServers** → "MCP 서버" 카테고리에 추가
     - `name`: 서버 키
     - `displayName`: name의 첫 글자 대문자화
     - `source`: args에서 패키지명 추출 (예: `@modelcontextprotocol/server-xxx`)
     - `desc`: "자동 감지된 MCP 서버입니다."
     - `features`: ["자동 감지됨. 상세 기능은 추후 업데이트됩니다."]
     - `usage`: env가 있으면 "환경변수 필요", 없으면 "자동 활성화."
     - `requiresKey`: env 객체가 있으면 true
     - `keyName`: env의 첫 번째 키
5. 변경사항이 있으면 JSON 파일을 업데이트합니다.

### 동기화 규칙

1. **기존 데이터 보존**: 이미 존재하는 스킬/플러그인의 수동 작성된 상세 내용은 절대 덮어쓰지 않는다
2. **추가만 수행**: 새로 발견된 항목만 기본 템플릿으로 추가한다
3. **변경 없으면 건너뛰기**: JSON 파일에 변경사항이 없으면 파일을 수정하지 않는다
4. **JSON 없으면 건너뛰기**: `frontend/src/data/` 디렉토리나 JSON 파일이 없으면 이 단계를 건너뛴다

## 3단계: Git 커밋 & 푸시

미커밋 변경사항(코드 + 문서 업데이트 포함)이 있으면 스테이징 → 커밋 → 푸시합니다.

### 3-1. 스테이징
// turbo
```
cd c:\WORK\TwinverseAI && git add -A
```

### 3-2. 커밋
커밋 메시지 규칙:
- `feat:` 새 기능
- `fix:` 버그 수정
- `style:` UI/디자인 변경
- `refactor:` 코드 리팩토링
- `docs:` 문서 업데이트
- `infra:` 인프라/배포 관련

코드 변경과 문서 업데이트를 하나의 커밋으로 묶습니다.
문서만 업데이트된 경우: `docs: 프로젝트 문서 업데이트 (작업일지, 버그수정 로그 등)`

```
cd c:\WORK\TwinverseAI && git commit -m "커밋메시지"
```

### 3-3. 푸시
// turbo
```
cd c:\WORK\TwinverseAI && git push origin main
```

## 4단계: 세션 종료 보고

사용자에게 아래 형식으로 요약 보고합니다:

```
## 세션 종료 보고

### 오늘 작업 요약
| 카테고리 | 작업 내용 | 상태 |
|---|---|---|
| feat | ... | 완료 |
| fix | ... | 완료 |

### 문서 업데이트
- work-log.md: 업데이트 완료
- bugfix-log.md: (업데이트 / 변경 없음)
- upgrade-log.md: (업데이트 / 변경 없음)
- dev-plan.md: (업데이트 / 변경 없음)
- orbitron-server.md: (업데이트 / 변경 없음)

### Orbitron 서버 상태
- GPU: GTX 1080 x 2 (VRAM 사용량)
- 컨테이너: N개 실행 중
- 디스크: N% 사용

### 스킬/플러그인 동기화
- skills.json: (N개 새 스킬 추가 / 변경 없음)
- plugins.json: (N개 새 플러그인 추가 / 변경 없음)

### Git 상태
- 커밋: N건
- 푸시: 완료 / 대기

### 다음 세션 참고사항
- 미완료 작업이나 주의점 기록

### 다음 세션 추천 작업
- 이어서 할 작업 제안
```
