# LLM Wiki — Cross-Project Obsidian Vault 설계

- **날짜**: 2026-04-21
- **상태**: Draft (브레인스토밍 완료, 사용자 검토 대기)
- **작성자**: Claude Opus 4.7 (brainstorming session)
- **대상 저장소**: `C:\WORK\llm-wiki\` (신규, 독립 git repo)
- **영향 범위**: `C:\WORK\` 하위 모든 프로젝트 (AI_WIKI.md 포인터 배포), `C:\Users\choon\.claude\skills\end\SKILL.md` (Phase 3.6 추가)

---

## 1. 목적

`C:\WORK\` 하위 모든 프로젝트가 공유하는 **LLM/AI 지식 베이스**를 Obsidian 호환 Vault 로 구축한다.

- Steven 이 Obsidian 앱에서 그래프/위키링크로 탐색 가능
- Claude Code 등 AI 에이전트도 각 프로젝트에서 자연스럽게 Wiki 참조 가능 (하이브리드 사용)
- 기존 `C:\WORK\infra-docs\ai-shared-registry.md` 와 **역할 분리**: Registry 는 값 (env/IP/포트/키), Wiki 는 설명 (모델 특성, 프롬프트 패턴, 트러블슈팅, 이유)
- 각 `/end` 세션에서 AI 관련 커밋이 감지되면 Wiki 업데이트를 자동 **제안** (자동 반영 아님 — 제안만)

---

## 2. 주요 결정 사항 (브레인스토밍 합의 결과)

| 항목 | 결정 |
|------|------|
| 주 사용자 | 하이브리드 (Steven + AI 에이전트) |
| 범위 | 일반 LLM 지식 + 프로젝트별 AI 사용 현황 (본인 학습 노트/스크랩 제외) |
| 프로젝트 통합 방식 | 포인터 파일 (`AI_WIKI.md`) 각 프로젝트 루트 배치 + CLAUDE.md 규칙 |
| `ai-shared-registry.md` 와의 경계 | Registry = 값 SSOT, Wiki = 설명 SSOT (drift 방지) |
| Git 전략 | 독립 저장소 (`ChoonwooLim/llm-wiki` 또는 유사) |
| MVP 시드 규모 | ~13 페이지 (Steven 이 실제 쓰는 것 중심) |
| 업데이트 워크플로우 | `/end` 스킬 Phase 3.6 추가 — 키워드 감지 → 사용자 y/n/later 제안 |
| 포인터 배포 대상 | `C:\WORK\` 하위 **모든 프로젝트 디렉터리** (자동 감지, 비프로젝트는 스킵) |

---

## 3. Vault 아키텍처

### 3.1 경로와 Git

- 절대 경로: `C:\WORK\llm-wiki\`
- Git: 독립 저장소 (GitHub private repo 로 push)
- 브랜치: `main`
- 왜 `infra-docs` 가 아닌가: Wiki 는 업데이트 성격 (설명 · 패턴 · 학습) 이 registry (값 SSOT) 와 달라 커밋 히스토리를 분리하는 것이 낫다.

### 3.2 디렉터리 레이아웃

```
llm-wiki/
├── .obsidian/              # Obsidian 설정 (커밋)
├── .gitignore
├── .wiki-sync.json         # /end 동기화 키워드→페이지 매핑 (커밋)
├── .wiki-sync-state.json   # 처리된 커밋 SHA 추적 (gitignore)
├── README.md               # clone 한 사람 가이드
├── 00-Home.md              # Vault MOC 루트
│
├── 10-Models/              # 모델별 설명·비교·특성
│   ├── _Index.md
│   ├── Claude-4x.md
│   ├── Ollama-Models.md
│   └── Comparison.md
│
├── 20-APIs/                # API 레이어
│   ├── _Index.md
│   ├── Anthropic-API.md
│   └── Ollama-HTTP.md
│
├── 30-Prompts/             # 프롬프트 엔지니어링 패턴
│   ├── _Index.md
│   └── Korean-Only.md
│
├── 40-Tools/               # 도구·게이트웨이
│   ├── _Index.md
│   └── OpenClaw.md
│
├── 50-Infrastructure/      # stub 섹션 (MVP 에서는 _Index 만)
│   └── _Index.md
│
├── 60-Projects/            # 프로젝트별 AI 사용 현황 (stub 섹션)
│   └── _Index.md
│
├── 70-Concepts/            # 일반 개념 (stub 섹션)
│   └── _Index.md
│
├── _attachments/           # 이미지·PDF 등 첨부 자동 저장 (Obsidian 설정)
│
└── scripts/
    └── deploy-pointer.ps1  # C:\WORK 전체 프로젝트에 AI_WIKI.md 배포
```

### 3.3 명명·정렬 규칙

- 최상위 섹션에 숫자 prefix (`10-`, `20-` …) — Obsidian 파일 리스트와 AI 탐색에 일관된 순서
- 섹션 인덱스는 `_Index.md` (언더스코어 prefix → 파일 리스트에서 위로)
- 본문 파일은 주제 PascalCase 혹은 `Kebab-Case.md` (예: `Ollama-Models.md`, `Korean-Only.md`)
- 첨부는 `_attachments/YYYY/파일명` 규칙

---

## 4. Obsidian 설정 (`.obsidian/` 커밋 내용)

### 4.1 app.json
```json
{
  "newLinkFormat": "shortest",
  "useMarkdownLinks": false,
  "defaultViewMode": "preview",
  "livePreview": true,
  "alwaysUpdateLinks": true,
  "attachmentFolderPath": "_attachments"
}
```
- 내부 링크는 `[[위키링크]]` (Obsidian 네이티브 우선)
- 외부 Vault 밖 파일 참조는 Markdown 상대 링크 `[text](../path.md)` — Obsidian 이 자동 폴백

### 4.2 appearance.json
```json
{ "theme": "obsidian", "baseFontSize": 15, "cssTheme": "" }
```
- 기본 다크 테마, 외부 CSS 테마 없음

### 4.3 core-plugins.json
```json
{
  "file-explorer": true,
  "global-search": true,
  "outline": true,
  "backlink": true,
  "graph": true,
  "markdown-importer": true,
  "tag-pane": true,
  "templates": true
}
```
- 서드파티 플러그인 없음 (Dataview · Templater 등은 필요할 때 추가)

### 4.4 community-plugins.json
```json
[]
```

### 4.5 .gitignore (Vault 루트)
```
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/cache
.trash/
.wiki-sync-state.json
```

---

## 5. 프로젝트 통합

### 5.1 포인터 파일 — `<project>/AI_WIKI.md`

각 프로젝트 루트에 아래 템플릿 (`<ProjectName>` 부분만 프로젝트별 치환):

```markdown
# AI Wiki Pointer

이 프로젝트의 AI 관련 지식은 **`C:/WORK/llm-wiki/`** (Obsidian Vault) 에 통합되어 있습니다.
AI 모델 · 프롬프트 패턴 · API 사용법 · OpenClaw 게이트웨이 등을 참조할 때는 Wiki 를 우선 사용하세요.

## 주요 엔트리포인트

- **[Home](../llm-wiki/00-Home.md)** — MOC 루트
- **[Claude 4.x](../llm-wiki/10-Models/Claude-4x.md)** — 현재 사용 중인 모델
- **[Ollama Models](../llm-wiki/10-Models/Ollama-Models.md)** — qwen2.5 / gemma3 / llava
- **[Anthropic API](../llm-wiki/20-APIs/Anthropic-API.md)** — SDK · prompt caching · tool use
- **[Korean-Only Directive](../llm-wiki/30-Prompts/Korean-Only.md)** — 한글 전용 응답 보장
- **[OpenClaw](../llm-wiki/40-Tools/OpenClaw.md)** — LAN 게이트웨이 사용법
- **[이 프로젝트 현황](../llm-wiki/60-Projects/<ProjectName>.md)** — 작성된 경우에만

## 참조 경계

- **값** (env/포트/키/IP) 은 [ai-shared-registry](../infra-docs/ai-shared-registry.md) 가 SSOT
- **설명·이유·패턴** 은 Wiki 가 SSOT
- 두 곳이 다르면 Registry 값이 우선
```

### 5.2 CLAUDE.md 전역 규칙 추가

`C:\Users\choon\.claude\CLAUDE.md` 에 한 섹션 추가:

```markdown
## LLM/AI 지식 참조 규칙

`C:\WORK\` 하위 프로젝트에서 AI 모델 · 프롬프트 · API · OpenClaw · Ollama 등
LLM 관련 질문을 받으면:

1. 먼저 해당 프로젝트 루트의 `AI_WIKI.md` 포인터 확인
2. 포인터에서 관련 항목의 Wiki 페이지로 이동 → Read 로 조회
3. Wiki 에 없으면 새 페이지를 만들 것을 제안 (세션 종료 `/end` 가 처리)
4. 값 (env/키/IP/포트) 은 Wiki 가 아닌 `infra-docs/ai-shared-registry.md` 가 SSOT

Wiki 위치: `C:/WORK/llm-wiki/` (Obsidian Vault + 독립 git repo)
```

### 5.3 배포 스크립트 — `scripts/deploy-pointer.ps1`

**동작**:
1. 인자 없으면 `C:\WORK\` 전체 스캔 / 인자 있으면 해당 경로만
2. 각 직접 자식 디렉터리에 대해:
   - 스킵 목록 확인: `bin`, `test.db`, `infra-docs`, `llm-wiki`, `UnrealEngine`
   - 프로젝트 감지: `.git/`, `package.json`, `pyproject.toml`, `requirements.txt`, `*.uproject`, `Dockerfile`, `CMakeLists.txt`, `README.md` 중 하나라도 있으면 프로젝트
3. 감지된 프로젝트마다:
   - `AI_WIKI.md` 가 이미 있으면 스킵 (`-Force` 플래그로 덮어쓰기)
   - 템플릿 복사 + 프로젝트명 치환 (`Get-Content` 로 폴더명 추출)
4. 결과 요약: "배포 N 건, 스킵 M 건 (이미 존재), 비프로젝트 K 건"

**한글/공백 경로 대응**: PowerShell 경로는 항상 `""` 쌍따옴표로 감싸서 전달 (`낙엽의 추억`, `소담김밥` 폴더 포함 가능).

### 5.4 배포 대상 예상 리스트 (C:\WORK 현재 스캔 결과)

- **프로젝트로 판정** (예상 ~27 개): 2025NUKE, Artifex.AI, ArtifexPro, AutoShorts_DT, ContentsHub, EDU_SaaS, F-Team2050, Foo, IIFF, OpenClaw, ProjectForge, ProjectKYHR, Remote_AGT, SEMHANA, SodamFN, TanTanEDU, TwinVerse, TwinVerse-Template, TwinverseAI, TwinverseDesk, TwinversePS2-Deploy, WRA, artifex.ai-studio-pro, gaongn.net, proposal-agent, sodam-jobs, tubeflow, tvg, 낙엽의 추억, 소담김밥
- **스킵**: bin (유틸리티), test.db (파일), infra-docs (자기참조 방지), llm-wiki (자기자신), UnrealEngine (엔진 소스)
- 최종 수는 감지 규칙 실행 시점 상태에 따라 변동

---

## 6. MVP 시드 콘텐츠 (13 페이지)

| # | 페이지 | 목적 | 핵심 내용 | 분량 |
|---|--------|------|-----------|------|
| 1 | `00-Home.md` | Vault MOC 루트 | 7 개 섹션 인덱스 링크 + Wiki 소개 3 줄 | ~40 줄 |
| 2 | `README.md` | clone 후 가이드 | Obsidian 열기 · 링크 규칙 · /end 연동 | ~60 줄 |
| 3 | `10-Models/_Index.md` | 섹션 MOC | 페이지 링크 + 모델 선택 가이드 | ~20 줄 |
| 4 | `10-Models/Claude-4x.md` | Claude 4.x | Opus 4.7 · Sonnet 4.6 · Haiku 4.5 ID / 컨텍스트 / Steven 사용처 | ~80 줄 |
| 5 | `10-Models/Ollama-Models.md` | 로컬 모델 | qwen2.5:7b/0.5b · gemma3:4b/12b · llava:7b · mistral:7b · 한국어 품질 비교 · VRAM | ~100 줄 |
| 6 | `10-Models/Comparison.md` | 선택 가이드 | 작업 유형별 추천 (코드 · 한글 · 비전 · 속도) + 비용 매트릭스 | ~60 줄 |
| 7 | `20-APIs/_Index.md` | 섹션 MOC | API 페이지 링크 | ~20 줄 |
| 8 | `20-APIs/Anthropic-API.md` | Anthropic SDK | 호출 · prompt caching (5 분 TTL · 1024 토큰) · tool use · 스트리밍 · 비용 | ~120 줄 |
| 9 | `20-APIs/Ollama-HTTP.md` | Ollama REST | `/api/generate` `/api/chat` · JSON mode · 멀티모달 (llava base64) · 에러 | ~80 줄 |
| 10 | `30-Prompts/_Index.md` | 섹션 MOC | 프롬프트 패턴 목록 | ~15 줄 |
| 11 | `30-Prompts/Korean-Only.md` | 한글 전용 directive | v1 전문 + Gemma 중국어 drift 사례 + IDENTITY.md 통합법 | ~60 줄 |
| 12 | `40-Tools/_Index.md` | 섹션 MOC | 도구 목록 | ~15 줄 |
| 13 | `40-Tools/OpenClaw.md` | 게이트웨이 | 아키텍처 (LAN/Hostinger 2 인스턴스) · RPC 프레임 · 알려진 이슈 (CLI · scope · agentId) | ~150 줄 |

### 6.1 2 차 확장 (stub 섹션)

다음 페이지들은 MVP 에서는 섹션 `_Index.md` 만 생성하고 본문은 `/end` 훅이 누적 반영:

- `50-Infrastructure/twinverse-ai-Server.md`
- `50-Infrastructure/Shared-Registry-Link.md`
- `60-Projects/TwinverseAI.md`, `60-Projects/SodamFN.md`, `60-Projects/TwinverseDesk.md`
- `70-Concepts/*` (Prompt-Caching · Tool-Use · RAG · Embeddings · Multimodal)
- `30-Prompts/System-Prompts.md`
- `40-Tools/Claude-Code.md`

### 6.2 시드 작성 시 Read 할 원본

- Steven 의 프로젝트 메모: `C:\Users\choon\.claude\projects\c--WORK-TwinverseAI\memory\*.md`
- AI registry: `C:\WORK\infra-docs\ai-shared-registry.md` (링크만)
- 벤치 IDENTITY: TwinverseAI 의 `scripts/bench-identities-tmp/*.md` (삭제 전) 혹은 OpenClaw 컨테이너 내
- OpenClaw 프로토콜: `backend/routers/admin_openclaw_console.py`, `frontend/.../openclaw/ChatTab.jsx`
- Steven 의 CLAUDE.md 메모리 시스템

---

## 7. `/end` 스킬 확장 (Phase 3.6)

### 7.1 감지 로직

`/end` 가 오늘 커밋 (`git log --since="midnight"`) 을 분석할 때 커밋 메시지에서 키워드 매칭.

**감지 키워드** (대소문자 무시, 부분 일치):
- 모델명: `claude`, `ollama`, `qwen`, `gemma`, `mistral`, `llava`, `anthropic`
- 도구/API: `openclaw`, `prompt`, `rpc`, `tool.use`, `vision`, `multimodal`
- 개념: `directive`, `identity.md`, `bench`, `agent`

한 커밋이라도 매치되면 **AI 관련 세션** 판정.

### 7.2 매핑 파일 — `.wiki-sync.json`

Wiki repo 루트에 커밋 (스킬이 런타임에 읽음):

```json
{
  "keywords": {
    "openclaw": ["40-Tools/OpenClaw.md"],
    "ollama|qwen|gemma|llava|mistral": ["10-Models/Ollama-Models.md"],
    "claude": ["10-Models/Claude-4x.md"],
    "prompt.cach": ["20-APIs/Anthropic-API.md#prompt-caching"],
    "identity\\.md|directive": ["30-Prompts/Korean-Only.md"],
    "vision|multimodal": ["10-Models/Ollama-Models.md#llava", "20-APIs/Anthropic-API.md#multimodal"]
  },
  "projectPages": {
    "TwinverseAI": "60-Projects/TwinverseAI.md",
    "SodamFN": "60-Projects/SodamFN.md"
  }
}
```

### 7.3 제안 UI (y/n/later)

```
## LLM Wiki 동기화 제안

오늘 세션에서 AI 관련 변경 N 건 감지됨:
- <sha> <prefix>: <커밋 요약>
- ...

다음 Wiki 페이지가 업데이트될 필요가 있을 수 있습니다:
- C:/WORK/llm-wiki/<path> — <이 페이지가 매칭된 이유>
- ...

지금 반영하시겠습니까? (y/n/later)
- y → Claude 가 페이지를 읽고 git diff 기반 변경 제안 → 승인 시 커밋
- n → 영구 무시 (이번 커밋은 processed)
- later → 미뤄둠 (다음 /end 에서 다시 제안)
```

### 7.4 상태 추적 — `.wiki-sync-state.json` (gitignore)

```json
{
  "processed": { "<project>": ["<sha>", ...] },
  "deferred":  { "<project>": ["<sha>", ...] }
}
```

- `y`/`n` → processed 에 추가 (다시는 제안 안 함)
- `later` → deferred 에 추가
- 다음 /end 는 오늘 커밋 중 processed 가 아닌 것 + 과거 deferred 전체를 후보로 재평가
- 프로젝트별 분리 — TwinverseAI 에서 처리한 SHA 는 SodamFN 에서 평가 대상이 아님 (state 파일의 key 가 프로젝트명)

### 7.5 자동 반영이 아닌 이유

- 커밋 메시지만으로 Wiki 본문을 정확히 쓰는 것은 불안정
- "반영" 은 git diff · 실제 파일 변경을 읽고 요약하는 맥락-무거운 작업
- "제안" 은 패턴 매칭만 → cheap
- 따라서 "제안 = 자동, 반영 = 사용자 y 후 Claude 가 수행"

### 7.6 /end 스킬 수정 규모

- `C:\Users\choon\.claude\skills\end\SKILL.md` 에 Phase 3.6 추가 (~50 줄 문서, 7.7 포함)
- 기존 단계 (docs/work-log 업데이트, Orbitron 체크, 커밋·푸시) 는 변경 없음
- Phase 3.6 는 3 단계 (문서 append) 와 4 단계 (frontend sync) 사이에 삽입

### 7.7 Deferred Triggers — 미래 기술 도입 감지

현재 스택에는 없지만 언젠가 도입할 수 있는 서비스/기술 (예: AWS Bedrock, Google Vertex, RunPod) 에 대한 **선제 등록 메커니즘**. 도입이 실제로 시작될 때 자동 감지·활성화.

#### 7.7.1 목적

- "나중에 AWS 가면 이것도 Wiki 에 추가해야 하는데" 를 **기억에 의존하지 않고 자동 상기**
- 커밋 메시지·diff·파일 경로 어디든 trigger 패턴이 한 번이라도 나타나면 /end 가 포착
- 활성화 전까지는 Wiki 에 빈 페이지를 만들지 않아 노이즈 없음

#### 7.7.2 `_deferred` 블록 구조

`.wiki-sync.json` 의 `keywords` 블록과 동급으로 `_deferred` 오브젝트를 둔다 (언더스코어 prefix 로 "비활성 섹션" 표시):

```json
{
  "keywords": { "...": "..." },
  "_deferred": {
    "aws-bedrock": {
      "trigger": "bedrock|sagemaker|aws\\.ai",
      "when": "TwinverseAI 또는 다른 프로젝트가 AWS 로 이관하거나 Bedrock 모델을 호출하기 시작할 때",
      "pending_mappings": {
        "bedrock|sagemaker": ["20-APIs/AWS-Bedrock.md"],
        "claude-on-bedrock": ["10-Models/Claude-4x.md#bedrock-deployment"]
      },
      "pending_pages": ["20-APIs/AWS-Bedrock.md"],
      "added": "2026-04-21"
    },
    "google-vertex": {
      "trigger": "vertex|gemini|palm",
      "when": "Gemini 모델 평가·배포하거나 Vertex AI 를 쓸 때",
      "pending_mappings": {
        "vertex|gemini": ["20-APIs/Google-Vertex.md"]
      },
      "pending_pages": ["20-APIs/Google-Vertex.md", "10-Models/Gemini.md"],
      "added": "2026-04-21"
    },
    "runpod": {
      "trigger": "runpod|pod-id|serverless\\s*gpu",
      "when": "GPU 트래픽이 LAN twinverse-ai (RTX 3090) 한계 초과로 클라우드 확장 필요할 때",
      "pending_mappings": {
        "runpod|gpu.*cloud": ["50-Infrastructure/RunPod.md"]
      },
      "pending_pages": ["50-Infrastructure/RunPod.md"],
      "added": "2026-04-21"
    }
  }
}
```

**필드 의미**:
- `trigger` — /end 가 감시할 regex (커밋 메시지 · diff · 변경된 파일 경로 전체 대상)
- `when` — 사람이 읽는 활성화 조건 (감사 용도 · 제안 UI 에 표시)
- `pending_mappings` — 활성화 시 `keywords` 블록으로 승격할 매핑
- `pending_pages` — 활성화 시 Wiki 에 새로 만들 페이지 (stub 부터)
- `added` — 이 deferred 블록이 등록된 날짜 (오래된 미활성 블록 감사용)

#### 7.7.3 /end Phase 3.6 의 2-pass 흐름

1. **Pass 1 — active keywords 매칭** (§7.1)
2. **Pass 2 — `_deferred[*].trigger` 매칭**. 오늘 커밋 · diff · 파일 경로에 trigger 가 하나라도 걸리면 특별 UI 출력:

```
🚨 Deferred 블록 활성화 제안

`_deferred.aws-bedrock` 의 trigger 가 감지됨:
- 감지 패턴: bedrock|sagemaker|aws\.ai
- 매치된 커밋: <sha> <메시지>
- 원래 설계 의도: TwinverseAI 또는 다른 프로젝트가 AWS 로 이관하거나 Bedrock 모델을 호출하기 시작할 때

권장 동작:
1. pending_pages 를 llm-wiki 에 stub 으로 생성
2. pending_mappings 를 keywords 블록으로 승격
3. _deferred.aws-bedrock 블록을 _archived 로 이동 (or 삭제)

지금 활성화 전환을 수행할까요? (y/n/later)
- y → Claude 가 스텁 생성 + 매핑 승격 + 블록 이동까지 자동 커밋
- n → 영구 무시 (오탐지 · 활성화 원치 않음)
- later → 다음 /end 에서 다시 제안
```

#### 7.7.4 활성화 시 자동 수행 작업 (y 선택 시)

Claude 가 /end 안에서 다음을 수행:

1. `pending_pages` 의 각 경로에 **stub 페이지** 생성:
   ```markdown
   # <주제명>

   <!-- 2026-MM-DD: _deferred.<block-id> 활성화로 자동 생성된 스텁 -->
   <!-- 활성화 트리거: <sha> <커밋 메시지> -->

   ## 개요

   TBD — 이 주제를 Wiki 에 정리해야 합니다.

   ## 참조 원본

   - <활성화 트리거 커밋>
   - ai-shared-registry 해당 섹션 (있으면 링크)
   ```
2. `pending_mappings` 를 `keywords` 블록에 병합 (기존 키와 충돌하면 경고)
3. `_deferred.<id>` 블록을 `_archived.<id>` 로 이동하고 `activated: "YYYY-MM-DD"` 필드 추가
4. `.wiki-sync.json` 커밋 + stub 페이지 커밋

#### 7.7.5 감사 · 헬스체크

- `/end` 가 `_deferred` 블록의 `added` 필드를 체크해서 **1 년 이상 미활성 블록** 이 있으면 연 1회 "이 블록들이 3 건 대기 중, 여전히 유효한가요?" 를 리마인드 (옵션)
- `_archived` 는 감사 이력으로만 유지 — 재참조 가능

#### 7.7.6 초기 `_deferred` 예시 등록

MVP 배포 시 위 3 개 블록 (`aws-bedrock`, `google-vertex`, `runpod`) 을 기본 포함. 앞으로 Steven 이 "언젠가 쓸 것 같은" 기술 발견 시마다 한 블록씩 추가 (예: `azure-openai`, `together-ai`, `groq`, `tensorRT`, `finetune`).

---

## 8. 리스크 평가

| 리스크 | 등급 | 완화 방안 |
|--------|------|----------|
| Wiki 와 Registry 가 drift (프로젝트 현황 중복) | P1 | 명확한 규칙: 값=Registry, 설명=Wiki. Wiki 페이지는 Registry 섹션 링크만. CLAUDE.md 에 규칙 명시 |
| 포인터 파일이 프로젝트 루트를 오염 | P3 | 단 하나의 얇은 파일 (`AI_WIKI.md`, 15 줄). 이름이 명확해서 혼동 없음 |
| `/end` 제안이 귀찮아져서 끄고 싶어짐 | P2 | y/n/later 3 옵션, 특히 `n` 으로 영구 무시 가능. 감지 키워드가 겹치는 프로젝트 (sodam-jobs 처럼 AI 안 쓰는 것) 는 빈 `.wiki-sync.json` 매핑으로 off |
| 한글/공백 폴더 경로에서 배포 스크립트 실패 | P2 | PowerShell 항상 쌍따옴표 경로 사용 테스트, `낙엽의 추억`·`소담김밥` 케이스 단위 테스트 |
| Obsidian 설정 변경이 커밋 히스토리 오염 | P3 | `.obsidian/workspace.json` gitignore. 설정 변경 커밋은 년 1~2 회 수준 |
| MVP 13 페이지 작성 시간 초과 | P2 | Steven 의 메모리 시스템과 기존 TwinverseAI docs 재사용. 분량은 100 줄 내외 제한. 2~3 시간 목표 |
| 매핑 파일 regex 실수로 모든 커밋 매칭 | P2 | 초기 매핑은 보수적 (AND 조건 아닌 알려진 키워드만). /end 가 후보 페이지 3 개 초과하면 경고 |
| `_deferred` 블록이 영원히 잠자서 노이즈 됨 | P3 | `added` 필드로 연 1회 감사 리마인드 (§7.7.5). 1 년+ 미활성 블록 자동 경고 |
| `_deferred` trigger regex 오탐지 (일반 단어에 매칭) | P2 | `when` 필드에 활성화 조건 명시. 제안 UI 가 원래 의도를 보여주고 `n` 으로 영구 무시 가능 |

---

## 9. 롤백 계획

- **Wiki 자체 삭제**: `C:\WORK\llm-wiki\` 디렉터리 삭제 + GitHub repo 삭제
- **포인터 파일 일괄 제거**: `scripts/deploy-pointer.ps1 -Remove` 플래그 추가 구현, 각 프로젝트의 `AI_WIKI.md` 만 제거
- **CLAUDE.md 규칙 복원**: 해당 섹션 1 개 삭제 (git revert)
- **/end 스킬 복원**: SKILL.md 에서 Phase 3.6 섹션 제거 (git revert)
- 어느 단계든 독립적으로 롤백 가능 — 모든 변경이 additive

---

## 10. 검증 체크리스트

- [ ] Obsidian 에서 `C:\WORK\llm-wiki\` 열기 → 다크 테마 + 위키링크 정상
- [ ] 00-Home.md 에서 모든 섹션 `_Index.md` 링크 클릭 가능
- [ ] 각 `_Index.md` 에서 MVP 페이지들 클릭 가능
- [ ] Obsidian graph view 에서 페이지 간 연결 시각화 확인
- [ ] `scripts/deploy-pointer.ps1` 실행 → 27+ 개 프로젝트에 `AI_WIKI.md` 배치
- [ ] 한글 폴더 (`낙엽의 추억`, `소담김밥`) 에도 정상 배치 확인
- [ ] 전역 `CLAUDE.md` 규칙이 `~/.claude/CLAUDE.md` 에 반영
- [ ] TwinverseAI 에서 Claude Code 새 세션 → AI 질문 시 Wiki 참조하는지 확인
- [ ] `/end` 를 AI 관련 커밋이 있는 세션에서 실행 → 제안 UI 가 뜨는지
- [ ] `/end` 에서 y 선택 → Wiki 변경 diff 제안 정상 생성
- [ ] `/end` 에서 later 선택 → 다음 세션에 다시 제안
- [ ] GitHub repo 에 Wiki 최초 push 성공
- [ ] `_deferred.aws-bedrock.trigger` 가 걸리는 테스트 커밋 메시지로 /end 실행 → 활성화 제안 UI 출력 확인
- [ ] 활성화 제안에서 y 선택 → stub 페이지 · 매핑 승격 · `_archived` 이동 자동 수행 확인

---

## 11. 다음 단계

1. Steven 이 이 spec 을 검토
2. 수정 요청 반영 (필요 시)
3. 승인되면 `writing-plans` 스킬로 구현 계획 (implementation plan) 작성
4. 계획에 따라 구현: Vault 스켈레톤 → MVP 시드 → 배포 스크립트 → /end 확장 → CLAUDE.md 규칙 추가
