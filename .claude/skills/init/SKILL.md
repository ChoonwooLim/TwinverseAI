---
name: init
description: 프로젝트 초기 세팅 - Git, 디렉토리 구조, 인증, 어드민 대시보드, 프로젝트 문서, 스킬/플러그인 뷰어, Orbitron 배포 자동 생성 (FastAPI + React + Vite + PostgreSQL)
user-invocable: true
---

# TwinverseAI 프로젝트 초기 세팅

프로젝트를 처음 시작할 때 이 스킬을 실행하면 모든 기본 구조를 자동으로 생성합니다.
**메인 웹사이트 + 로그인 + 어드민 대시보드 + 프로젝트 문서 시스템 + 스킬/플러그인 관리 + Orbitron 배포 + PostgreSQL DB** 가 기본 포함됩니다.

---

## 1단계: Git 초기화

```bash
cd c:\WORK\TwinverseAI && git init -b main
```

## 2단계: .gitignore 생성

`c:\WORK\TwinverseAI\.gitignore` 파일을 생성합니다:

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.venv/
venv/
env/
*.egg-info/
dist/
build/

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Vite / React
frontend/dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
desktop.ini

# Uploads (로컬 fallback)
uploads/

# Logs
*.log
```

## 3단계: 프로젝트 디렉토리 구조 생성

```
c:\WORK\TwinverseAI\
├── backend/
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py            # 로그인/회원가입/토큰
│   │   ├── admin.py           # 어드민 전용 API
│   │   ├── docs.py            # 프로젝트 문서 API
│   │   ├── skills.py          # 스킬 목록/상세 API
│   │   └── plugins.py         # 플러그인(MCP) 목록/관리 API
│   ├── models/
│   │   ├── __init__.py
│   │   └── user.py            # User 모델 (role 포함)
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth_service.py    # 비밀번호 해싱, JWT 생성/검증
│   ├── main.py
│   ├── database.py
│   ├── deps.py                # 의존성 (get_current_user 등)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── Layout.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── DashboardPage.jsx    # 어드민 대시보드
│   │   │   ├── HomePage.jsx         # 메인 랜딩페이지
│   │   │   ├── DocViewerPage.jsx    # 마크다운 문서 뷰어
│   │   │   ├── SkillsPage.jsx       # 스킬 목록 및 상세 보기
│   │   │   └── PluginsPage.jsx      # 플러그인 관리 (조회/수정/추가)
│   │   ├── services/
│   │   │   └── api.js               # axios 인스턴스 + 인터셉터
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── docs/                      # 프로젝트 문서 (마크다운)
│   ├── dev-plan.md
│   ├── bugfix-log.md
│   ├── upgrade-log.md
│   └── work-log.md
├── Orbitron.yaml
├── .gitignore
├── CLAUDE.md
└── README.md
```

### 디렉토리 생성 명령:

```bash
cd c:\WORK\TwinverseAI && mkdir -p backend/routers backend/models backend/services frontend/src/components frontend/src/pages frontend/src/services docs
```

## 4단계: Backend 기본 파일 생성

### backend/main.py

```python
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db_and_tables
from routers import auth, admin, docs, skills, plugins

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="TwinverseAI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
app.include_router(skills.router, prefix="/api/skills", tags=["skills"])
app.include_router(plugins.router, prefix="/api/plugins", tags=["plugins"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
```

### backend/database.py

```python
import os
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/twinverseai")
engine = create_engine(DATABASE_URL, echo=False)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
```

### backend/models/user.py

```python
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: str = Field(default="user")  # "user" | "admin" | "superadmin"
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
```

### backend/models/__init__.py

```python
from .user import User
```

### backend/services/auth_service.py

```python
import os
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt, JWTError

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24시간

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
```

### backend/deps.py

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from database import get_session
from models import User
from services.auth_service import decode_access_token

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = session.exec(select(User).where(User.id == payload.get("sub"))).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
```

### backend/routers/__init__.py

빈 파일로 생성합니다.

### backend/routers/auth.py

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import User
from services.auth_service import hash_password, verify_password, create_access_token
from deps import get_current_user

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == body.username)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "role": user.role},
    )

@router.post("/register", response_model=TokenResponse)
def register(body: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(
        select(User).where((User.username == body.username) | (User.email == body.email))
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username or email already exists")
    user = User(
        username=body.username,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    token = create_access_token({"sub": user.id, "role": user.role})
    return TokenResponse(
        access_token=token,
        user={"id": user.id, "username": user.username, "role": user.role},
    )

@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "email": user.email, "role": user.role}
```

### backend/routers/admin.py

```python
from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from database import get_session
from models import User
from deps import require_admin

router = APIRouter()

@router.get("/dashboard")
def admin_dashboard(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    total_users = session.exec(select(func.count(User.id))).one()
    active_users = session.exec(select(func.count(User.id)).where(User.is_active == True)).one()
    return {
        "total_users": total_users,
        "active_users": active_users,
        "admin": admin.username,
    }

@router.get("/users")
def list_users(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [
        {"id": u.id, "username": u.username, "email": u.email, "role": u.role, "is_active": u.is_active}
        for u in users
    ]
```

### backend/routers/docs.py

```python
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

DOCS_DIR = Path(__file__).resolve().parent.parent.parent / "docs"

DOC_FILES = {
    "dev-plan": "dev-plan.md",
    "bugfix-log": "bugfix-log.md",
    "upgrade-log": "upgrade-log.md",
    "work-log": "work-log.md",
}

@router.get("/list")
def list_docs():
    result = []
    for key, filename in DOC_FILES.items():
        filepath = DOCS_DIR / filename
        result.append({"key": key, "filename": filename, "exists": filepath.exists()})
    return result

@router.get("/{doc_key}")
def get_doc(doc_key: str):
    if doc_key not in DOC_FILES:
        raise HTTPException(status_code=404, detail="Document not found")
    filepath = DOCS_DIR / DOC_FILES[doc_key]
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Document file not found")
    return {"key": doc_key, "content": filepath.read_text(encoding="utf-8")}
```

### backend/routers/skills.py

```python
"""스킬 목록 및 상세 정보 API — .claude/skills/ 디렉토리를 스캔"""
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

SKILLS_DIR = Path(__file__).resolve().parent.parent.parent / ".claude" / "skills"

def _parse_skill(skill_dir: Path) -> dict | None:
    """SKILL.md 파일을 파싱하여 frontmatter + body를 반환"""
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        return None
    text = skill_file.read_text(encoding="utf-8")

    # frontmatter 파싱
    meta = {}
    body = text
    fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if fm_match:
        for line in fm_match.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = fm_match.group(2)

    return {
        "key": skill_dir.name,
        "name": meta.get("name", skill_dir.name),
        "description": meta.get("description", ""),
        "user_invocable": meta.get("user-invocable", "false").lower() == "true",
        "body": body.strip(),
    }

@router.get("/list")
def list_skills():
    """사용 가능한 모든 스킬 목록 (이름 + 설명)"""
    if not SKILLS_DIR.exists():
        return []
    skills = []
    for d in sorted(SKILLS_DIR.iterdir()):
        if d.is_dir():
            parsed = _parse_skill(d)
            if parsed:
                skills.append({
                    "key": parsed["key"],
                    "name": parsed["name"],
                    "description": parsed["description"],
                    "user_invocable": parsed["user_invocable"],
                })
    return skills

@router.get("/{skill_key}")
def get_skill(skill_key: str):
    """스킬 상세 정보 (전체 마크다운 본문 포함)"""
    skill_dir = SKILLS_DIR / skill_key
    if not skill_dir.exists():
        raise HTTPException(status_code=404, detail="Skill not found")
    parsed = _parse_skill(skill_dir)
    if not parsed:
        raise HTTPException(status_code=404, detail="SKILL.md not found")
    return parsed
```

### backend/routers/plugins.py

```python
"""플러그인(MCP 서버) 관리 API — .claude/settings.local.json의 mcpServers를 읽고 쓴다"""
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

SETTINGS_FILE = Path(__file__).resolve().parent.parent.parent / ".claude" / "settings.local.json"

# MCP 서버 설명 매핑 (서버별 상세 정보)
MCP_INFO = {
    "context7": {
        "display_name": "Context7",
        "description": "React, FastAPI, SQLModel 등 라이브러리의 최신 공식 문서를 실시간 조회합니다.",
        "usage": "코드 작성 시 자동으로 최신 API 문서를 참조합니다. 별도 호출 없이 AI가 자동 활용합니다.",
        "requires_key": False,
    },
    "github": {
        "display_name": "GitHub",
        "description": "GitHub Issue 생성/조회, PR 관리, 리포지토리 조작을 AI가 직접 수행합니다.",
        "usage": "'이슈 만들어줘', 'PR 리뷰해줘' 등의 요청으로 사용합니다. gh auth 토큰이 필요합니다.",
        "requires_key": True,
        "key_name": "GITHUB_PERSONAL_ACCESS_TOKEN",
    },
    "postgres": {
        "display_name": "PostgreSQL",
        "description": "프로젝트 DB에 직접 쿼리하여 스키마 조회, 데이터 확인, 디버깅을 수행합니다.",
        "usage": "'DB에서 사용자 테이블 확인해줘', '최근 주문 조회해줘' 등으로 사용합니다.",
        "requires_key": True,
        "key_name": "DATABASE_URL",
    },
    "puppeteer": {
        "display_name": "Puppeteer",
        "description": "헤드리스 브라우저를 제어하여 페이지 스크린샷, UI 테스트, 웹 스크래핑을 수행합니다.",
        "usage": "'로그인 페이지 스크린샷 찍어줘', '이 URL에서 데이터 가져와줘' 등으로 사용합니다.",
        "requires_key": False,
    },
    "sequential-thinking": {
        "display_name": "Sequential Thinking",
        "description": "복잡한 문제를 단계별로 분해하여 체계적으로 추론합니다.",
        "usage": "복잡한 아키텍처 설계나 디버깅 시 AI가 자동으로 활용합니다.",
        "requires_key": False,
    },
    "memory": {
        "display_name": "Memory",
        "description": "지식 그래프 기반으로 대화 간 장기 기억을 저장하고 관리합니다.",
        "usage": "'이거 기억해줘', '지난번에 말한 거 뭐였지?' 등으로 사용합니다.",
        "requires_key": False,
    },
    "brave-search": {
        "display_name": "Brave Search",
        "description": "웹 검색을 통해 최신 정보, 에러 해결법, 문서를 실시간으로 조회합니다.",
        "usage": "'이 에러 검색해줘', '최신 React 19 변경사항 찾아줘' 등으로 사용합니다.",
        "requires_key": True,
        "key_name": "BRAVE_API_KEY",
    },
    "filesystem": {
        "display_name": "Filesystem",
        "description": "확장된 파일 시스템 작업 — 파일 검색, 이동, 복사, 디렉토리 트리 조회 등을 수행합니다.",
        "usage": "파일 관련 복잡한 작업 시 AI가 자동으로 활용합니다.",
        "requires_key": False,
    },
    "fetch": {
        "display_name": "Fetch",
        "description": "외부 HTTP API를 호출하거나 웹페이지 내용을 가져옵니다.",
        "usage": "'이 API 호출해줘', '이 URL 내용 확인해줘' 등으로 사용합니다.",
        "requires_key": False,
    },
    "docker": {
        "display_name": "Docker",
        "description": "Docker 컨테이너 관리 — 이미지 빌드, 컨테이너 실행, 로그 조회 등을 수행합니다.",
        "usage": "'도커 컨테이너 목록 보여줘', '이미지 빌드해줘' 등으로 사용합니다.",
        "requires_key": False,
    },
}

def _read_settings() -> dict:
    if not SETTINGS_FILE.exists():
        return {}
    return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))

def _write_settings(data: dict):
    SETTINGS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

@router.get("/list")
def list_plugins():
    """설치된 MCP 플러그인 목록 + 상세 정보"""
    settings = _read_settings()
    servers = settings.get("mcpServers", {})
    result = []
    for key, config in servers.items():
        info = MCP_INFO.get(key, {})
        result.append({
            "key": key,
            "display_name": info.get("display_name", key),
            "description": info.get("description", ""),
            "usage": info.get("usage", ""),
            "requires_key": info.get("requires_key", False),
            "key_name": info.get("key_name", ""),
            "command": config.get("command", ""),
            "args": config.get("args", []),
            "env": {k: ("***" if v else "") for k, v in config.get("env", {}).items()},
            "is_configured": all(bool(v) for v in config.get("env", {}).values()) if config.get("env") else True,
        })
    return result

@router.get("/{plugin_key}")
def get_plugin(plugin_key: str):
    """플러그인 상세 정보"""
    settings = _read_settings()
    servers = settings.get("mcpServers", {})
    if plugin_key not in servers:
        raise HTTPException(status_code=404, detail="Plugin not found")
    config = servers[plugin_key]
    info = MCP_INFO.get(plugin_key, {})
    return {
        "key": plugin_key,
        "display_name": info.get("display_name", plugin_key),
        "description": info.get("description", ""),
        "usage": info.get("usage", ""),
        "requires_key": info.get("requires_key", False),
        "key_name": info.get("key_name", ""),
        "command": config.get("command", ""),
        "args": config.get("args", []),
        "env": config.get("env", {}),
        "is_configured": all(bool(v) for v in config.get("env", {}).values()) if config.get("env") else True,
    }

class PluginUpdateRequest(BaseModel):
    env: dict[str, str] | None = None

@router.put("/{plugin_key}")
def update_plugin(plugin_key: str, body: PluginUpdateRequest):
    """플러그인 환경변수 수정 (API 키 설정 등)"""
    settings = _read_settings()
    servers = settings.get("mcpServers", {})
    if plugin_key not in servers:
        raise HTTPException(status_code=404, detail="Plugin not found")
    if body.env is not None:
        if "env" not in servers[plugin_key]:
            servers[plugin_key]["env"] = {}
        servers[plugin_key]["env"].update(body.env)
    settings["mcpServers"] = servers
    _write_settings(settings)
    return {"status": "updated", "key": plugin_key}

class PluginCreateRequest(BaseModel):
    key: str
    command: str
    args: list[str]
    env: dict[str, str] | None = None
    display_name: str = ""
    description: str = ""

@router.post("/add")
def add_plugin(body: PluginCreateRequest):
    """새 MCP 플러그인 추가"""
    settings = _read_settings()
    if "mcpServers" not in settings:
        settings["mcpServers"] = {}
    if body.key in settings["mcpServers"]:
        raise HTTPException(status_code=400, detail="Plugin already exists")
    new_server = {"command": body.command, "args": body.args}
    if body.env:
        new_server["env"] = body.env
    settings["mcpServers"][body.key] = new_server
    _write_settings(settings)
    # display_name, description은 런타임 정보 → MCP_INFO에는 저장하지 않음
    return {"status": "added", "key": body.key}

@router.delete("/{plugin_key}")
def remove_plugin(plugin_key: str):
    """MCP 플러그인 삭제"""
    settings = _read_settings()
    servers = settings.get("mcpServers", {})
    if plugin_key not in servers:
        raise HTTPException(status_code=404, detail="Plugin not found")
    del servers[plugin_key]
    settings["mcpServers"] = servers
    _write_settings(settings)
    return {"status": "removed", "key": plugin_key}
```

### backend/services/__init__.py

빈 파일로 생성합니다.

### backend/requirements.txt

```
fastapi
uvicorn[standard]
sqlmodel
psycopg2-binary
python-dotenv
passlib[bcrypt]
python-jose[cryptography]
```

### backend/.env.example

```env
DATABASE_URL=postgresql://user:password@192.168.219.101:5432/twinverseai
SECRET_KEY=change-me-in-production
FRONTEND_URL=https://your-domain.twinverse.org
SUPERADMIN_USERNAME=admin
SUPERADMIN_PASSWORD=admin1234
```

## 5단계: 프로젝트 문서 초기 파일 생성

### docs/dev-plan.md

```markdown
# 개발계획서

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

## 프로젝트 개요

- **프로젝트명**: (프로젝트명)
- **시작일**: (시작일)
- **기술 스택**: FastAPI + React + Vite + PostgreSQL
- **배포**: Orbitron

## 마일스톤

| 단계 | 목표 | 상태 | 예정일 |
|------|------|------|--------|
| 1 | 프로젝트 초기 세팅 | 완료 | (날짜) |

## 기능 목록

| 기능 | 설명 | 우선순위 | 상태 |
|------|------|----------|------|
| 인증 시스템 | JWT 로그인/회원가입 | 높음 | 완료 |
| 어드민 대시보드 | 사용자 관리 | 높음 | 완료 |
| 프로젝트 문서 | 개발계획서/버그로그/작업일지 | 높음 | 완료 |
| 스킬 뷰어 | 사용 가능한 AI 스킬 조회 | 중간 | 완료 |
| 플러그인 관리 | MCP 플러그인 조회/수정/추가 | 중간 | 완료 |
```

### docs/bugfix-log.md

```markdown
# 버그수정 로그

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

| 날짜 | 버그 설명 | 원인 | 수정 내용 | 관련 파일 |
|------|----------|------|----------|----------|
```

### docs/upgrade-log.md

```markdown
# 업그레이드 로그

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |
|------|----------|----------|----------|
```

### docs/work-log.md

```markdown
# 작업일지

> 이 문서는 /end 스킬 호출 시 자동 업데이트됩니다.

## (날짜)

### 작업 요약

| 카테고리 | 작업 내용 | 상태 |
|----------|----------|------|
| feat | 프로젝트 초기 구조 생성 | 완료 |

### 세부 내용

- 프로젝트 초기 세팅 완료 (FastAPI + React + Vite)
- 인증 시스템 (JWT) 구현
- 어드민 대시보드 기본 구조 생성
- 프로젝트 문서 시스템 구성
- 스킬 뷰어 + 플러그인 관리 페이지 생성

---
```

## 6단계: Frontend 프로젝트 생성

### 6-1. Vite 프로젝트 생성

```bash
cd c:\WORK\TwinverseAI/frontend && npm create vite@latest . -- --template react && npm install && npm install axios react-router-dom react-markdown
```

### 6-2. frontend/src/services/api.js

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
```

### 6-3. frontend/src/components/ProtectedRoute.jsx

```jsx
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole && user?.role !== "superadmin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
```

### 6-4. frontend/src/pages/LoginPage.jsx

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/api/auth/login", { username, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate(data.user.role === "admin" || data.user.role === "superadmin" ? "/admin" : "/");
    } catch {
      setError("로그인에 실패했습니다.");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "100px auto", padding: 24 }}>
      <h1>로그인</h1>
      <form onSubmit={handleLogin}>
        <input placeholder="아이디" value={username} onChange={(e) => setUsername(e.target.value)} style={{ display: "block", width: "100%", marginBottom: 12, padding: 8 }} />
        <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} style={{ display: "block", width: "100%", marginBottom: 12, padding: 8 }} />
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" style={{ width: "100%", padding: 10 }}>로그인</button>
      </form>
    </div>
  );
}
```

### 6-5. frontend/src/pages/HomePage.jsx (랜딩페이지 — 문서 + 스킬 + 플러그인 메뉴)

```jsx
import { Link } from "react-router-dom";

const DOC_MENU = [
  { key: "dev-plan", label: "개발계획서", icon: "📋", desc: "프로젝트 마일스톤과 기능 목록" },
  { key: "bugfix-log", label: "버그수정 로그", icon: "🐛", desc: "발견 및 수정된 버그 기록" },
  { key: "upgrade-log", label: "업그레이드 로그", icon: "🚀", desc: "기능 추가 및 개선 이력" },
  { key: "work-log", label: "작업일지", icon: "📝", desc: "일별 작업 내역 및 진행 상황" },
];

const TOOL_MENU = [
  { path: "/skills", label: "AI 스킬", icon: "🧠", desc: "사용 가능한 Claude 스킬 목록 및 상세 설명" },
  { path: "/plugins", label: "플러그인 (MCP)", icon: "🔌", desc: "설치된 MCP 플러그인 조회, 설정, 추가" },
];

const cardStyle = {
  display: "block",
  padding: 24,
  background: "#f8fafc",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  textDecoration: "none",
  color: "inherit",
  transition: "box-shadow 0.2s, transform 0.2s",
};

export default function HomePage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const handleHover = (e, on) => {
    e.currentTarget.style.boxShadow = on ? "0 4px 12px rgba(0,0,0,0.1)" : "none";
    e.currentTarget.style.transform = on ? "translateY(-2px)" : "none";
  };

  return (
    <div style={{ maxWidth: 900, margin: "60px auto", padding: 24 }}>
      <header style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: 36, marginBottom: 8 }}>TwinverseAI</h1>
        <p style={{ color: "#64748b", fontSize: 18 }}>프로젝트 허브</p>
        <div style={{ marginTop: 16 }}>
          {user ? (
            <>
              <span>{user.username}님 환영합니다</span>
              {(user.role === "admin" || user.role === "superadmin") && (
                <Link to="/admin" style={{ marginLeft: 16 }}>어드민 대시보드</Link>
              )}
            </>
          ) : (
            <Link to="/login">로그인</Link>
          )}
        </div>
      </header>

      {/* 프로젝트 문서 */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 24, marginBottom: 20 }}>프로젝트 문서</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {DOC_MENU.map((doc) => (
            <Link key={doc.key} to={`/docs/${doc.key}`} style={cardStyle}
              onMouseOver={(e) => handleHover(e, true)} onMouseOut={(e) => handleHover(e, false)}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{doc.icon}</div>
              <h3 style={{ fontSize: 18, marginBottom: 4 }}>{doc.label}</h3>
              <p style={{ color: "#64748b", fontSize: 14 }}>{doc.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* AI 도구 */}
      <section>
        <h2 style={{ fontSize: 24, marginBottom: 20 }}>AI 도구</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {TOOL_MENU.map((tool) => (
            <Link key={tool.path} to={tool.path} style={cardStyle}
              onMouseOver={(e) => handleHover(e, true)} onMouseOut={(e) => handleHover(e, false)}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{tool.icon}</div>
              <h3 style={{ fontSize: 18, marginBottom: 4 }}>{tool.label}</h3>
              <p style={{ color: "#64748b", fontSize: 14 }}>{tool.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
```

### 6-6. frontend/src/pages/DocViewerPage.jsx

```jsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../services/api";

const DOC_TITLES = {
  "dev-plan": "개발계획서",
  "bugfix-log": "버그수정 로그",
  "upgrade-log": "업그레이드 로그",
  "work-log": "작업일지",
};

export default function DocViewerPage() {
  const { docKey } = useParams();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/docs/${docKey}`)
      .then(({ data }) => setContent(data.content))
      .catch(() => setContent("문서를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, [docKey]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <Link to="/" style={{ color: "#64748b", textDecoration: "none" }}>← 홈으로</Link>
      <h1 style={{ marginTop: 16, marginBottom: 24 }}>{DOC_TITLES[docKey] || docKey}</h1>
      {loading ? <p>로딩중...</p> : (
        <div style={{ background: "#f8fafc", padding: 32, borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

### 6-7. frontend/src/pages/SkillsPage.jsx (스킬 목록 + 상세 보기)

```jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../services/api";

export default function SkillsPage() {
  const [skills, setSkills] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/skills/list").then(({ data }) => {
      setSkills(data);
      setLoading(false);
    });
  }, []);

  const handleSelect = (key) => {
    if (selected === key) {
      setSelected(null);
      setDetail(null);
      return;
    }
    setSelected(key);
    setDetail(null);
    api.get(`/api/skills/${key}`).then(({ data }) => setDetail(data));
  };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <Link to="/" style={{ color: "#64748b", textDecoration: "none" }}>← 홈으로</Link>
      <h1 style={{ marginTop: 16, marginBottom: 8 }}>AI 스킬</h1>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Claude Code에서 사용 가능한 스킬 목록입니다. 스킬을 클릭하면 상세 설명을 볼 수 있습니다.
      </p>

      {loading ? <p>로딩중...</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {skills.map((s) => (
            <div key={s.key}>
              <div
                onClick={() => handleSelect(s.key)}
                style={{
                  padding: 20,
                  background: selected === s.key ? "#e0f2fe" : "#f8fafc",
                  borderRadius: 12,
                  border: selected === s.key ? "2px solid #0284c7" : "1px solid #e2e8f0",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                      /{s.name}
                      {s.user_invocable && (
                        <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", background: "#dcfce7", color: "#166534", borderRadius: 12 }}>
                          실행 가능
                        </span>
                      )}
                    </h3>
                    <p style={{ color: "#64748b", fontSize: 14 }}>{s.description}</p>
                  </div>
                  <span style={{ fontSize: 20, color: "#94a3b8" }}>{selected === s.key ? "▲" : "▼"}</span>
                </div>
              </div>

              {selected === s.key && detail && (
                <div style={{ margin: "0 12px", padding: 24, background: "#fff", border: "1px solid #e2e8f0", borderTop: "none", borderRadius: "0 0 12px 12px" }}>
                  <ReactMarkdown>{detail.body}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6-8. frontend/src/pages/PluginsPage.jsx (플러그인 관리 — 조회/수정/추가)

```jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

export default function PluginsPage() {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editEnv, setEditEnv] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newPlugin, setNewPlugin] = useState({ key: "", command: "npx", args: "", env_key: "", env_value: "" });
  const [message, setMessage] = useState("");

  const loadPlugins = () => {
    api.get("/api/plugins/list").then(({ data }) => {
      setPlugins(data);
      setLoading(false);
    });
  };

  useEffect(() => { loadPlugins(); }, []);

  const handleEdit = (plugin) => {
    if (editingKey === plugin.key) {
      setEditingKey(null);
      return;
    }
    setEditingKey(plugin.key);
    // 상세 정보 가져오기 (마스킹 안 된 env)
    api.get(`/api/plugins/${plugin.key}`).then(({ data }) => {
      setEditEnv(data.env || {});
    });
  };

  const handleSave = async (pluginKey) => {
    await api.put(`/api/plugins/${pluginKey}`, { env: editEnv });
    setEditingKey(null);
    setMessage(`${pluginKey} 설정이 저장되었습니다.`);
    setTimeout(() => setMessage(""), 3000);
    loadPlugins();
  };

  const handleAdd = async () => {
    const args = newPlugin.args.split(" ").filter(Boolean);
    const env = newPlugin.env_key ? { [newPlugin.env_key]: newPlugin.env_value } : undefined;
    try {
      await api.post("/api/plugins/add", { key: newPlugin.key, command: newPlugin.command, args, env });
      setShowAdd(false);
      setNewPlugin({ key: "", command: "npx", args: "", env_key: "", env_value: "" });
      setMessage(`${newPlugin.key} 플러그인이 추가되었습니다.`);
      setTimeout(() => setMessage(""), 3000);
      loadPlugins();
    } catch (err) {
      setMessage(err.response?.data?.detail || "추가 실패");
    }
  };

  const handleRemove = async (pluginKey) => {
    if (!confirm(`${pluginKey} 플러그인을 삭제하시겠습니까?`)) return;
    await api.delete(`/api/plugins/${pluginKey}`);
    setMessage(`${pluginKey} 플러그인이 삭제되었습니다.`);
    setTimeout(() => setMessage(""), 3000);
    loadPlugins();
  };

  const inputStyle = { display: "block", width: "100%", padding: 8, marginBottom: 8, border: "1px solid #d1d5db", borderRadius: 6 };

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 24 }}>
      <Link to="/" style={{ color: "#64748b", textDecoration: "none" }}>← 홈으로</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, marginBottom: 8 }}>
        <h1>플러그인 (MCP)</h1>
        <button onClick={() => setShowAdd(!showAdd)} style={{ padding: "8px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          + 새 플러그인
        </button>
      </div>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        Claude Code에 연결된 MCP 플러그인입니다. 환경변수 수정, 새 플러그인 추가/삭제가 가능합니다.
      </p>

      {message && (
        <div style={{ padding: 12, background: "#dcfce7", color: "#166534", borderRadius: 8, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {/* 새 플러그인 추가 폼 */}
      {showAdd && (
        <div style={{ padding: 20, background: "#eff6ff", borderRadius: 12, border: "1px solid #bfdbfe", marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12 }}>새 MCP 플러그인 추가</h3>
          <input placeholder="키 (예: my-server)" value={newPlugin.key} onChange={(e) => setNewPlugin({ ...newPlugin, key: e.target.value })} style={inputStyle} />
          <input placeholder="명령어 (예: npx)" value={newPlugin.command} onChange={(e) => setNewPlugin({ ...newPlugin, command: e.target.value })} style={inputStyle} />
          <input placeholder="인자 (공백 구분, 예: -y @org/server)" value={newPlugin.args} onChange={(e) => setNewPlugin({ ...newPlugin, args: e.target.value })} style={inputStyle} />
          <input placeholder="환경변수 키 (선택, 예: API_KEY)" value={newPlugin.env_key} onChange={(e) => setNewPlugin({ ...newPlugin, env_key: e.target.value })} style={inputStyle} />
          {newPlugin.env_key && (
            <input placeholder="환경변수 값" value={newPlugin.env_value} onChange={(e) => setNewPlugin({ ...newPlugin, env_value: e.target.value })} style={inputStyle} />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={handleAdd} style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>추가</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: "8px 16px", background: "#e5e7eb", border: "none", borderRadius: 6, cursor: "pointer" }}>취소</button>
          </div>
        </div>
      )}

      {loading ? <p>로딩중...</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {plugins.map((p) => (
            <div key={p.key} style={{
              padding: 20,
              background: p.is_configured ? "#f8fafc" : "#fff7ed",
              borderRadius: 12,
              border: p.is_configured ? "1px solid #e2e8f0" : "1px solid #fed7aa",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 4 }}>
                    {p.display_name || p.key}
                    {!p.is_configured && (
                      <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 12 }}>
                        설정 필요
                      </span>
                    )}
                    {p.is_configured && (
                      <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", background: "#dcfce7", color: "#166534", borderRadius: 12 }}>
                        활성
                      </span>
                    )}
                  </h3>
                  <p style={{ color: "#64748b", fontSize: 14, marginBottom: 4 }}>{p.description}</p>
                  {p.usage && <p style={{ color: "#94a3b8", fontSize: 13 }}>사용법: {p.usage}</p>}
                  <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                    {p.command} {p.args.join(" ")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleEdit(p)} style={{ padding: "6px 12px", background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                    {editingKey === p.key ? "닫기" : "설정"}
                  </button>
                  <button onClick={() => handleRemove(p.key)} style={{ padding: "6px 12px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                    삭제
                  </button>
                </div>
              </div>

              {/* 환경변수 편집 */}
              {editingKey === p.key && (
                <div style={{ marginTop: 16, padding: 16, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <h4 style={{ marginBottom: 8 }}>환경변수</h4>
                  {Object.keys(editEnv).length === 0 ? (
                    <p style={{ color: "#94a3b8", fontSize: 13 }}>환경변수 없음</p>
                  ) : (
                    Object.entries(editEnv).map(([k, v]) => (
                      <div key={k} style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{k}</label>
                        <input
                          value={v}
                          onChange={(e) => setEditEnv({ ...editEnv, [k]: e.target.value })}
                          placeholder={`${k} 값 입력`}
                          style={inputStyle}
                        />
                      </div>
                    ))
                  )}
                  <button onClick={() => handleSave(p.key)} style={{ padding: "8px 16px", background: "#0284c7", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
                    저장
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6-9. frontend/src/pages/DashboardPage.jsx

```jsx
import { useEffect, useState } from "react";
import api from "../services/api";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/api/admin/dashboard").then(({ data }) => setStats(data));
  }, []);

  if (!stats) return <p>로딩중...</p>;

  return (
    <div style={{ maxWidth: 800, margin: "60px auto", padding: 24 }}>
      <h1>어드민 대시보드</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 24 }}>
        <div style={{ padding: 24, background: "#f1f5f9", borderRadius: 8 }}>
          <h3>전체 사용자</h3>
          <p style={{ fontSize: 32, fontWeight: "bold" }}>{stats.total_users}</p>
        </div>
        <div style={{ padding: 24, background: "#f1f5f9", borderRadius: 8 }}>
          <h3>활성 사용자</h3>
          <p style={{ fontSize: 32, fontWeight: "bold" }}>{stats.active_users}</p>
        </div>
      </div>
    </div>
  );
}
```

### 6-10. frontend/src/App.jsx

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DocViewerPage from "./pages/DocViewerPage";
import SkillsPage from "./pages/SkillsPage";
import PluginsPage from "./pages/PluginsPage";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/docs/:docKey" element={<DocViewerPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/plugins" element={<PluginsPage />} />
        <Route path="/admin" element={
          <ProtectedRoute requiredRole="admin">
            <DashboardPage />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
```

## 7단계: /frontend-design 스킬로 UI 디자인 적용

6단계에서 생성된 모든 프론트엔드 페이지에 `/frontend-design` 스킬을 호출하여 프로덕션급 디자인을 자동 적용합니다.

### 적용 대상 페이지

| 페이지 | 경로 | 디자인 방향 |
|--------|------|------------|
| HomePage.jsx | `/` | 히어로 섹션 + 카드 그리드 랜딩페이지, 그라디언트 배경, 호버 애니메이션 |
| LoginPage.jsx | `/login` | 미니멀 센터 카드, 브랜드 컬러, 인풋 포커스 애니메이션 |
| DashboardPage.jsx | `/admin` | 스탯 카드 + 데이터 테이블, 대시보드 레이아웃 |
| DocViewerPage.jsx | `/docs/:key` | 깔끔한 마크다운 타이포그래피, 사이드 네비게이션 |
| SkillsPage.jsx | `/skills` | 아코디언 카드 목록, 배지, 코드블록 하이라이팅 |
| PluginsPage.jsx | `/plugins` | 상태 표시 카드, 인라인 편집 폼, 추가/삭제 인터랙션 |

### 실행 방법

`/frontend-design` 스킬을 호출하면서 아래 지침을 전달합니다:

**디자인 요구사항:**
- 프레임워크: React + Vite (CSS-in-JS 또는 CSS Module 중 프로젝트에 맞는 방식)
- 스타일: 모던, 미니멀, 프리미엄 — Slate 기반 다크/라이트 조합
- 색상 팔레트: Primary `#0284c7` (Sky Blue), Neutral `#1e293b` ~ `#f8fafc` (Slate)
- 반응형: Mobile-First, 모바일/태블릿/데스크탑 대응
- 애니메이션: 카드 fadeInUp 순차 등장, 호버 리프트, 부드러운 전환
- 타이포그래피: 시스템 폰트 스택, 명확한 계층 (hero > section title > body)
- 다크모드: 선택적 (기본은 라이트, 추후 토글 가능하도록 CSS 변수 활용)

**페이지별 디자인 포인트:**

1. **HomePage (랜딩)**: 히어로 영역(그라디언트 + 프로젝트명 + 태그라인), 문서 카드 2x2 그리드, AI 도구 카드 2x1, 푸터
2. **LoginPage**: 화면 정중앙 카드, 로고, 부드러운 인풋 애니메이션, 에러 shake
3. **DashboardPage**: 상단 요약 카드(숫자 강조), 최근 활동 리스트
4. **DocViewerPage**: 좌측 문서 네비게이션, 우측 마크다운 본문, 코드블록 스타일링
5. **SkillsPage**: 검색/필터, 아코디언 확장, 마크다운 렌더링, "실행 가능" 뱃지
6. **PluginsPage**: 상태별 카드 색상(활성=초록, 미설정=주황), 인라인 env 편집, 추가 모달

→ `/frontend-design` 스킬이 각 페이지를 분석하고 **코드를 직접 수정**하여 디자인을 완성합니다.
→ 필요 시 공통 CSS 파일(`src/styles/global.css`)이나 CSS 변수 파일을 추가합니다.

## 8단계: Orbitron 배포 설정

### Orbitron.yaml (프로젝트 루트)

```yaml
# Orbitron 배포 설정
services:
  - name: backend
    type: web
    source: backend
    build:
      command: pip install -r requirements.txt
    run:
      command: uvicorn main:app --host 0.0.0.0 --port 8000
    env:
      - key: DATABASE_URL
        sync: false
      - key: SECRET_KEY
        sync: false
      - key: FRONTEND_URL
        sync: false

  - name: frontend
    type: static
    source: frontend
    build:
      command: npm install && npm run build
      output: dist
    env:
      - key: VITE_API_URL
        sync: false
```

### Dockerfile (프로젝트 루트) — 필수

**반드시 생성해야 합니다.** Orbitron 자동 생성 Dockerfile은 깨지므로 절대 의존하면 안 됩니다.

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=""
RUN npm run build

# Stage 2: Production image
FROM python:3.12-slim
WORKDIR /app

# Install backend dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy frontend build output
COPY --from=frontend-build /app/frontend/dist /app/static

# Expose port
EXPOSE 8000

# Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### backend/main.py — 정적 파일 서빙 코드 추가

`main.py`의 맨 아래에 아래 코드를 추가하여 Docker 환경에서 빌드된 React SPA를 서빙합니다:

```python
# Serve frontend static files in production (Docker build copies to /app/static)
_static_dir = Path(__file__).resolve().parent / "static"
if _static_dir.exists():
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = _static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_static_dir / "index.html")

    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="static-assets")
```

그리고 `main.py` 상단 import에 추가:
```python
from pathlib import Path
from fastapi.staticfiles import StaticFiles
```

## 9단계: CLAUDE.md 생성

```markdown
# TwinverseAI

## 프로젝트 구조
- `backend/` — FastAPI 백엔드 (Python, PostgreSQL on Orbitron)
- `frontend/` — 웹 앱 (React + Vite, port 5173)
- `docs/` — 프로젝트 문서 (마크다운, /end 스킬로 자동 업데이트)

## 랜딩페이지 메뉴
- 프로젝트 문서 (4개): 개발계획서, 버그수정 로그, 업그레이드 로그, 작업일지
- AI 스킬 뷰어: /skills — .claude/skills/ 디렉토리의 모든 스킬을 상세 설명과 함께 조회
- 플러그인 관리: /plugins — 설치된 MCP 플러그인 조회, 환경변수 수정, 새 플러그인 추가/삭제

## 로컬 개발
- Backend: `cd backend && uvicorn main:app --reload` (port 8000)
- Frontend: `cd frontend && npm run dev` (port 5173)

## 인증
- JWT 기반 (Bearer Token)
- 역할: user / admin / superadmin
- 어드민 대시보드: `/admin` (admin 이상 접근)

## 배포
- Orbitron 배포 서버 사용 (Linux)
- DB: Orbitron PostgreSQL 서버
- Windows에서는 커밋/푸시만 수행, 배포는 Orbitron에서 진행
- **반드시 프로젝트 루트에 Dockerfile 포함** (Orbitron 자동 생성 Dockerfile은 깨지므로 절대 의존 금지)
- Dockerfile은 멀티스테이지 빌드: Node(프론트엔드 빌드) → Python(백엔드 + 정적파일 서빙)

## 커밋 메시지 규칙
- `feat:` 새 기능 / `fix:` 버그 수정 / `style:` UI / `refactor:` 리팩토링 / `docs:` 문서 / `infra:` 인프라
```

## 10단계: SuperAdmin 시드 스크립트

backend에 `seed_admin.py` 파일을 생성합니다:

```python
"""SuperAdmin 계정 시드 — 최초 1회 실행"""
import os
from dotenv import load_dotenv
load_dotenv()

from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import User
from services.auth_service import hash_password

create_db_and_tables()

username = os.getenv("SUPERADMIN_USERNAME", "admin")
password = os.getenv("SUPERADMIN_PASSWORD", "admin1234")

with Session(engine) as session:
    existing = session.exec(select(User).where(User.username == username)).first()
    if existing:
        print(f"SuperAdmin '{username}' already exists.")
    else:
        user = User(
            username=username,
            email=f"{username}@twinverse.org",
            hashed_password=hash_password(password),
            role="superadmin",
        )
        session.add(user)
        session.commit()
        print(f"SuperAdmin '{username}' created.")
```

실행: `cd backend && python seed_admin.py`

## 11단계: .agents 워크플로우 문서 업데이트

`project-reference.md`와 `deployment.md`의 TODO 항목들을 실제 생성된 구조와 Orbitron 설정으로 업데이트합니다.

## 12단계: 초기 커밋

```bash
cd c:\WORK\TwinverseAI && git add -A && git commit -m "feat: 프로젝트 초기 구조 생성 (FastAPI + React + 인증 + 어드민 + 문서 + 스킬뷰어 + 플러그인관리 + Orbitron)"
```

## 13단계: GitHub 리포지토리 생성 및 푸시

```bash
cd c:\WORK\TwinverseAI && gh repo create $(basename "$PWD") --public --source=. --description "TwinverseAI project" --push
```

### 주의사항

- `gh` CLI 설치 필요 (`winget install GitHub.cli`)
- `gh auth login`으로 인증 완료 상태여야 함
- 이미 같은 이름의 리포지토리가 존재하면 사용자에게 이름 변경 확인

## 14단계: 완료 보고

사용자에게 아래를 요약 보고합니다:

- 생성된 디렉토리/파일 전체 목록
- GitHub 리포지토리 URL
- **다음 필수 작업 안내**:
  1. `backend/.env` 파일 작성 (DB URL, SECRET_KEY)
  2. `cd backend && pip install -r requirements.txt`
  3. `cd backend && python seed_admin.py` (SuperAdmin 생성)
  4. 로컬 테스트: backend `uvicorn main:app --reload` + frontend `npm run dev`
  5. Orbitron에 환경변수 등록 후 배포
  6. `docs/dev-plan.md` 개발계획서 작성
