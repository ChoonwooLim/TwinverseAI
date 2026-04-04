---
name: project-start
description: 원스톱 프로젝트 부트스트랩 - "project start" 입력 시 /init → MCP 세팅 → /end 까지 자동 실행
user-invocable: true
---

# TwinverseAI 원스톱 프로젝트 부트스트랩

사용자가 "project start"를 입력하면 아래 전체 파이프라인을 자동으로 실행합니다.
**중간에 사용자 입력 없이 끝까지 완주합니다.**

---

## 전체 흐름

```
project start
  ├── Phase 1: 환경 사전 점검
  ├── Phase 2: /init 실행 (프로젝트 구조 + 코드 + GitHub)
  ├── Phase 3: MCP 서버 설정
  ├── Phase 4: Python venv + 의존성 설치
  ├── Phase 5: Frontend 의존성 설치
  ├── Phase 6: /end 실행 (문서 업데이트 + 커밋 + 푸시)
  └── Phase 7: 최종 보고
```

---

## Phase 1: 환경 사전 점검

아래 도구들이 설치되어 있는지 확인합니다. 없으면 사용자에게 안내 후 중단합니다.

```bash
git --version && gh auth status && node --version && npm --version && python --version && pip --version
```

### 필수 도구 목록

| 도구 | 확인 명령 | 미설치 시 안내 |
|------|----------|---------------|
| Git | `git --version` | `winget install Git.Git` |
| GitHub CLI | `gh auth status` | `winget install GitHub.cli` → `gh auth login` |
| Node.js | `node --version` | `winget install OpenJS.NodeJS.LTS` |
| Python | `python --version` | `winget install Python.Python.3.12` |
| Docker (선택) | `docker --version` | MCP puppeteer/postgres 등에 필요 시 설치 |

→ 하나라도 없으면 설치 안내 메시지를 출력하고 **중단**합니다.
→ 모두 있으면 다음 단계로 진행합니다.

## Phase 2: /init 실행

`/init` 스킬의 1단계~12단계를 순서대로 실행합니다:

1. Git 초기화
2. .gitignore 생성
3. 디렉토리 구조 생성
4. Backend 파일 생성 (main.py, database.py, models, routers, services, deps.py)
5. 프로젝트 문서 생성 (docs/ 4개 마크다운)
6. Frontend Vite 프로젝트 생성 (npm create vite)
7. Frontend 페이지/컴포넌트 생성 (HomePage, LoginPage, DashboardPage, DocViewerPage 등)
8. Orbitron.yaml 생성
9. CLAUDE.md 생성
10. SuperAdmin seed 스크립트 생성
11. .agents 워크플로우 문서 업데이트
12. 초기 커밋
13. GitHub public 리포지토리 생성 + 푸시

**`/init` 스킬의 모든 단계를 그대로 따릅니다.**

## Phase 3: MCP 서버 설정

프로젝트 `.claude/settings.local.json`에 MCP 서버 10개를 설정합니다.
기존 설정(permissions 등)은 유지하면서 `mcpServers` 키를 추가/병합합니다.

### 설정할 MCP 서버 10개

아래 내용을 `.claude/settings.local.json`의 `mcpServers` 키에 추가합니다:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<gh auth token 자동 삽입>"
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "<backend/.env의 DATABASE_URL 값 복사>"
      }
    },
    "puppeteer": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "<사용자에게 확인>"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "<프로젝트 루트 경로>"]
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    },
    "docker": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-docker"]
    }
  }
}
```

### MCP 설정 자동화 규칙

1. **github**: `gh auth token` 명령으로 토큰을 자동 추출하여 삽입
2. **postgres**: `backend/.env` 또는 `.env.example`의 `DATABASE_URL` 값을 복사
3. **filesystem**: 현재 프로젝트 루트 절대 경로를 자동 삽입
4. **brave-search**: API 키가 필요 → 사용자에게 키 입력 요청, 없으면 이 서버만 건너뛰기
5. **나머지**: 추가 설정 없이 바로 사용 가능

### MCP 서버 설명

| # | 서버 | 용도 | API 키 필요 |
|---|------|------|------------|
| 1 | **Context7** | 라이브러리 최신 문서 조회 (React, FastAPI 등) | 없음 |
| 2 | **GitHub** | Issue, PR, 리포지토리 관리 | gh auth 토큰 |
| 3 | **PostgreSQL** | DB 직접 쿼리, 스키마 조회 | DATABASE_URL |
| 4 | **Puppeteer** | 브라우저 자동화, 스크린샷, 테스트 | 없음 |
| 5 | **Sequential Thinking** | 복잡한 문제 단계별 추론 | 없음 |
| 6 | **Memory** | 지식 그래프 기반 장기 기억 | 없음 |
| 7 | **Brave Search** | 웹 검색 (최신 정보 조회) | Brave API 키 |
| 8 | **Filesystem** | 확장 파일 시스템 조작 | 없음 |
| 9 | **Fetch** | 외부 HTTP API 호출 | 없음 |
| 10 | **Docker** | 컨테이너 관리, 로그 조회 | 없음 |

## Phase 4: Python 가상환경 + 의존성 설치

```bash
cd c:\WORK\TwinverseAI/backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
```

→ Windows 환경이므로 `.venv/Scripts/pip` 사용
→ 설치 완료 후 간단한 import 테스트:

```bash
cd c:\WORK\TwinverseAI/backend && .venv/Scripts/python -c "from fastapi import FastAPI; print('Backend dependencies OK')"
```

## Phase 5: Frontend 의존성 설치

`/init` Phase 6에서 `npm install`이 이미 실행되었으므로, 누락된 경우에만 재실행:

```bash
cd c:\WORK\TwinverseAI/frontend && npm install
```

## Phase 6: /end 실행

`/end` 스킬을 실행합니다:

1. 세션 작업 내역 수집 (git status + git log)
2. docs/ 문서 자동 업데이트 (work-log.md에 초기 세팅 기록)
3. Git 커밋 & 푸시
4. 세션 종료 보고 생성

**`/end` 스킬의 모든 단계를 그대로 따릅니다.**

## Phase 7: 최종 보고

모든 단계가 완료되면 사용자에게 아래 형식으로 최종 보고합니다:

```
## 프로젝트 부트스트랩 완료

### 생성된 프로젝트
- 이름: (프로젝트명)
- GitHub: (리포지토리 URL)
- 스택: FastAPI + React + Vite + PostgreSQL

### 환경 상태
| 항목 | 상태 |
|------|------|
| Git 초기화 | 완료 |
| GitHub 리포지토리 | public, 푸시 완료 |
| Backend (Python .venv) | 설치 완료 |
| Frontend (node_modules) | 설치 완료 |
| MCP 서버 (10개) | 설정 완료 |
| 프로젝트 문서 (4개) | 생성 완료 |
| Orbitron 배포 설정 | 생성 완료 |

### MCP 서버 현황
| 서버 | 상태 |
|------|------|
| context7 | 설정 완료 |
| github | 설정 완료 |
| postgres | 설정 완료 (DB 연결은 .env 작성 후) |
| puppeteer | 설정 완료 |
| sequential-thinking | 설정 완료 |
| memory | 설정 완료 |
| brave-search | (설정 완료 / API 키 미입력 - 건너뜀) |
| filesystem | 설정 완료 |
| fetch | 설정 완료 |
| docker | 설정 완료 |

### 다음 필수 작업
1. `backend/.env` 파일 작성 (DATABASE_URL, SECRET_KEY)
2. `cd backend && .venv/Scripts/python seed_admin.py` (SuperAdmin 생성)
3. 로컬 테스트 실행:
   - Backend: `cd backend && .venv/Scripts/uvicorn main:app --reload`
   - Frontend: `cd frontend && npm run dev`
4. 브라우저에서 http://localhost:5173 접속 확인
5. `docs/dev-plan.md` 개발계획서 작성
6. Orbitron에 환경변수 등록 후 배포
```

---

## 에러 처리

각 Phase에서 에러가 발생하면:

1. **Phase 1 실패** (도구 미설치): 설치 안내 출력 후 **중단**
2. **Phase 2 실패** (init): 에러 내용 출력, 수동 복구 안내 후 **중단**
3. **Phase 3 실패** (MCP): 실패한 서버만 건너뛰고 **계속 진행**
4. **Phase 4 실패** (pip): 에러 출력, `requirements.txt` 확인 안내 후 **계속 진행**
5. **Phase 5 실패** (npm): 에러 출력, `package.json` 확인 안내 후 **계속 진행**
6. **Phase 6 실패** (end): 에러 출력, 수동 커밋 안내 후 **계속 진행**

→ Phase 1~2는 치명적이므로 중단, Phase 3~6은 비치명적이므로 경고 후 계속 진행합니다.
