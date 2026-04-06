---
name: init
description: 프로젝트 초기 세팅 - Git, 디렉토리 구조, 인증(JWT 버그픽스 포함), 커뮤니티 게시판(4종), 어드민 대시보드, 프로젝트 문서, 스킬/플러그인 뷰어, 파일 업로드(UPLOAD_DIR 방어+Vite 프록시+Docker VOLUME 안전), Architectural Futurism 디자인 시스템, Orbitron 배포 자동 생성 (FastAPI + React + Vite + PostgreSQL)
user-invocable: true
---

# 프로젝트 초기 세팅

> **`{{PROJECT_NAME}}`** = 사용자가 지정한 프로젝트 이름. 아래 모든 코드에서 `TwinverseAI`를 `{{PROJECT_NAME}}`으로 치환하여 생성합니다.
> 사용자에게 프로젝트 이름을 반드시 먼저 확인하세요.

프로젝트를 처음 시작할 때 이 스킬을 실행하면 모든 기본 구조를 자동으로 생성합니다.

**포함 기능:**
- 메인 웹사이트 (홈/회사소개/서비스)
- JWT 로그인/회원가입 (버그픽스 적용: sub 문자열 변환, 401 인터셉터)
- 커뮤니티 게시판 4종 (공지/Q&A/갤러리/동영상)
- 댓글 시스템 + 파일 업로드
- 어드민 대시보드 (통계/사용자관리/게시판관리/문서/스킬/플러그인)
- 프로젝트 문서 시스템
- Architectural Futurism 디자인 시스템
- Orbitron 배포 + PostgreSQL DB + Docker

**⚠️ 중요 버그픽스 포함:**
1. `python-jose`는 JWT `sub` 클레임을 **반드시 문자열**로 요구함 → `str(to_encode["sub"])` 필수
2. `deps.py`에서 `int(payload.get("sub"))` 변환 필수 (DB User.id는 int)
3. axios 401 인터셉터에서 `/api/auth/` 경로 제외 필수 (로그인 리다이렉트 루프 방지)
4. LoginPage에서 이미 로그인된 상태면 홈으로 리다이렉트 필수
5. `UPLOAD_DIR` 빈 문자열 → `Path("")`가 CWD(.)로 해석 → **반드시 `.strip()` 후 빈 문자열 체크**
6. `/uploads` 서빙에 `StaticFiles` mount 사용 금지 → Docker VOLUME과 충돌 → **명시적 API 라우트** 사용
7. 갤러리 기본 이미지는 `backend/gallery_defaults/`에 포함 → Docker COPY/VOLUME에 의존 금지
8. Vite 개발 서버에 `/api`, `/uploads` 프록시 필수 → 없으면 `<img src="/uploads/...">` 가 HTML 반환
9. `api.js` baseURL은 `""` (same-origin) → Vite 프록시 + Docker same-origin으로 통일

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

# Uploads (사용자 업로드는 무시, 샘플 갤러리 이미지는 추적)
uploads/*
!uploads/gallery-*.jpg

# Logs
*.log
```

## 3단계: 프로젝트 디렉토리 구조 생성

```
c:\WORK\TwinverseAI\
├── backend/
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── admin.py
│   │   ├── boards.py
│   │   ├── comments.py
│   │   ├── files.py
│   │   ├── docs.py
│   │   ├── skills.py
│   │   └── plugins.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── post.py
│   │   ├── comment.py
│   │   ├── file.py
│   │   └── document.py
│   ├── services/
│   │   ├── __init__.py
│   │   └── auth_service.py
│   ├── gallery_defaults/
│   │   └── gallery-*.jpg (샘플 갤러리 이미지 — 시작 시 uploads/에 복사)
│   ├── main.py
│   ├── database.py
│   ├── deps.py
│   ├── seed_admin.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/ (TopBar, Sidebar, Footer, MainLayout + CSS modules)
│   │   │   ├── board/ (PostList, PostDetail, PostForm, CommentSection, FileUpload + CSS modules)
│   │   │   └── ProtectedRoute.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx + .module.css
│   │   │   ├── LoginPage.jsx + .module.css
│   │   │   ├── AboutPage.jsx + .module.css
│   │   │   ├── ServicesPage.jsx + .module.css
│   │   │   ├── community/ (BoardPage, PostPage + CSS modules)
│   │   │   └── admin/ (6 pages + CSS modules)
│   │   ├── services/api.js
│   │   ├── styles/global.css
│   │   ├── index.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── dev-plan.md
│   ├── bugfix-log.md
│   ├── upgrade-log.md
│   └── work-log.md
├── Dockerfile
├── .dockerignore
├── Orbitron.yaml
├── .gitignore
└── CLAUDE.md
```

### 디렉토리 생성 명령:

```bash
cd c:\WORK\TwinverseAI && mkdir -p backend/routers backend/models backend/services frontend/src/components/layout frontend/src/components/board frontend/src/pages/community frontend/src/pages/admin frontend/src/services frontend/src/styles docs
```

---

## 4단계: Backend 파일 생성

### backend/requirements.txt

```
fastapi
uvicorn[standard]
sqlmodel
psycopg2-binary
python-dotenv
passlib[bcrypt]
bcrypt==4.0.1
python-jose[cryptography]
python-multipart
```

### backend/.env.example

⚠️ **중요: .env 형식 규칙** — dotenv 파싱 오류 방지
- 각 줄은 반드시 `KEY=value` 형식 (공백, 접두어 금지)
- `Internal DATABASE_URL=...` ← ❌ 파싱 실패 (키가 "Internal"이 됨)
- `DATABASE_URL=...` ← ✅ 올바른 형식
- 주석은 `#`으로 시작, 메모/비밀번호 등 비환경변수 내용 금지

```env
# ============================================================
# {{PROJECT_NAME}} Backend — 환경변수
# ============================================================
# 이 파일은 로컬 개발용입니다. .gitignore에 포함됩니다.
# Docker 배포 시에는 Dockerfile ENV 또는 Orbitron 대시보드에서 설정합니다.
#
# ⚠️ 형식 규칙:
#   KEY=value (앞에 접두어/설명 붙이지 말 것)
#   주석은 # 사용, 비환경변수 메모 금지

# ── 데이터베이스 ──
# Docker 내부 (배포용): postgresql://user:pass@container-name:port/db
# 외부 접속 (로컬 개발용): postgresql://user:pass@server-ip:port/db
DATABASE_URL=postgresql://user:password@localhost:5432/{{PROJECT_NAME_LOWER}}

# ── JWT 인증 ──
SECRET_KEY=change-me-in-production-min-32-chars

# ── CORS ──
FRONTEND_URL=http://localhost:5173

# ── 관리자 계정 (앱 시작 시 자동 생성) ──
SUPERADMIN_USERNAME=admin
SUPERADMIN_PASSWORD=admin1234
```

### backend/.env

로컬 개발용 실제 .env를 생성합니다 (.gitignore에 포함됨):

```env
# {{PROJECT_NAME}} — 로컬 개발용
DATABASE_URL=postgresql://user:password@localhost:5432/{{PROJECT_NAME_LOWER}}
SECRET_KEY={{PROJECT_NAME_LOWER}}-jwt-secret-key-2026
FRONTEND_URL=http://localhost:5173
SUPERADMIN_USERNAME=admin
SUPERADMIN_PASSWORD=admin1234
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

### backend/models/post.py

```python
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Post(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    board_type: str = Field(index=True)  # "notice" | "qna" | "gallery" | "video"
    title: str
    content: str = ""  # markdown
    author_id: int = Field(foreign_key="user.id")
    is_pinned: bool = Field(default=False)
    view_count: int = Field(default=0)
    video_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
```

### backend/models/comment.py

```python
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Comment(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="post.id", index=True)
    author_id: int = Field(foreign_key="user.id")
    content: str
    created_at: datetime = Field(default_factory=datetime.now)
```

### backend/models/file.py

```python
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class FileRecord(SQLModel, table=True):
    __tablename__ = "file"

    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="post.id", index=True)
    original_name: str
    stored_path: str
    file_type: str  # "image" | "video" | "other"
    file_size: int
    uploaded_at: datetime = Field(default_factory=datetime.now)
```

### backend/models/document.py

```python
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(unique=True, index=True)  # "dev-plan", "bugfix-log", etc.
    title: str = Field(default="")
    content: str = Field(default="")
    updated_at: datetime = Field(default_factory=datetime.now)
```

### backend/models/__init__.py

```python
from .user import User
from .post import Post
from .comment import Comment
from .file import FileRecord
from .document import Document
```

### backend/services/__init__.py

빈 파일로 생성합니다.

### backend/services/auth_service.py

⚠️ **중요**: `create_access_token`에서 `sub`를 **반드시 문자열로 변환**해야 합니다.
`python-jose`가 JWT `sub` 클레임을 문자열로 검증하기 때문에, int를 넣으면
`encode`는 성공하지만 `decode`할 때 `JWTClaimsError: Subject must be a string.`이 발생합니다.

```python
import os
from datetime import datetime, timedelta
import bcrypt
from jose import jwt, JWTError

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24시간


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    # python-jose requires "sub" to be a string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
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

⚠️ **중요**: `payload.get("sub")`는 문자열이므로 `int()` 변환이 필요합니다.
`get_optional_user`도 동일하게 처리해야 합니다.

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
    user_id = int(payload.get("sub"))
    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    session: Session = Depends(get_session),
) -> User | None:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    user_id = int(payload.get("sub"))
    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user or not user.is_active:
        return None
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
```

### backend/seed_admin.py

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

### backend/main.py

⚠️ **핵심 버그픽스 포함**:
1. `UPLOAD_DIR` 빈 문자열 방어 — `Path("")`는 CWD로 해석되어 소스 디렉토리를 uploads로 착각
2. `/uploads` 서빙에 `StaticFiles` mount 사용 금지 — Docker VOLUME과 충돌. 명시적 API 라우트 사용
3. 갤러리 기본 이미지는 `backend/gallery_defaults/`에 포함 — Docker COPY나 VOLUME에 의존하지 않음
4. `/health` 엔드포인트에 디버그 정보 포함 — 배포 문제 즉시 진단 가능

```python
import os
import shutil
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import database
from database import create_db_and_tables
from routers import auth, admin, docs, skills, plugins, boards, comments, files


def _get_uploads_dir() -> Path:
    """업로드 디렉토리 결정: UPLOAD_DIR (Docker) > 프로젝트루트/uploads (로컬)
    ⚠️ 빈 문자열 방어: Path("")는 CWD(.)로 해석되므로 반드시 strip 후 체크"""
    env_val = os.getenv("UPLOAD_DIR", "").strip()
    if env_val:
        d = Path(env_val)
    else:
        d = Path(__file__).resolve().parent.parent / "uploads"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _copy_gallery_defaults():
    """갤러리 기본 이미지를 uploads 디렉토리에 복사 (없는 파일만)
    ⚠️ backend/gallery_defaults/에서 복사 — Docker VOLUME/COPY에 의존하지 않음"""
    defaults_dir = Path(__file__).resolve().parent / "gallery_defaults"
    if not defaults_dir.is_dir():
        print(f"[gallery-defaults] Not found: {defaults_dir}")
        return
    uploads = _get_uploads_dir()
    copied = 0
    for src in defaults_dir.glob("gallery-*.jpg"):
        dst = uploads / src.name
        if not dst.exists():
            shutil.copy2(src, dst)
            copied += 1
    print(f"[gallery-defaults] Copied {copied} files to {uploads}")


def _seed_admin():
    """Ensure default admin account exists on startup."""
    from sqlmodel import Session, select
    from models import User
    import bcrypt
    username = os.getenv("SUPERADMIN_USERNAME", "admin")
    password = os.getenv("SUPERADMIN_PASSWORD", "admin1234")
    with Session(database.engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if not existing:
            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            user = User(
                username=username,
                email=f"{username}@twinverse.org",
                hashed_password=hashed,
                role="superadmin",
            )
            session.add(user)
            session.commit()
            print(f"[seed] SuperAdmin '{username}' created.")

def _seed_docs():
    """docs/ 마크다운 파일을 DB에 동기화 (upsert)"""
    from sqlmodel import Session, select
    from models.document import Document

    DOC_FILES = {
        "dev-plan": ("개발계획", "dev-plan.md"),
        "bugfix-log": ("버그수정 로그", "bugfix-log.md"),
        "upgrade-log": ("업그레이드 로그", "upgrade-log.md"),
        "work-log": ("작업일지", "work-log.md"),
    }

    docs_dir = Path("/app/docs")
    if not docs_dir.exists():
        docs_dir = Path(__file__).resolve().parent.parent / "docs"
    if not docs_dir.exists():
        print("[seed_docs] docs/ directory not found, skipping.")
        return

    try:
        with Session(database.engine) as session:
            synced = 0
            for key, (title, filename) in DOC_FILES.items():
                filepath = docs_dir / filename
                if not filepath.exists():
                    print(f"[seed_docs] File not found: {filepath}")
                    continue
                content = filepath.read_text(encoding="utf-8")
                existing = session.exec(select(Document).where(Document.key == key)).first()
                if existing:
                    existing.content = content
                    existing.title = title
                    session.add(existing)
                else:
                    session.add(Document(key=key, title=title, content=content))
                synced += 1
            session.commit()
            print(f"[seed_docs] Synced {synced}/{len(DOC_FILES)} docs from {docs_dir}")
    except Exception as e:
        print(f"[seed_docs] ERROR: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _copy_gallery_defaults()
    create_db_and_tables()
    _seed_admin()
    _seed_docs()
    yield

app = FastAPI(title="{{PROJECT_NAME}} API", lifespan=lifespan)

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
app.include_router(boards.router, prefix="/api/boards", tags=["boards"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(files.router, prefix="/api/files", tags=["files"])

@app.get("/health")
def health_check():
    """헬스체크 + 배포 진단 정보"""
    try:
        from sqlmodel import Session, select, func
        from models.document import Document
        from models import Post, FileRecord
        with Session(database.engine) as session:
            doc_count = session.exec(select(func.count(Document.id))).one()
            post_count = session.exec(select(func.count(Post.id))).one()
            file_count = session.exec(select(func.count(FileRecord.id))).one()
        uploads = _get_uploads_dir()
        upload_files = [f.name for f in uploads.iterdir()] if uploads.is_dir() else []
        return {
            "status": "ok",
            "db": "connected",
            "documents": doc_count,
            "posts": post_count,
            "files": file_count,
            "uploads_dir": str(uploads),
            "uploads_files": upload_files,
        }
    except Exception as e:
        return {"status": "error", "db": str(e)}


# Serve uploaded files — 명시적 API 라우트 (StaticFiles mount 대신)
# ⚠️ StaticFiles mount는 Docker VOLUME과 충돌할 수 있으므로 사용 금지
@app.get("/uploads/{filename:path}")
def serve_upload(filename: str):
    filepath = _get_uploads_dir() / filename
    if filepath.is_file():
        return FileResponse(filepath)
    raise HTTPException(status_code=404, detail=f"File not found: {filename}")


# Serve frontend static files in production (Docker build copies to /app/static)
_static_dir = Path(__file__).resolve().parent / "static"
if _static_dir.exists():
    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = _static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(_static_dir / "index.html")

    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="static-assets")
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
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func, col
from database import get_session
from models import User, Post, Comment
from deps import require_admin

router = APIRouter()


@router.get("/stats")
def admin_stats(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    total_users = session.exec(select(func.count(User.id))).one()
    active_users = session.exec(
        select(func.count(User.id)).where(User.is_active == True)
    ).one()
    total_posts = session.exec(select(func.count(Post.id))).one()
    total_comments = session.exec(select(func.count(Comment.id))).one()
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_posts": total_posts,
        "total_comments": total_comments,
        "admin": admin.username,
    }


@router.get("/dashboard")
def admin_dashboard(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    return admin_stats(admin, session)


@router.get("/users")
def list_users(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    users = session.exec(select(User).order_by(col(User.id))).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


class RoleUpdate(BaseModel):
    role: str


@router.put("/users/{user_id}/role")
def update_user_role(
    user_id: int,
    body: RoleUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    if body.role not in ("user", "admin", "superadmin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role == "superadmin" and admin.role != "superadmin":
        raise HTTPException(status_code=403, detail="Only superadmin can assign superadmin role")
    user.role = body.role
    session.add(user)
    session.commit()
    return {"id": user.id, "role": user.role}


class ActiveUpdate(BaseModel):
    is_active: bool


@router.put("/users/{user_id}/active")
def update_user_active(
    user_id: int,
    body: ActiveUpdate,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = body.is_active
    session.add(user)
    session.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.get("/posts")
def list_all_posts(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    offset = (page - 1) * size
    total = session.exec(select(func.count(Post.id))).one()
    posts = session.exec(
        select(Post, User.username)
        .join(User, col(Post.author_id) == col(User.id))
        .order_by(col(Post.created_at).desc())
        .offset(offset)
        .limit(size)
    ).all()
    return {
        "items": [
            {
                "id": p.id,
                "board_type": p.board_type,
                "title": p.title,
                "author": username,
                "view_count": p.view_count,
                "created_at": p.created_at.isoformat(),
            }
            for p, username in posts
        ],
        "total": total,
        "page": page,
        "size": size,
    }
```

### backend/routers/boards.py

```python
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select, func, col
from database import get_session
from models import Post, User
from deps import get_current_user, require_admin

router = APIRouter()

VALID_BOARDS = ("notice", "qna", "gallery", "video")


class PostCreate(BaseModel):
    title: str
    content: str = ""
    video_url: str | None = None
    is_pinned: bool = False


class PostUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    video_url: str | None = None
    is_pinned: bool | None = None


def _validate_board(board_type: str):
    if board_type not in VALID_BOARDS:
        raise HTTPException(status_code=404, detail=f"Invalid board: {board_type}")


@router.get("/{board_type}")
def list_posts(
    board_type: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    _validate_board(board_type)
    offset = (page - 1) * size

    total = session.exec(
        select(func.count(Post.id)).where(Post.board_type == board_type)
    ).one()

    posts = session.exec(
        select(Post, User.username)
        .join(User, col(Post.author_id) == col(User.id))
        .where(Post.board_type == board_type)
        .order_by(col(Post.is_pinned).desc(), col(Post.created_at).desc())
        .offset(offset)
        .limit(size)
    ).all()

    return {
        "items": [
            {
                "id": p.id,
                "title": p.title,
                "author": username,
                "author_id": p.author_id,
                "is_pinned": p.is_pinned,
                "view_count": p.view_count,
                "video_url": p.video_url,
                "created_at": p.created_at.isoformat(),
            }
            for p, username in posts
        ],
        "total": total,
        "page": page,
        "size": size,
    }


@router.get("/{board_type}/{post_id}")
def get_post(
    board_type: str,
    post_id: int,
    session: Session = Depends(get_session),
):
    _validate_board(board_type)
    post = session.exec(
        select(Post).where(Post.id == post_id, Post.board_type == board_type)
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    post.view_count += 1
    session.add(post)
    session.commit()
    session.refresh(post)

    author = session.get(User, post.author_id)

    from models import FileRecord
    files = session.exec(
        select(FileRecord).where(FileRecord.post_id == post.id)
    ).all()

    return {
        "id": post.id,
        "board_type": post.board_type,
        "title": post.title,
        "content": post.content,
        "author": author.username if author else "unknown",
        "author_id": post.author_id,
        "is_pinned": post.is_pinned,
        "view_count": post.view_count,
        "video_url": post.video_url,
        "created_at": post.created_at.isoformat(),
        "updated_at": post.updated_at.isoformat(),
        "files": [
            {
                "id": f.id,
                "original_name": f.original_name,
                "stored_path": f.stored_path,
                "file_type": f.file_type,
                "file_size": f.file_size,
            }
            for f in files
        ],
    }


@router.post("/{board_type}", status_code=201)
def create_post(
    board_type: str,
    body: PostCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _validate_board(board_type)

    if board_type == "notice" and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required for notice board")

    post = Post(
        board_type=board_type,
        title=body.title,
        content=body.content,
        author_id=user.id,
        video_url=body.video_url,
        is_pinned=body.is_pinned if user.role in ("admin", "superadmin") else False,
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return {"id": post.id, "title": post.title}


@router.put("/{board_type}/{post_id}")
def update_post(
    board_type: str,
    post_id: int,
    body: PostUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _validate_board(board_type)
    post = session.exec(
        select(Post).where(Post.id == post_id, Post.board_type == board_type)
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.author_id != user.id and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    if body.title is not None:
        post.title = body.title
    if body.content is not None:
        post.content = body.content
    if body.video_url is not None:
        post.video_url = body.video_url
    if body.is_pinned is not None and user.role in ("admin", "superadmin"):
        post.is_pinned = body.is_pinned
    post.updated_at = datetime.now()

    session.add(post)
    session.commit()
    session.refresh(post)
    return {"id": post.id, "title": post.title}


@router.delete("/{board_type}/{post_id}")
def delete_post(
    board_type: str,
    post_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _validate_board(board_type)
    post = session.exec(
        select(Post).where(Post.id == post_id, Post.board_type == board_type)
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.author_id != user.id and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    from models import Comment, FileRecord
    comments = session.exec(select(Comment).where(Comment.post_id == post.id)).all()
    for c in comments:
        session.delete(c)
    files = session.exec(select(FileRecord).where(FileRecord.post_id == post.id)).all()
    for f in files:
        session.delete(f)

    session.delete(post)
    session.commit()
    return {"status": "deleted"}
```

### backend/routers/comments.py

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select, col
from database import get_session
from models import Comment, User
from deps import get_current_user

router = APIRouter()


class CommentCreate(BaseModel):
    content: str


@router.get("/{post_id}")
def list_comments(post_id: int, session: Session = Depends(get_session)):
    results = session.exec(
        select(Comment, User.username)
        .join(User, col(Comment.author_id) == col(User.id))
        .where(Comment.post_id == post_id)
        .order_by(col(Comment.created_at).asc())
    ).all()

    return [
        {
            "id": c.id,
            "content": c.content,
            "author": username,
            "author_id": c.author_id,
            "created_at": c.created_at.isoformat(),
        }
        for c, username in results
    ]


@router.post("/{post_id}", status_code=201)
def create_comment(
    post_id: int,
    body: CommentCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    from models import Post

    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = Comment(
        post_id=post_id,
        author_id=user.id,
        content=body.content,
    )
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return {"id": comment.id, "content": comment.content}


@router.delete("/{comment_id}")
def delete_comment(
    comment_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    comment = session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != user.id and user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    session.delete(comment)
    session.commit()
    return {"status": "deleted"}
```

### backend/routers/files.py

```python
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session
from database import get_session
from models import FileRecord, User
from deps import get_current_user

router = APIRouter()

# ⚠️ 빈 문자열 방어: Path("")는 CWD(.)로 해석됨
_env_upload = os.getenv("UPLOAD_DIR", "").strip()
UPLOAD_DIR = Path(_env_upload) if _env_upload else Path(__file__).resolve().parent.parent / "uploads"
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi"}


def _get_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return "image"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    return "other"


@router.post("/upload")
async def upload_file(
    post_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    file_type = _get_file_type(file.filename or "unknown")
    max_size = MAX_VIDEO_SIZE if file_type == "video" else MAX_IMAGE_SIZE

    content = await file.read()
    if len(content) > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File too large. Max {limit_mb}MB")

    ext = Path(file.filename or "file").suffix
    stored_name = f"{uuid.uuid4()}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_path = UPLOAD_DIR / stored_name

    with open(stored_path, "wb") as f:
        f.write(content)

    record = FileRecord(
        post_id=post_id,
        original_name=file.filename or "unknown",
        stored_path=f"/uploads/{stored_name}",
        file_type=file_type,
        file_size=len(content),
    )
    session.add(record)
    session.commit()
    session.refresh(record)

    return {
        "id": record.id,
        "original_name": record.original_name,
        "stored_path": record.stored_path,
        "file_type": record.file_type,
        "file_size": record.file_size,
    }
```

### backend/routers/docs.py

```python
"""프로젝트 문서 API — PostgreSQL 기반"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models.document import Document

router = APIRouter()

DOC_TITLES = {
    "dev-plan": "개발계획",
    "bugfix-log": "버그수정 로그",
    "upgrade-log": "업그레이드 로그",
    "work-log": "작업일지",
}


@router.get("/list")
def list_docs(session: Session = Depends(get_session)):
    docs = session.exec(select(Document)).all()
    return [
        {"key": d.key, "title": d.title, "exists": True, "updated_at": d.updated_at.isoformat()}
        for d in docs
    ]


@router.get("/{doc_key}")
def get_doc(doc_key: str, session: Session = Depends(get_session)):
    doc = session.exec(select(Document).where(Document.key == doc_key)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"key": doc.key, "title": doc.title, "content": doc.content}
```

### backend/routers/skills.py

```python
"""스킬 목록 및 상세 정보 API -- .claude/skills/ 디렉토리를 스캔"""
import re
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

SKILLS_DIR = Path(__file__).resolve().parent.parent.parent / ".claude" / "skills"


def _parse_skill(skill_dir: Path) -> dict | None:
    skill_file = skill_dir / "SKILL.md"
    if not skill_file.exists():
        return None
    text = skill_file.read_text(encoding="utf-8")

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
"""플러그인(MCP 서버) 관리 API -- .claude/settings.local.json의 mcpServers를 읽고 쓴다"""
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

SETTINGS_FILE = Path(__file__).resolve().parent.parent.parent / ".claude" / "settings.local.json"

MCP_INFO = {
    "context7": {"display_name": "Context7", "description": "React, FastAPI, SQLModel 등 라이브러리의 최신 공식 문서를 실시간 조회합니다.", "usage": "코드 작성 시 자동으로 최신 API 문서를 참조합니다.", "requires_key": False},
    "github": {"display_name": "GitHub", "description": "GitHub Issue 생성/조회, PR 관리를 AI가 직접 수행합니다.", "usage": "'이슈 만들어줘', 'PR 리뷰해줘' 등으로 사용합니다.", "requires_key": True, "key_name": "GITHUB_PERSONAL_ACCESS_TOKEN"},
    "postgres": {"display_name": "PostgreSQL", "description": "프로젝트 DB에 직접 쿼리하여 스키마 조회, 데이터 확인을 수행합니다.", "usage": "'DB에서 사용자 테이블 확인해줘' 등으로 사용합니다.", "requires_key": True, "key_name": "DATABASE_URL"},
    "puppeteer": {"display_name": "Puppeteer", "description": "헤드리스 브라우저로 페이지 스크린샷, UI 테스트를 수행합니다.", "usage": "'로그인 페이지 스크린샷 찍어줘' 등으로 사용합니다.", "requires_key": False},
    "sequential-thinking": {"display_name": "Sequential Thinking", "description": "복잡한 문제를 단계별로 분해하여 체계적으로 추론합니다.", "usage": "복잡한 아키텍처 설계나 디버깅 시 자동 활용합니다.", "requires_key": False},
    "memory": {"display_name": "Memory", "description": "지식 그래프 기반으로 대화 간 장기 기억을 관리합니다.", "usage": "'이거 기억해줘' 등으로 사용합니다.", "requires_key": False},
    "brave-search": {"display_name": "Brave Search", "description": "웹 검색을 통해 최신 정보를 실시간 조회합니다.", "usage": "'이 에러 검색해줘' 등으로 사용합니다.", "requires_key": True, "key_name": "BRAVE_API_KEY"},
    "filesystem": {"display_name": "Filesystem", "description": "확장된 파일 시스템 작업 — 파일 검색, 이동, 복사 등을 수행합니다.", "usage": "파일 관련 복잡한 작업 시 자동 활용합니다.", "requires_key": False},
    "fetch": {"display_name": "Fetch", "description": "외부 HTTP API를 호출하거나 웹페이지 내용을 가져옵니다.", "usage": "'이 API 호출해줘' 등으로 사용합니다.", "requires_key": False},
    "docker": {"display_name": "Docker", "description": "Docker 컨테이너 관리 — 이미지 빌드, 컨테이너 실행 등을 수행합니다.", "usage": "'도커 컨테이너 목록 보여줘' 등으로 사용합니다.", "requires_key": False},
}


def _read_settings() -> dict:
    if not SETTINGS_FILE.exists():
        return {}
    return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))


def _write_settings(data: dict):
    SETTINGS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


@router.get("/list")
def list_plugins():
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
    settings = _read_settings()
    servers = settings.get("mcpServers", {})
    if plugin_key not in servers:
        raise HTTPException(status_code=404, detail="Plugin not found")
    config = servers[plugin_key]
    info = MCP_INFO.get(plugin_key, {})
    return {
        "key": plugin_key, "display_name": info.get("display_name", plugin_key),
        "description": info.get("description", ""), "usage": info.get("usage", ""),
        "requires_key": info.get("requires_key", False), "key_name": info.get("key_name", ""),
        "command": config.get("command", ""), "args": config.get("args", []),
        "env": config.get("env", {}),
        "is_configured": all(bool(v) for v in config.get("env", {}).values()) if config.get("env") else True,
    }


class PluginUpdateRequest(BaseModel):
    env: dict[str, str] | None = None


@router.put("/{plugin_key}")
def update_plugin(plugin_key: str, body: PluginUpdateRequest):
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
    return {"status": "added", "key": body.key}


@router.delete("/{plugin_key}")
def remove_plugin(plugin_key: str):
    settings = _read_settings()
    servers = settings.get("mcpServers", {})
    if plugin_key not in servers:
        raise HTTPException(status_code=404, detail="Plugin not found")
    del servers[plugin_key]
    settings["mcpServers"] = servers
    _write_settings(settings)
    return {"status": "removed", "key": plugin_key}
```

---

## 5단계: Frontend 프로젝트 초기화

### frontend/package.json

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.14.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-markdown": "^10.1.0",
    "react-router-dom": "^7.14.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "vite": "^8.0.1"
  }
}
```

### frontend/vite.config.js

⚠️ **필수**: Vite 개발 서버에서 `/api`, `/uploads`, `/health` 요청을 백엔드(8000)로 프록시해야 합니다.
프록시 없이 `<img src="/uploads/...">` 는 Vite가 SPA HTML을 반환하여 이미지가 깨집니다.

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
```

### frontend/index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TwinverseAI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### npm install

```bash
cd frontend && npm install
```

---

## 6단계: Frontend 소스 파일 생성

### frontend/src/main.jsx

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

### frontend/src/App.jsx

```jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutPage";
import ServicesPage from "./pages/ServicesPage";
import LoginPage from "./pages/LoginPage";
import BoardPage from "./pages/community/BoardPage";
import PostPage from "./pages/community/PostPage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBoards from "./pages/admin/AdminBoards";
import AdminDocs from "./pages/admin/AdminDocs";
import AdminSkills from "./pages/admin/AdminSkills";
import AdminPlugins from "./pages/admin/AdminPlugins";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Community */}
          <Route path="/community/:boardType" element={<BoardPage />} />
          <Route path="/community/:boardType/:postId" element={<PostPage />} />
          <Route path="/community/:boardType/:postId/edit" element={<PostPage />} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
          <Route path="/admin/boards" element={<ProtectedRoute requiredRole="admin"><AdminBoards /></ProtectedRoute>} />
          <Route path="/admin/docs" element={<ProtectedRoute requiredRole="admin"><AdminDocs /></ProtectedRoute>} />
          <Route path="/admin/docs/:docKey" element={<ProtectedRoute requiredRole="admin"><AdminDocs /></ProtectedRoute>} />
          <Route path="/admin/skills" element={<ProtectedRoute requiredRole="admin"><AdminSkills /></ProtectedRoute>} />
          <Route path="/admin/plugins" element={<ProtectedRoute requiredRole="admin"><AdminPlugins /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### frontend/src/services/api.js

⚠️ **중요**: 401 인터셉터에서 `/api/auth/` URL 제외 필수 (로그인 리다이렉트 루프 방지)

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url?.includes("/api/auth/")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
```

### frontend/src/components/ProtectedRoute.jsx

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

---

## 7단계: Layout 컴포넌트

### frontend/src/components/layout/TopBar.jsx

```jsx
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import styles from "./TopBar.module.css";

const NAV_ITEMS = [
  { label: "홈", path: "/" },
  { label: "회사소개", path: "/about" },
  { label: "서비스", path: "/services" },
  { label: "커뮤니티", path: "/community/notice" },
];

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>TwinverseAI</Link>
        <button className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)} aria-label="메뉴 열기">
          <span /><span /><span />
        </button>
        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.path} to={item.path} className={`${styles.navLink} ${isActive(item.path) ? styles.active : ""}`} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className={`${styles.navLink} ${isActive("/admin") ? styles.active : ""}`} onClick={() => setMenuOpen(false)}>
              관리자
            </Link>
          )}
        </nav>
        <div className={styles.auth}>
          {token ? (
            <div className={styles.userMenu}>
              <span className={styles.username}>{user?.username}</span>
              <button onClick={handleLogout} className={styles.logoutBtn}>로그아웃</button>
            </div>
          ) : (
            <Link to="/login" className={styles.loginBtn}>로그인</Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

### frontend/src/components/layout/Sidebar.jsx

```jsx
import { Link, useLocation } from "react-router-dom";
import styles from "./Sidebar.module.css";

const SIDEBAR_CONFIG = {
  community: {
    title: "커뮤니티",
    items: [
      { label: "공지사항", path: "/community/notice" },
      { label: "Q&A", path: "/community/qna" },
      { label: "이미지 갤러리", path: "/community/gallery" },
      { label: "동영상", path: "/community/videos" },
    ],
  },
  admin: {
    title: "관리자",
    items: [
      { label: "대시보드", path: "/admin" },
      { label: "사용자 관리", path: "/admin/users" },
      { label: "게시판 관리", path: "/admin/boards" },
      {
        label: "Claude Code",
        path: "/admin/skills",
        children: [
          { label: "AI 스킬", path: "/admin/skills" },
          { label: "플러그인", path: "/admin/plugins" },
        ],
      },
      {
        label: "프로젝트 문서",
        path: "/admin/docs",
        children: [
          { label: "개발계획", path: "/admin/docs/dev-plan" },
          { label: "버그수정 로그", path: "/admin/docs/bugfix-log" },
          { label: "업그레이드 로그", path: "/admin/docs/upgrade-log" },
          { label: "작업일지", path: "/admin/docs/work-log" },
        ],
      },
    ],
  },
};

export default function Sidebar({ section }) {
  const location = useLocation();
  const config = SIDEBAR_CONFIG[section];
  if (!config) return null;

  return (
    <aside className={styles.sidebar}>
      <h3 className={styles.title}>{config.title}</h3>
      <nav className={styles.nav}>
        {config.items.map((item) => (
          <div key={item.path}>
            <Link to={item.path} className={`${styles.link} ${location.pathname === item.path ? styles.active : ""}`}>
              {item.label}
            </Link>
            {item.children && (
              <div className={styles.subNav}>
                {item.children.map((child) => (
                  <Link key={child.path} to={child.path} className={`${styles.subLink} ${location.pathname === child.path ? styles.active : ""}`}>
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
```

### frontend/src/components/layout/Footer.jsx

```jsx
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.company}>TwinverseAI</span>
        <nav className={styles.links}>
          <a href="/about">회사정보</a>
          <span className={styles.sep}>|</span>
          <a href="#">이용약관</a>
          <span className={styles.sep}>|</span>
          <a href="#">개인정보처리방침</a>
        </nav>
        <span className={styles.copy}>&copy; 2026 TwinverseAI. All rights reserved.</span>
      </div>
    </footer>
  );
}
```

### frontend/src/components/layout/MainLayout.jsx

```jsx
import { Outlet, useLocation } from "react-router-dom";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import styles from "./MainLayout.module.css";

function getSidebarSection(pathname) {
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/admin")) return "admin";
  return null;
}

export default function MainLayout() {
  const location = useLocation();
  const sidebarSection = getSidebarSection(location.pathname);

  return (
    <div className={styles.layout}>
      <TopBar />
      <div className={styles.body}>
        {sidebarSection && <Sidebar section={sidebarSection} />}
        <main className={`${styles.content} ${!sidebarSection ? styles.full : ""}`}>
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
```

---

## 8단계: Board 컴포넌트

Board 컴포넌트 5개 (PostList, PostDetail, PostForm, CommentSection, FileUpload) 는 이전 세션에서 생성한 코드를 그대로 사용합니다.
**각 컴포넌트의 JSX 코드와 CSS Module 파일을 함께 생성해야 합니다.**
코드는 이 스킬의 상단 컨텍스트 요약에 포함되어 있으며, 현재 코드베이스에서 직접 복사하면 됩니다.

> 파일 목록:
> - `components/board/PostList.jsx` + `PostList.module.css`
> - `components/board/PostDetail.jsx` + `PostDetail.module.css`
> - `components/board/PostForm.jsx` + `PostForm.module.css`
> - `components/board/CommentSection.jsx` + `CommentSection.module.css`
> - `components/board/FileUpload.jsx` + `FileUpload.module.css`

---

## 9단계: 페이지 컴포넌트

### frontend/src/pages/HomePage.jsx

```jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import styles from "./HomePage.module.css";

export default function HomePage() {
  const [notices, setNotices] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);

  useEffect(() => {
    api.get("/api/boards/notice?size=3").then((r) => setNotices(r.data.items)).catch(() => {});
    api.get("/api/boards/qna?size=5").then((r) => setRecentPosts(r.data.items)).catch(() => {});
  }, []);

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>TwinverseAI</h1>
        <p className={styles.heroSub}>차세대 AI 솔루션으로 비즈니스를 혁신하세요</p>
        <div className={styles.heroCta}>
          <Link to="/services" className={styles.primaryBtn}>서비스 알아보기</Link>
          <Link to="/about" className={styles.secondaryBtn}>회사 소개</Link>
        </div>
      </section>

      {notices.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>공지사항</h2>
            <Link to="/community/notice" className={styles.moreLink}>더보기</Link>
          </div>
          <ul className={styles.noticeList}>
            {notices.map((n) => (
              <li key={n.id}>
                <Link to={`/community/notice/${n.id}`} className={styles.noticeItem}>
                  <span className={styles.noticeTitle}>{n.title}</span>
                  <span className={styles.noticeDate}>{new Date(n.created_at).toLocaleDateString("ko-KR")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentPosts.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>최신 Q&A</h2>
            <Link to="/community/qna" className={styles.moreLink}>더보기</Link>
          </div>
          <ul className={styles.postList}>
            {recentPosts.map((p) => (
              <li key={p.id}>
                <Link to={`/community/qna/${p.id}`} className={styles.postItem}>
                  <span>{p.title}</span>
                  <span className={styles.postMeta}>{p.author} | {new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>서비스</h2>
        <div className={styles.serviceGrid}>
          <div className={styles.serviceCard}><h3>AI 컨설팅</h3><p>비즈니스에 최적화된 AI 전략을 수립합니다</p></div>
          <div className={styles.serviceCard}><h3>커스텀 AI 개발</h3><p>맞춤형 AI 모델과 솔루션을 개발합니다</p></div>
          <div className={styles.serviceCard}><h3>AI 교육</h3><p>팀의 AI 역량을 강화하는 교육 프로그램</p></div>
        </div>
      </section>
    </div>
  );
}
```

### frontend/src/pages/LoginPage.jsx

⚠️ **중요**: 이미 로그인된 상태에서 `/login` 접근 시 홈으로 리다이렉트 필수

```jsx
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const resetForm = () => { setUsername(""); setEmail(""); setPassword(""); setError(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { username, password } : { username, email, password };
      const { data } = await api.post(endpoint, body);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate(data.user.role === "admin" || data.user.role === "superadmin" ? "/admin" : "/");
    } catch (err) {
      const msg = err.response?.data?.detail;
      setError(mode === "login" ? msg || "로그인에 실패했습니다." : msg || "회원가입에 실패했습니다.");
    } finally { setLoading(false); }
  };

  const isLogin = mode === "login";

  return (
    <div className={styles.page}>
      <div className={styles.brand}>
        <div className={styles.brandLogo}>Twinverse<span className={styles.brandAccent}>AI</span></div>
        <p className={styles.brandTagline}>Build, deploy, and manage intelligent digital twins — from concept to production.</p>
        <hr className={styles.brandRule} />
        <span className={styles.brandFootnote}>Authenticated Access</span>
      </div>
      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          <div className={styles.tabRow}>
            <button className={`${styles.tab} ${isLogin ? styles.tabActive : ""}`} onClick={() => { setMode("login"); resetForm(); }} type="button">Sign in</button>
            <button className={`${styles.tab} ${!isLogin ? styles.tabActive : ""}`} onClick={() => { setMode("register"); resetForm(); }} type="button">Register</button>
          </div>
          <p className={styles.formSubheading}>{isLogin ? "Enter your credentials to continue." : "Create a new account."}</p>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <input className={`${styles.input} ${username ? styles.inputFilled : ""}`} type="text" id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
              <label className={styles.label} htmlFor="login-username">Username</label>
            </div>
            {!isLogin && (
              <div className={styles.inputGroup}>
                <input className={`${styles.input} ${email ? styles.inputFilled : ""}`} type="email" id="login-email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <label className={styles.label} htmlFor="login-email">Email</label>
              </div>
            )}
            <div className={styles.inputGroup}>
              <input className={`${styles.input} ${password ? styles.inputFilled : ""}`} type="password" id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} />
              <label className={styles.label} htmlFor="login-password">Password</label>
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.submit} type="submit" disabled={loading}>{loading ? "..." : isLogin ? "Sign in" : "Create account"}</button>
          </form>
          <Link to="/" className={styles.backLink}><span className={styles.backLinkArrow}>&larr;</span> Back to home</Link>
        </div>
      </div>
    </div>
  );
}
```

### frontend/src/pages/AboutPage.jsx

```jsx
import styles from "./AboutPage.module.css";

export default function AboutPage() {
  return (
    <div className={styles.about}>
      <h1 className={styles.title}>회사소개</h1>
      <section className={styles.section}>
        <h2>비전</h2>
        <p>TwinverseAI는 인공지능 기술을 통해 기업과 개인의 디지털 전환을 가속화하는 것을 목표로 합니다.</p>
      </section>
      <section className={styles.section}>
        <h2>미션</h2>
        <p>복잡한 AI 기술을 누구나 쉽게 활용할 수 있도록 직관적인 솔루션을 제공합니다.</p>
      </section>
      <section className={styles.section}>
        <h2>팀</h2>
        <p>AI 연구, 소프트웨어 엔지니어링, 비즈니스 전략 분야의 전문가들로 구성된 팀입니다.</p>
      </section>
      <section className={styles.section}>
        <h2>연혁</h2>
        <ul className={styles.timeline}>
          <li><strong>2026</strong> — TwinverseAI 설립</li>
          <li><strong>2026</strong> — AI 컨설팅 서비스 런칭</li>
        </ul>
      </section>
    </div>
  );
}
```

### frontend/src/pages/ServicesPage.jsx

```jsx
import styles from "./ServicesPage.module.css";

const SERVICES = [
  { title: "AI 컨설팅", desc: "비즈니스 목표에 맞는 AI 도입 전략 수립부터 실행까지 전 과정을 지원합니다.", features: ["현황 분석", "ROI 예측", "실행 로드맵"] },
  { title: "커스텀 AI 개발", desc: "고객 데이터와 요구사항에 최적화된 AI 모델 및 애플리케이션을 개발합니다.", features: ["자연어 처리", "컴퓨터 비전", "예측 분석"] },
  { title: "AI 교육", desc: "조직의 AI 역량을 강화하는 맞춤형 교육 프로그램을 운영합니다.", features: ["워크숍", "핸즈온 실습", "온라인 과정"] },
  { title: "AI 인프라 구축", desc: "확장 가능하고 안정적인 AI 인프라를 설계하고 구축합니다.", features: ["클라우드 아키텍처", "MLOps 파이프라인", "모니터링"] },
];

export default function ServicesPage() {
  return (
    <div className={styles.services}>
      <h1 className={styles.title}>서비스</h1>
      <p className={styles.intro}>TwinverseAI는 AI 전략 수립부터 개발, 교육, 인프라까지 원스톱 솔루션을 제공합니다.</p>
      <div className={styles.grid}>
        {SERVICES.map((s) => (
          <div key={s.title} className={styles.card}>
            <h2 className={styles.cardTitle}>{s.title}</h2>
            <p className={styles.cardDesc}>{s.desc}</p>
            <ul className={styles.features}>{s.features.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### frontend/src/pages/admin/AdminDocs.jsx

⚠️ **중요**: `remark-gfm` 패키지 필수 설치 (`npm install remark-gfm`). 사이드바 서브메뉴에서 docKey를 받아 해당 문서를 렌더링합니다.

```jsx
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../services/api";
import styles from "./AdminDocs.module.css";

const DOC_TITLES = {
  "dev-plan": "개발계획",
  "bugfix-log": "버그수정 로그",
  "upgrade-log": "업그레이드 로그",
  "work-log": "작업일지",
};

export default function AdminDocs() {
  const { docKey } = useParams();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!docKey) return;
    setLoading(true);
    api.get(`/api/docs/${docKey}`)
      .then((r) => setContent(r.data.content))
      .catch(() => setContent("문서를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, [docKey]);

  if (!docKey) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>프로젝트 문서</h1>
        <p className={styles.hint}>왼쪽 사이드바에서 문서를 선택하세요.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.docHeader}>
        <span className={styles.overline}>Project Documentation</span>
        <h1 className={styles.title}>{DOC_TITLES[docKey] || docKey}</h1>
      </div>
      {loading ? (
        <p className={styles.hint}>로딩 중...</p>
      ) : (
        <div className={styles.content}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

### frontend/src/pages/admin/AdminDocs.module.css

**현재 코드베이스의 `frontend/src/pages/admin/AdminDocs.module.css` 전체를 복사하여 생성합니다.**
주요 스타일: `.page`, `.docHeader`, `.hint`, `.overline`, `.title`, `.content` (마크다운 prose 스타일 — h1~h3, code, pre, table, blockquote, hr, ul/ol 포함)

### frontend/src/pages/admin/AdminSkills.jsx

⚠️ **중요**: AI 스킬 목록과 상세 설명이 하드코딩되어 있습니다. 프로젝트에 맞게 스킬 목록을 수정하세요.

**현재 코드베이스의 `frontend/src/pages/admin/AdminSkills.jsx` 전체를 복사하여 생성합니다.**
주요 구조: SKILL_CATEGORIES 배열 (프로젝트 관리, 디자인&UX, 코드 품질), 각 스킬별 name/command/desc/features/usage

### frontend/src/pages/admin/AdminSkills.module.css

**현재 코드베이스의 `frontend/src/pages/admin/AdminSkills.module.css` 전체를 복사하여 생성합니다.**
주요 스타일: `.category`, `.catHeader`, `.command`, `.detail`, `.featureList`, `.usageText`

### frontend/src/pages/admin/AdminPlugins.jsx

⚠️ **중요**: 플러그인 목록과 상세 설명이 하드코딩되어 있습니다. 프로젝트에 맞게 플러그인 목록을 수정하세요.

**현재 코드베이스의 `frontend/src/pages/admin/AdminPlugins.jsx` 전체를 복사하여 생성합니다.**
주요 구조: PLUGIN_CATEGORIES 배열 (공식 플러그인, MCP 서버), 각 플러그인별 name/displayName/source/desc/features/usage/requiresKey

### frontend/src/pages/admin/AdminPlugins.module.css

**현재 코드베이스의 `frontend/src/pages/admin/AdminPlugins.module.css` 전체를 복사하여 생성합니다.**
주요 스타일: `.card`, `.cardOpen`, `.badgeAuto`, `.badgeKey`, `.envKey`, `.featureList`

나머지 페이지 (community/BoardPage, community/PostPage, admin/AdminDashboard, admin/AdminUsers, admin/AdminBoards) 도 동일하게 현재 코드베이스의 코드를 그대로 생성합니다.

---

## 10단계: CSS 디자인 시스템 (Architectural Futurism)

### frontend/src/styles/global.css

Syne (display) + Plus Jakarta Sans (body) 폰트, warm cream 팔레트, ultramarine/terracotta 악센트.
**현재 코드베이스의 `frontend/src/styles/global.css` 전체를 복사하여 생성합니다.**

### frontend/src/index.css

디자인 시스템 변수 브릿지.
**현재 코드베이스의 `frontend/src/index.css` 전체를 복사하여 생성합니다.**

### CSS Module 파일 (22개)

모든 CSS Module 파일은 Dark Glass Neon 디자인 언어를 따릅니다.
**현재 코드베이스의 각 `.module.css` 파일을 그대로 복사하여 생성합니다.**

⚠️ **중요**: `Sidebar.module.css`에는 `.subNav`와 `.subLink` 스타일이 포함되어야 합니다 (children 서브메뉴용).

---

## 11단계: Dockerfile & Docker 설정

### .dockerignore

⚠️ **필수**: `.env`가 Docker 이미지에 복사되면 로컬용 DATABASE_URL(External)이 적용되어 **컨테이너 내부 DB 연결 실패**의 원인이 됩니다.

```dockerignore
# Git
.git
.gitignore

# Environment (시크릿 — Docker 이미지에 포함 금지)
.env
backend/.env
.env.local
.env.*.local

# Node
node_modules
frontend/node_modules

# IDE
.vscode
.idea
*.swp
*.swo

# Python
__pycache__
*.pyc
.pytest_cache

# Build artifacts
frontend/dist

# OS
.DS_Store
Thumbs.db

# Claude
.claude
```

### Dockerfile

⚠️ **핵심 주의사항**:
1. `.dockerignore`로 `.env` 차단 필수 (로컬 DB URL이 Docker에 침투 방지)
2. `ENV`로 기본 환경변수 설정 (Orbitron 대시보드에서 override 가능)
3. `COPY backend/ ./`는 `.dockerignore` 덕분에 `.env`를 복사하지 않음
4. `docs/`는 Docker 이미지에 포함 (DB seed용)
5. **갤러리 기본 이미지는 `backend/gallery_defaults/`에 포함** — `COPY backend/ ./`로 자동 포함됨
6. **별도 `COPY uploads/` 사용 금지** — Docker VOLUME이 덮어씀

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

# Copy backend code (.env는 .dockerignore로 제외됨)
# ⚠️ backend/gallery_defaults/도 이 단계에서 함께 복사됨
COPY backend/ ./

# Copy frontend build output
COPY --from=frontend-build /app/frontend/dist /app/static

# Copy docs (for doc viewer API — DB seed용)
COPY docs/ /app/docs/
ENV DOCS_DIR=/app/docs

# Default environment variables
# ⚠️ DATABASE_URL은 반드시 Docker 내부(Internal) 주소 사용
# Orbitron 대시보드에서 override 가능
ENV DATABASE_URL=postgresql://orbitron_user:orbitron_db_pass@orbitron-{{PROJECT_NAME_LOWER}}-db:3718/orbitron_db
ENV SECRET_KEY={{PROJECT_NAME_LOWER}}-jwt-secret-key-2026
ENV FRONTEND_URL=https://{{PROJECT_NAME_LOWER}}.twinverse.org
ENV UPLOAD_DIR=/app/uploads

# uploads 디렉토리 (갤러리 기본 이미지는 backend/gallery_defaults/에서 시작 시 복사)
RUN mkdir -p /app/uploads

VOLUME ["/app/uploads"]

# Expose port
EXPOSE 8000

# Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Orbitron.yaml

```yaml
# ============================================================
# {{PROJECT_NAME}} — Orbitron 배포 설정
# ============================================================
#
# 배포 방식: Dockerfile 멀티스테이지 빌드 (자동 감지)
#   Stage 1: Node 20 → frontend 빌드 (npm ci + vite build)
#   Stage 2: Python 3.12 → backend + static 서빙 (uvicorn)
#
# 중요: Orbitron 자동 Dockerfile 생성을 사용하지 않음
#       프로젝트 루트의 Dockerfile을 직접 사용
# ============================================================

build:
  dockerfile: Dockerfile
start:
  command: uvicorn main:app --host 0.0.0.0 --port 8000

port: 8000

healthcheck:
  path: /health
  interval: 30
  timeout: 10

env:
  # ── 필수: 데이터베이스 ──
  - key: DATABASE_URL
    description: "PostgreSQL 연결 URL (Docker 내부 주소)"
    required: true
    sync: false

  # ── 필수: JWT 인증 ──
  - key: SECRET_KEY
    description: "JWT 토큰 서명 키 (최소 32자 랜덤 문자열)"
    required: true
    sync: false

  # ── 관리자 계정 ──
  - key: SUPERADMIN_USERNAME
    value: "admin"
    sync: true

  - key: SUPERADMIN_PASSWORD
    required: true
    sync: false

  # ── 프론트엔드 ──
  - key: VITE_API_URL
    value: ""
    sync: true

  - key: FRONTEND_URL
    description: "CORS 허용 오리진"
    sync: false

  # ── 파일 업로드 ──
  - key: UPLOAD_DIR
    value: "/app/uploads"
    sync: true

  # ── 문서 ──
  - key: DOCS_DIR
    value: "/app/docs"
    sync: true

volumes:
  - path: /app/uploads
    description: "사용자 업로드 파일 영속 저장"

# ============================================================
# 배포 체크리스트 & 트러블슈팅
# ============================================================
#
# 1. 환경변수 (Orbitron 대시보드)
#    - DATABASE_URL: Docker 내부 주소 사용 (orbitron-xxx-db:port)
#    - SECRET_KEY: 랜덤 32자+
#    - SUPERADMIN_PASSWORD: 관리자 비밀번호
#    - FRONTEND_URL: https://{{PROJECT_NAME_LOWER}}.twinverse.org
#
# 2. .env 주의사항
#    - .env는 로컬 개발 전용 (External DB URL 사용)
#    - .dockerignore로 Docker 이미지에 복사 차단
#    - Docker는 Dockerfile의 ENV 기본값 또는 Orbitron 대시보드 값 사용
#    - .env 형식: KEY=value (접두어/설명 금지, 주석은 # 사용)
#
# 3. 트러블슈팅
#    - 문서/게시글 404 → /health에서 DB 연결 확인
#    - documents=0 → DATABASE_URL 확인
#    - 이미지 안보임 → files=0 → uploads/ 볼륨 확인
#    - 로그인 실패 → SECRET_KEY 확인
#    - CORS 에러 → FRONTEND_URL 확인
# ============================================================
```

---

## 12단계: 프로젝트 문서 초기화

### docs/dev-plan.md

```markdown
# TwinverseAI 개발계획서

## 프로젝트 개요
- 프로젝트명: TwinverseAI
- 기술 스택: FastAPI + React + Vite + PostgreSQL
- 배포: Orbitron (Docker)

## 마일스톤

| 번호 | 마일스톤 | 상태 |
|------|----------|------|
| M1 | 기본 인프라 (인증, DB, 배포) | 완료 |
| M2 | 포탈 리디자인 (게시판, 레이아웃) | 완료 |
| M3 | 디자인 시스템 (Architectural Futurism) | 완료 |

## 기능 목록

| 기능 | 상태 | 비고 |
|------|------|------|
| JWT 인증 (로그인/회원가입) | 완료 | python-jose sub 문자열 변환 |
| 어드민 대시보드 | 완료 | 통계/사용자/게시판 관리 |
| 커뮤니티 게시판 4종 | 완료 | 공지/Q&A/갤러리/동영상 |
| 댓글 시스템 | 완료 | |
| 파일 업로드 | 완료 | 이미지 10MB, 동영상 100MB |
| 프로젝트 문서 뷰어 | 완료 | |
| AI 스킬 뷰어 | 완료 | |
| MCP 플러그인 관리 | 완료 | |
```

### docs/bugfix-log.md

```markdown
# 버그수정 로그

| 날짜 | 버그 | 원인 | 수정 내용 | 관련 파일 |
|------|------|------|-----------|-----------|
| 2026-04-04 | JWT 토큰 디코딩 실패 | python-jose sub 클레임 문자열 필수 | str(to_encode["sub"]) + int(payload.get("sub")) | auth_service.py, deps.py |
| 2026-04-04 | 로그인 리다이렉트 루프 | 401 인터셉터가 auth 엔드포인트도 처리 | /api/auth/ URL 제외 + 이미 로그인 시 리다이렉트 | api.js, LoginPage.jsx |
```

### docs/upgrade-log.md

```markdown
# 업그레이드 로그

| 날짜 | 변경 내용 | 카테고리 | 관련 파일 |
|------|-----------|----------|-----------|
| 2026-04-04 | 포탈 전체 리디자인 — TopBar/Sidebar/Footer 레이아웃 | feat | layout 컴포넌트 전체 |
| 2026-04-04 | 커뮤니티 게시판 4종 (공지/Q&A/갤러리/동영상) | feat | boards.py, BoardPage.jsx 등 |
| 2026-04-04 | Architectural Futurism 디자인 시스템 | style | global.css, 21개 CSS modules |
```

### docs/work-log.md

```markdown
# 작업일지

---
```

---

## 13단계: CLAUDE.md 생성

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
- ⚠️ python-jose는 JWT sub를 문자열로 요구 → str() 변환 필수

## Git 규칙
- 기본 브랜치는 반드시 `main` 사용 (master 금지 — Orbitron이 main을 기본으로 clone)
- `git init` 후 `git branch -m master main` 또는 `git init -b main` 사용

## 배포
- Orbitron 배포 서버 사용 (Linux)
- DB: Orbitron PostgreSQL 서버
- Windows에서는 커밋/푸시만 수행, 배포는 Orbitron에서 진행
- **반드시 프로젝트 루트에 Dockerfile 포함** (Orbitron 자동 생성 Dockerfile은 깨지므로 절대 의존 금지)
- Dockerfile은 멀티스테이지 빌드: Node(프론트엔드 빌드) → Python(백엔드 + 정적파일 서빙)
- **반드시 .dockerignore로 .env 차단** (로컬 DB URL이 Docker에 침투하면 연결 실패)
- Dockerfile에 ENV로 기본 환경변수 설정 (Internal DB URL, SECRET_KEY 등)

## .env 규칙
- .env는 로컬 개발 전용 (.gitignore + .dockerignore에 포함)
- 형식: `KEY=value` (접두어/설명 금지, `Internal DATABASE_URL=...` ← ❌ 파싱 실패)
- Docker 배포는 Dockerfile ENV 또는 Orbitron 대시보드 사용
- 비환경변수 메모(SSH 정보, 토큰 등)는 .env에 넣지 말 것

## 파일 업로드 & 이미지 서빙 규칙
- **UPLOAD_DIR 빈 문자열 방어 필수**: `Path("")`는 CWD(.)로 해석됨 → `.strip()` 후 체크
- **StaticFiles mount로 /uploads 서빙 금지**: Docker VOLUME과 충돌 → 명시적 API 라우트 사용
- **갤러리 기본 이미지는 `backend/gallery_defaults/`에 포함**: Docker COPY/VOLUME에 의존하지 않음
- **Vite 프록시 필수**: `<img src="/uploads/...">` → Vite가 HTML 반환 방지 (vite.config.js proxy 설정)
- **api.js baseURL은 항상 same-origin (`""`)**: Vite 프록시 + Docker same-origin으로 통일
- `/health` 엔드포인트에 `uploads_dir`, `uploads_files` 포함하여 배포 진단 가능

## 커밋 메시지 규칙
- `feat:` 새 기능 / `fix:` 버그 수정 / `style:` UI / `refactor:` 리팩토링 / `docs:` 문서 / `infra:` 인프라
```

---

## 14단계: Git 첫 커밋

```bash
cd c:\WORK\TwinverseAI && git add -A && git commit -m "feat: 프로젝트 초기 세팅 — 풀스택 포탈 (FastAPI + React + PostgreSQL)"
```

---

## 실행 완료 체크리스트

- [ ] Git 초기화 (.gitignore 포함)
- [ ] Backend 전체 파일 생성 (models 4개, routers 8개, services, deps, main, seed_admin)
- [ ] **backend/.env 생성** (KEY=value 형식 엄수, 접두어/메모 금지)
- [ ] **backend/.env.example 생성** (형식 가이드 포함)
- [ ] Frontend npm install 완료
- [ ] Frontend 전체 파일 생성 (App.jsx, 모든 컴포넌트/페이지/CSS modules)
- [ ] 디자인 시스템 (global.css, index.css, 21개 CSS modules)
- [ ] **Dockerfile (ENV 기본값 포함 — Internal DB URL)**
- [ ] **.dockerignore (.env 차단 필수)**
- [ ] **Orbitron.yaml (환경변수 8개, 헬스체크, 트러블슈팅)**
- [ ] docs/ 초기 문서 4개
- [ ] CLAUDE.md
- [ ] 첫 커밋
- [ ] `npm run build` 성공 확인
- [ ] `uvicorn main:app --reload` 성공 확인 (DB 연결 필요)
- [ ] **.env 형식 검증** (`grep -P "^\w" backend/.env` — 모든 줄이 KEY=value 또는 #주석인지 확인)
- [ ] **Vite 프록시 검증** — `curl -s http://localhost:5173/uploads/` 가 `text/html`이 아닌 이미지/JSON 반환 확인
- [ ] **UPLOAD_DIR 빈 문자열 검증** — `/health` 응답의 `uploads_dir`이 `.` 이 아닌 절대 경로인지 확인
- [ ] **갤러리 이미지 검증** — `/health` 응답의 `uploads_files`에 `gallery-*.jpg` 파일이 존재하는지 확인
