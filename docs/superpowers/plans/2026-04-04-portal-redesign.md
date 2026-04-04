# Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform TwinverseAI into a full portal with top nav, sidebar, board system (notice/Q&A/gallery/video), public pages (about/services), and consolidated admin.

**Architecture:** Universal Post model with board_type discriminator. New layout shell (TopBar + Sidebar + Footer + MainLayout) wraps all pages. Community boards share reusable components (PostList, PostDetail, PostForm, CommentSection, FileUpload). Existing dev tools (docs/skills/plugins) move under /admin.

**Tech Stack:** FastAPI + SQLModel (backend), React 19 + React Router v7 + CSS Modules (frontend), axios, react-markdown, bcrypt, python-jose

**Spec:** `docs/superpowers/specs/2026-04-04-portal-redesign-design.md`

---

## File Structure

### Backend — New/Modified Files

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/models/post.py` | Post SQLModel (board_type, title, content, etc.) |
| Create | `backend/models/comment.py` | Comment SQLModel (post_id, author_id, content) |
| Create | `backend/models/file.py` | File SQLModel (post_id, stored_path, file_type) |
| Modify | `backend/models/__init__.py` | Export all models |
| Create | `backend/routers/boards.py` | Board CRUD (list, detail, create, update, delete) |
| Create | `backend/routers/comments.py` | Comment CRUD |
| Create | `backend/routers/files.py` | File upload endpoint |
| Modify | `backend/routers/admin.py` | Add stats, user role/active mgmt, board mgmt |
| Modify | `backend/deps.py` | Add `get_optional_user` for public routes |
| Modify | `backend/main.py` | Mount new routers, serve uploads dir |
| Modify | `backend/requirements.txt` | Add `python-multipart` |
| Modify | `Dockerfile` | Add uploads volume |

### Frontend — New/Modified Files

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/components/layout/TopBar.jsx` | Top navigation bar |
| Create | `frontend/src/components/layout/TopBar.module.css` | TopBar styles |
| Create | `frontend/src/components/layout/Sidebar.jsx` | Left sidebar (context-dependent) |
| Create | `frontend/src/components/layout/Sidebar.module.css` | Sidebar styles |
| Create | `frontend/src/components/layout/Footer.jsx` | Footer |
| Create | `frontend/src/components/layout/Footer.module.css` | Footer styles |
| Create | `frontend/src/components/layout/MainLayout.jsx` | Shell: TopBar + Sidebar + Content + Footer |
| Create | `frontend/src/components/layout/MainLayout.module.css` | Layout grid styles |
| Create | `frontend/src/components/board/PostList.jsx` | Table/grid post listing |
| Create | `frontend/src/components/board/PostList.module.css` | PostList styles |
| Create | `frontend/src/components/board/PostDetail.jsx` | Single post view |
| Create | `frontend/src/components/board/PostDetail.module.css` | PostDetail styles |
| Create | `frontend/src/components/board/PostForm.jsx` | Create/edit post form |
| Create | `frontend/src/components/board/PostForm.module.css` | PostForm styles |
| Create | `frontend/src/components/board/CommentSection.jsx` | Comment list + form |
| Create | `frontend/src/components/board/CommentSection.module.css` | CommentSection styles |
| Create | `frontend/src/components/board/FileUpload.jsx` | File upload widget |
| Create | `frontend/src/components/board/FileUpload.module.css` | FileUpload styles |
| Rewrite | `frontend/src/pages/HomePage.jsx` | Hero banner + recent notices + posts + service summary |
| Create | `frontend/src/pages/AboutPage.jsx` | Company info (code-fixed) |
| Create | `frontend/src/pages/AboutPage.module.css` | About styles |
| Create | `frontend/src/pages/ServicesPage.jsx` | Service cards (code-fixed) |
| Create | `frontend/src/pages/ServicesPage.module.css` | Services styles |
| Create | `frontend/src/pages/community/BoardPage.jsx` | Universal board listing page |
| Create | `frontend/src/pages/community/BoardPage.module.css` | BoardPage styles |
| Create | `frontend/src/pages/community/PostPage.jsx` | Post detail/create/edit page |
| Create | `frontend/src/pages/community/PostPage.module.css` | PostPage styles |
| Rewrite | `frontend/src/pages/DashboardPage.jsx` → rename to `frontend/src/pages/admin/AdminDashboard.jsx` | Extended admin dashboard |
| Create | `frontend/src/pages/admin/AdminDashboard.module.css` | Dashboard styles |
| Create | `frontend/src/pages/admin/AdminUsers.jsx` | User management |
| Create | `frontend/src/pages/admin/AdminUsers.module.css` | AdminUsers styles |
| Create | `frontend/src/pages/admin/AdminBoards.jsx` | Board management |
| Create | `frontend/src/pages/admin/AdminBoards.module.css` | AdminBoards styles |
| Move | `frontend/src/pages/DocViewerPage.jsx` → `frontend/src/pages/admin/AdminDocs.jsx` | Docs viewer under admin |
| Move | `frontend/src/pages/SkillsPage.jsx` → `frontend/src/pages/admin/AdminSkills.jsx` | Skills viewer under admin |
| Move | `frontend/src/pages/PluginsPage.jsx` → `frontend/src/pages/admin/AdminPlugins.jsx` | Plugins mgmt under admin |
| Rewrite | `frontend/src/App.jsx` | New routing with MainLayout shell |
| Modify | `frontend/src/components/ProtectedRoute.jsx` | Keep as-is (already works) |

---

## Task 1: Backend Models (Post, Comment, File)

**Files:**
- Create: `backend/models/post.py`
- Create: `backend/models/comment.py`
- Create: `backend/models/file.py`
- Modify: `backend/models/__init__.py`

- [ ] **Step 1: Create Post model**

```python
# backend/models/post.py
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

- [ ] **Step 2: Create Comment model**

```python
# backend/models/comment.py
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

- [ ] **Step 3: Create File model**

```python
# backend/models/file.py
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

- [ ] **Step 4: Update models/__init__.py**

```python
# backend/models/__init__.py
from .user import User
from .post import Post
from .comment import Comment
from .file import FileRecord
```

- [ ] **Step 5: Verify models load**

Run: `cd c:\WORK\TwinverseAI\backend && python -c "from models import User, Post, Comment, FileRecord; print('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add backend/models/post.py backend/models/comment.py backend/models/file.py backend/models/__init__.py
git commit -m "feat: add Post, Comment, FileRecord models for board system"
```

---

## Task 2: Backend Dependencies Update

**Files:**
- Modify: `backend/deps.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add optional user dependency and python-multipart**

Add `get_optional_user` to `backend/deps.py` — returns `User | None` without raising 401 for unauthenticated requests (needed for public board routes that optionally show author info).

```python
# Add to backend/deps.py after the existing get_current_user function:

def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    session: Session = Depends(get_session),
) -> User | None:
    if not credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None
    user = session.exec(select(User).where(User.id == payload.get("sub"))).first()
    if not user or not user.is_active:
        return None
    return user
```

- [ ] **Step 2: Add python-multipart to requirements.txt**

Append `python-multipart` to `backend/requirements.txt` (required by FastAPI for file uploads).

- [ ] **Step 3: Commit**

```bash
git add backend/deps.py backend/requirements.txt
git commit -m "feat: add optional auth dependency and python-multipart"
```

---

## Task 3: Boards Router

**Files:**
- Create: `backend/routers/boards.py`

- [ ] **Step 1: Create boards router**

```python
# backend/routers/boards.py
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

    # Get attached files
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

    # Notice board: admin only
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

    # Delete associated comments and files
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

- [ ] **Step 2: Commit**

```bash
git add backend/routers/boards.py
git commit -m "feat: add boards router with full CRUD and permission checks"
```

---

## Task 4: Comments Router

**Files:**
- Create: `backend/routers/comments.py`

- [ ] **Step 1: Create comments router**

```python
# backend/routers/comments.py
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

- [ ] **Step 2: Commit**

```bash
git add backend/routers/comments.py
git commit -m "feat: add comments router"
```

---

## Task 5: Files Router

**Files:**
- Create: `backend/routers/files.py`

- [ ] **Step 1: Create files router with upload endpoint**

```python
# backend/routers/files.py
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import Session
from database import get_session
from models import FileRecord, User
from deps import get_current_user

router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
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

    # Read file content
    content = await file.read()
    if len(content) > max_size:
        limit_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File too large. Max {limit_mb}MB")

    # Save to disk
    ext = Path(file.filename or "file").suffix
    stored_name = f"{uuid.uuid4()}{ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_path = UPLOAD_DIR / stored_name

    with open(stored_path, "wb") as f:
        f.write(content)

    # Save to DB
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

- [ ] **Step 2: Commit**

```bash
git add backend/routers/files.py
git commit -m "feat: add file upload router with size limits"
```

---

## Task 6: Extend Admin Router

**Files:**
- Modify: `backend/routers/admin.py`

- [ ] **Step 1: Extend admin.py with stats, user management, and board management**

Replace `backend/routers/admin.py` entirely:

```python
# backend/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func, col
from database import get_session
from models import User, Post, Comment
from deps import require_admin

router = APIRouter()


# --- Stats ---

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


# Keep legacy endpoint for backward compat
@router.get("/dashboard")
def admin_dashboard(admin: User = Depends(require_admin), session: Session = Depends(get_session)):
    return admin_stats(admin, session)


# --- User Management ---

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
    role: str  # "user" | "admin" | "superadmin"


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
    # Only superadmin can assign superadmin
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


# --- Board Management (all posts across boards) ---

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

- [ ] **Step 2: Commit**

```bash
git add backend/routers/admin.py
git commit -m "feat: extend admin router with stats, user mgmt, board mgmt"
```

---

## Task 7: Update Backend main.py

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Mount new routers and uploads static files**

Update `backend/main.py` — add imports for new routers, mount them, and add uploads StaticFiles:

```python
# Add to imports at top:
from routers import auth, admin, docs, skills, plugins, boards, comments, files

# Add after existing router includes (after plugins line):
app.include_router(boards.router, prefix="/api/boards", tags=["boards"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(files.router, prefix="/api/files", tags=["files"])

# Add uploads serving before the SPA catch-all:
_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")
```

The full modified file should have routers imported as `from routers import auth, admin, docs, skills, plugins, boards, comments, files`, all 8 routers included, uploads mounted before the SPA catch-all route.

- [ ] **Step 2: Verify server starts**

Run: `cd c:\WORK\TwinverseAI\backend && python -c "from main import app; print('Routes:', len(app.routes))"`
Expected: prints route count without errors

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: mount board/comment/file routers and uploads serving"
```

---

## Task 8: Update Dockerfile

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Add uploads volume and directory**

Update `Dockerfile` — add uploads directory creation and volume declaration:

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

# Copy docs (for doc viewer API)
COPY docs/ /app/docs/

# Create uploads directory
RUN mkdir -p /app/uploads

VOLUME ["/app/uploads"]

# Expose port
EXPOSE 8000

# Run
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "feat: add uploads volume to Dockerfile"
```

---

## Task 9: Frontend Layout Components

**Files:**
- Create: `frontend/src/components/layout/TopBar.jsx`
- Create: `frontend/src/components/layout/TopBar.module.css`
- Create: `frontend/src/components/layout/Sidebar.jsx`
- Create: `frontend/src/components/layout/Sidebar.module.css`
- Create: `frontend/src/components/layout/Footer.jsx`
- Create: `frontend/src/components/layout/Footer.module.css`
- Create: `frontend/src/components/layout/MainLayout.jsx`
- Create: `frontend/src/components/layout/MainLayout.module.css`

- [ ] **Step 1: Create TopBar component**

```jsx
// frontend/src/components/layout/TopBar.jsx
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
        <Link to="/" className={styles.logo}>
          TwinverseAI
        </Link>

        <button
          className={styles.hamburger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="메뉴 열기"
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`${styles.navLink} ${isActive(item.path) ? styles.active : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to="/admin"
              className={`${styles.navLink} ${isActive("/admin") ? styles.active : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              관리자
            </Link>
          )}
        </nav>

        <div className={styles.auth}>
          {token ? (
            <div className={styles.userMenu}>
              <span className={styles.username}>{user?.username}</span>
              <button onClick={handleLogout} className={styles.logoutBtn}>
                로그아웃
              </button>
            </div>
          ) : (
            <Link to="/login" className={styles.loginBtn}>
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create TopBar.module.css**

```css
/* frontend/src/components/layout/TopBar.module.css */
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg, #fff);
  border-bottom: 1px solid var(--color-border, #e5e5e5);
}

.inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  height: 3.5rem;
}

.logo {
  font-weight: 700;
  font-size: 1.25rem;
  text-decoration: none;
  color: var(--color-text, #111);
  margin-right: 2rem;
}

.nav {
  display: flex;
  gap: 0.25rem;
  flex: 1;
}

.navLink {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-secondary, #555);
  transition: background 0.15s, color 0.15s;
}

.navLink:hover {
  background: var(--color-bg-hover, #f5f5f5);
  color: var(--color-text, #111);
}

.active {
  color: var(--color-primary, #2563eb);
  background: var(--color-primary-bg, #eff6ff);
}

.auth {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.userMenu {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.username {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-secondary, #555);
}

.loginBtn,
.logoutBtn {
  padding: 0.4rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-border, #ddd);
  background: none;
  color: var(--color-text, #111);
  text-decoration: none;
  transition: background 0.15s;
}

.loginBtn:hover,
.logoutBtn:hover {
  background: var(--color-bg-hover, #f5f5f5);
}

.hamburger {
  display: none;
  flex-direction: column;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
}

.hamburger span {
  width: 20px;
  height: 2px;
  background: var(--color-text, #111);
  border-radius: 1px;
}

@media (max-width: 768px) {
  .hamburger {
    display: flex;
  }

  .nav {
    display: none;
    position: absolute;
    top: 3.5rem;
    left: 0;
    right: 0;
    background: var(--color-bg, #fff);
    flex-direction: column;
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-border, #e5e5e5);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .navOpen {
    display: flex;
  }
}
```

- [ ] **Step 3: Create Sidebar component**

```jsx
// frontend/src/components/layout/Sidebar.jsx
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
      { label: "프로젝트 문서", path: "/admin/docs" },
      { label: "AI 스킬", path: "/admin/skills" },
      { label: "플러그인", path: "/admin/plugins" },
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
          <Link
            key={item.path}
            to={item.path}
            className={`${styles.link} ${
              location.pathname === item.path ? styles.active : ""
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 4: Create Sidebar.module.css**

```css
/* frontend/src/components/layout/Sidebar.module.css */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  padding: 1.5rem 0;
  border-right: 1px solid var(--color-border, #e5e5e5);
}

.title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-tertiary, #999);
  padding: 0 1.25rem;
  margin-bottom: 0.5rem;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.link {
  display: block;
  padding: 0.5rem 1.25rem;
  text-decoration: none;
  font-size: 0.9rem;
  color: var(--color-text-secondary, #555);
  transition: background 0.15s, color 0.15s;
}

.link:hover {
  background: var(--color-bg-hover, #f5f5f5);
  color: var(--color-text, #111);
}

.active {
  color: var(--color-primary, #2563eb);
  background: var(--color-primary-bg, #eff6ff);
  font-weight: 500;
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
}
```

- [ ] **Step 5: Create Footer component**

```jsx
// frontend/src/components/layout/Footer.jsx
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

- [ ] **Step 6: Create Footer.module.css**

```css
/* frontend/src/components/layout/Footer.module.css */
.footer {
  border-top: 1px solid var(--color-border, #e5e5e5);
  padding: 1.5rem 0;
  margin-top: auto;
}

.inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.company {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text, #111);
}

.links {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.links a {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #555);
  text-decoration: none;
}

.links a:hover {
  color: var(--color-text, #111);
}

.sep {
  color: var(--color-border, #ddd);
  font-size: 0.75rem;
}

.copy {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--color-text-tertiary, #999);
}

@media (max-width: 768px) {
  .inner {
    flex-direction: column;
    text-align: center;
  }

  .copy {
    margin-left: 0;
  }
}
```

- [ ] **Step 7: Create MainLayout component**

```jsx
// frontend/src/components/layout/MainLayout.jsx
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

- [ ] **Step 8: Create MainLayout.module.css**

```css
/* frontend/src/components/layout/MainLayout.module.css */
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.body {
  flex: 1;
  display: flex;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

.content {
  flex: 1;
  padding: 1.5rem 2rem;
  min-width: 0;
}

.full {
  max-width: 100%;
}

@media (max-width: 768px) {
  .content {
    padding: 1rem;
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/layout/
git commit -m "feat: add layout components (TopBar, Sidebar, Footer, MainLayout)"
```

---

## Task 10: Frontend Board Components

**Files:**
- Create: `frontend/src/components/board/PostList.jsx` + CSS
- Create: `frontend/src/components/board/PostDetail.jsx` + CSS
- Create: `frontend/src/components/board/PostForm.jsx` + CSS
- Create: `frontend/src/components/board/CommentSection.jsx` + CSS
- Create: `frontend/src/components/board/FileUpload.jsx` + CSS

- [ ] **Step 1: Create PostList component**

```jsx
// frontend/src/components/board/PostList.jsx
import { Link } from "react-router-dom";
import styles from "./PostList.module.css";

export default function PostList({ posts, boardType, basePath }) {
  const isGrid = boardType === "gallery";

  if (isGrid) {
    return (
      <div className={styles.grid}>
        {posts.map((p) => (
          <Link key={p.id} to={`${basePath}/${p.id}`} className={styles.card}>
            {p.thumbnail && (
              <img src={p.thumbnail} alt={p.title} className={styles.thumb} />
            )}
            <div className={styles.cardBody}>
              <h4 className={styles.cardTitle}>{p.title}</h4>
              <span className={styles.cardMeta}>{p.author}</span>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.thTitle}>제목</th>
          <th className={styles.thMeta}>작성자</th>
          <th className={styles.thMeta}>날짜</th>
          <th className={styles.thMeta}>조회</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((p) => (
          <tr key={p.id} className={p.is_pinned ? styles.pinned : ""}>
            <td>
              <Link to={`${basePath}/${p.id}`} className={styles.postLink}>
                {p.is_pinned && <span className={styles.pin}>[공지]</span>}
                {p.title}
              </Link>
            </td>
            <td className={styles.meta}>{p.author}</td>
            <td className={styles.meta}>
              {new Date(p.created_at).toLocaleDateString("ko-KR")}
            </td>
            <td className={styles.meta}>{p.view_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Create PostList.module.css**

```css
/* frontend/src/components/board/PostList.module.css */
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #e5e5e5);
}

.table th {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-tertiary, #999);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.thTitle {
  width: auto;
}

.thMeta {
  width: 100px;
  text-align: center !important;
}

.meta {
  text-align: center !important;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #666);
}

.postLink {
  text-decoration: none;
  color: var(--color-text, #111);
  font-weight: 500;
}

.postLink:hover {
  color: var(--color-primary, #2563eb);
}

.pin {
  color: var(--color-danger, #dc2626);
  font-weight: 600;
  margin-right: 0.4rem;
  font-size: 0.85rem;
}

.pinned {
  background: var(--color-bg-subtle, #fafafa);
}

/* Grid mode for gallery */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.card {
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 8px;
  overflow: hidden;
  text-decoration: none;
  color: var(--color-text, #111);
  transition: box-shadow 0.15s;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.thumb {
  width: 100%;
  aspect-ratio: 4/3;
  object-fit: cover;
  display: block;
  background: var(--color-bg-subtle, #f5f5f5);
}

.cardBody {
  padding: 0.75rem;
}

.cardTitle {
  font-size: 0.9rem;
  font-weight: 500;
  margin: 0 0 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cardMeta {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #666);
}
```

- [ ] **Step 3: Create PostDetail component**

```jsx
// frontend/src/components/board/PostDetail.jsx
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import styles from "./PostDetail.module.css";

export default function PostDetail({ post, onDelete, canEdit }) {
  const navigate = useNavigate();

  return (
    <article className={styles.detail}>
      <header className={styles.header}>
        <h1 className={styles.title}>{post.title}</h1>
        <div className={styles.meta}>
          <span>{post.author}</span>
          <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
          <span>조회 {post.view_count}</span>
        </div>
      </header>

      {post.video_url && (
        <div className={styles.video}>
          {post.video_url.includes("youtube") || post.video_url.includes("youtu.be") ? (
            <iframe
              src={post.video_url.replace("watch?v=", "embed/")}
              title={post.title}
              allowFullScreen
              className={styles.iframe}
            />
          ) : (
            <video src={post.video_url} controls className={styles.videoPlayer} />
          )}
        </div>
      )}

      <div className={styles.content}>
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>

      {post.files && post.files.length > 0 && (
        <div className={styles.files}>
          <h3 className={styles.filesTitle}>첨부파일</h3>
          <div className={styles.fileList}>
            {post.files.map((f) =>
              f.file_type === "image" ? (
                <img
                  key={f.id}
                  src={f.stored_path}
                  alt={f.original_name}
                  className={styles.image}
                />
              ) : (
                <a key={f.id} href={f.stored_path} download className={styles.fileLink}>
                  {f.original_name} ({(f.file_size / 1024).toFixed(0)}KB)
                </a>
              )
            )}
          </div>
        </div>
      )}

      {canEdit && (
        <div className={styles.actions}>
          <button
            onClick={() => navigate(`edit`)}
            className={styles.editBtn}
          >
            수정
          </button>
          <button onClick={onDelete} className={styles.deleteBtn}>
            삭제
          </button>
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Create PostDetail.module.css**

```css
/* frontend/src/components/board/PostDetail.module.css */
.detail {
  max-width: 800px;
}

.header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border, #e5e5e5);
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
}

.meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #666);
}

.content {
  line-height: 1.7;
  font-size: 0.95rem;
  margin-bottom: 2rem;
}

.content img {
  max-width: 100%;
  border-radius: 6px;
}

.video {
  margin-bottom: 1.5rem;
}

.iframe {
  width: 100%;
  aspect-ratio: 16/9;
  border: none;
  border-radius: 8px;
}

.videoPlayer {
  width: 100%;
  max-height: 500px;
  border-radius: 8px;
}

.files {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--color-bg-subtle, #fafafa);
  border-radius: 8px;
}

.filesTitle {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.fileList {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.image {
  max-width: 300px;
  max-height: 200px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
}

.fileLink {
  font-size: 0.85rem;
  color: var(--color-primary, #2563eb);
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1.5rem;
}

.editBtn,
.deleteBtn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-border, #ddd);
  background: none;
  transition: background 0.15s;
}

.editBtn:hover {
  background: var(--color-bg-hover, #f5f5f5);
}

.deleteBtn {
  color: var(--color-danger, #dc2626);
  border-color: var(--color-danger, #dc2626);
}

.deleteBtn:hover {
  background: #fef2f2;
}
```

- [ ] **Step 5: Create PostForm component**

```jsx
// frontend/src/components/board/PostForm.jsx
import { useState } from "react";
import FileUpload from "./FileUpload";
import styles from "./PostForm.module.css";

export default function PostForm({ boardType, initial, onSubmit, loading }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url || "");
  const [files, setFiles] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ title, content, video_url: videoUrl || null }, files);
  };

  const showVideo = boardType === "video";
  const showFiles = boardType === "gallery" || boardType === "video";

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        placeholder="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={styles.input}
        required
      />

      <textarea
        placeholder="내용 (마크다운 지원)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={styles.textarea}
        rows={12}
      />

      {showVideo && (
        <input
          type="url"
          placeholder="동영상 URL (YouTube 등)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          className={styles.input}
        />
      )}

      {showFiles && (
        <FileUpload
          accept={boardType === "gallery" ? "image/*" : "video/*,image/*"}
          files={files}
          onChange={setFiles}
        />
      )}

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? "저장 중..." : initial ? "수정" : "작성"}
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Create PostForm.module.css**

```css
/* frontend/src/components/board/PostForm.module.css */
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 800px;
}

.input {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s;
}

.input:focus {
  border-color: var(--color-primary, #2563eb);
}

.textarea {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
  font-size: 0.95rem;
  resize: vertical;
  min-height: 200px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
}

.textarea:focus {
  border-color: var(--color-primary, #2563eb);
}

.submitBtn {
  align-self: flex-start;
  padding: 0.6rem 1.5rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--color-primary, #2563eb);
  color: #fff;
  transition: opacity 0.15s;
}

.submitBtn:hover {
  opacity: 0.9;
}

.submitBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 7: Create CommentSection component**

```jsx
// frontend/src/components/board/CommentSection.jsx
import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./CommentSection.module.css";

export default function CommentSection({ postId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      const res = await api.get(`/api/comments/${postId}`);
      setComments(res.data);
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/comments/${postId}`, { content: text });
      setText("");
      loadComments();
    } catch {
      alert("댓글 작성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/api/comments/${commentId}`);
      loadComments();
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  const canDelete = (c) =>
    user && (c.author_id === user.id || user.role === "admin" || user.role === "superadmin");

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>댓글 ({comments.length})</h3>

      <ul className={styles.list}>
        {comments.map((c) => (
          <li key={c.id} className={styles.item}>
            <div className={styles.commentHeader}>
              <strong className={styles.author}>{c.author}</strong>
              <span className={styles.date}>
                {new Date(c.created_at).toLocaleDateString("ko-KR")}
              </span>
              {canDelete(c) && (
                <button
                  onClick={() => handleDelete(c.id)}
                  className={styles.deleteBtn}
                >
                  삭제
                </button>
              )}
            </div>
            <p className={styles.commentText}>{c.content}</p>
          </li>
        ))}
      </ul>

      {token && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea
            placeholder="댓글을 입력하세요"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={styles.textarea}
            rows={3}
          />
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? "등록 중..." : "댓글 등록"}
          </button>
        </form>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Create CommentSection.module.css**

```css
/* frontend/src/components/board/CommentSection.module.css */
.section {
  margin-top: 2rem;
  border-top: 1px solid var(--color-border, #e5e5e5);
  padding-top: 1.5rem;
}

.title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
}

.item {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.commentHeader {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.25rem;
}

.author {
  font-size: 0.85rem;
}

.date {
  font-size: 0.8rem;
  color: var(--color-text-tertiary, #999);
}

.deleteBtn {
  font-size: 0.75rem;
  color: var(--color-danger, #dc2626);
  background: none;
  border: none;
  cursor: pointer;
  margin-left: auto;
}

.commentText {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.textarea {
  padding: 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
  font-size: 0.9rem;
  resize: vertical;
  font-family: inherit;
  outline: none;
}

.textarea:focus {
  border-color: var(--color-primary, #2563eb);
}

.submitBtn {
  align-self: flex-end;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  border: none;
  background: var(--color-primary, #2563eb);
  color: #fff;
  cursor: pointer;
}

.submitBtn:disabled {
  opacity: 0.5;
}
```

- [ ] **Step 9: Create FileUpload component**

```jsx
// frontend/src/components/board/FileUpload.jsx
import { useRef } from "react";
import styles from "./FileUpload.module.css";

export default function FileUpload({ accept, files, onChange }) {
  const inputRef = useRef();

  const handleAdd = (e) => {
    const newFiles = Array.from(e.target.files);
    onChange([...files, ...newFiles]);
    e.target.value = "";
  };

  const handleRemove = (idx) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className={styles.upload}>
      <button
        type="button"
        onClick={() => inputRef.current.click()}
        className={styles.addBtn}
      >
        파일 추가
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        onChange={handleAdd}
        className={styles.hidden}
      />
      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((f, i) => (
            <li key={i} className={styles.fileItem}>
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.fileSize}>
                {(f.size / 1024).toFixed(0)}KB
              </span>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className={styles.removeBtn}
              >
                X
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 10: Create FileUpload.module.css**

```css
/* frontend/src/components/board/FileUpload.module.css */
.upload {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.addBtn {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  border: 1px dashed var(--color-border, #ccc);
  border-radius: 6px;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #555);
  transition: border-color 0.15s;
}

.addBtn:hover {
  border-color: var(--color-primary, #2563eb);
  color: var(--color-primary, #2563eb);
}

.hidden {
  display: none;
}

.fileList {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fileItem {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: var(--color-bg-subtle, #fafafa);
  border-radius: 4px;
  font-size: 0.85rem;
}

.fileName {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fileSize {
  color: var(--color-text-tertiary, #999);
  font-size: 0.8rem;
}

.removeBtn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-danger, #dc2626);
  font-size: 0.8rem;
  font-weight: 600;
}
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/board/
git commit -m "feat: add board components (PostList, PostDetail, PostForm, CommentSection, FileUpload)"
```

---

## Task 11: Frontend Public Pages

**Files:**
- Rewrite: `frontend/src/pages/HomePage.jsx` + `HomePage.module.css`
- Create: `frontend/src/pages/AboutPage.jsx` + `AboutPage.module.css`
- Create: `frontend/src/pages/ServicesPage.jsx` + `ServicesPage.module.css`

- [ ] **Step 1: Rewrite HomePage**

```jsx
// frontend/src/pages/HomePage.jsx
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
      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>TwinverseAI</h1>
        <p className={styles.heroSub}>
          차세대 AI 솔루션으로 비즈니스를 혁신하세요
        </p>
        <div className={styles.heroCta}>
          <Link to="/services" className={styles.primaryBtn}>
            서비스 알아보기
          </Link>
          <Link to="/about" className={styles.secondaryBtn}>
            회사 소개
          </Link>
        </div>
      </section>

      {/* Notices */}
      {notices.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>공지사항</h2>
            <Link to="/community/notice" className={styles.moreLink}>
              더보기
            </Link>
          </div>
          <ul className={styles.noticeList}>
            {notices.map((n) => (
              <li key={n.id}>
                <Link to={`/community/notice/${n.id}`} className={styles.noticeItem}>
                  <span className={styles.noticeTitle}>{n.title}</span>
                  <span className={styles.noticeDate}>
                    {new Date(n.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>최신 Q&A</h2>
            <Link to="/community/qna" className={styles.moreLink}>
              더보기
            </Link>
          </div>
          <ul className={styles.postList}>
            {recentPosts.map((p) => (
              <li key={p.id}>
                <Link to={`/community/qna/${p.id}`} className={styles.postItem}>
                  <span>{p.title}</span>
                  <span className={styles.postMeta}>
                    {p.author} | {new Date(p.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Service Summary */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>서비스</h2>
        <div className={styles.serviceGrid}>
          <div className={styles.serviceCard}>
            <h3>AI 컨설팅</h3>
            <p>비즈니스에 최적화된 AI 전략을 수립합니다</p>
          </div>
          <div className={styles.serviceCard}>
            <h3>커스텀 AI 개발</h3>
            <p>맞춤형 AI 모델과 솔루션을 개발합니다</p>
          </div>
          <div className={styles.serviceCard}>
            <h3>AI 교육</h3>
            <p>팀의 AI 역량을 강화하는 교육 프로그램</p>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite HomePage.module.css**

```css
/* frontend/src/pages/HomePage.module.css */
.home {
  max-width: 900px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: 4rem 0 3rem;
}

.heroTitle {
  font-size: 2.5rem;
  font-weight: 800;
  margin: 0 0 0.75rem;
}

.heroSub {
  font-size: 1.1rem;
  color: var(--color-text-secondary, #555);
  margin: 0 0 2rem;
}

.heroCta {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.primaryBtn {
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  background: var(--color-primary, #2563eb);
  color: #fff;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
}

.secondaryBtn {
  padding: 0.7rem 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--color-border, #ddd);
  color: var(--color-text, #111);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
}

.section {
  margin-bottom: 2.5rem;
}

.sectionHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.sectionTitle {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.moreLink {
  font-size: 0.85rem;
  color: var(--color-primary, #2563eb);
  text-decoration: none;
}

.noticeList,
.postList {
  list-style: none;
  padding: 0;
  margin: 0;
}

.noticeItem,
.postItem {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
  text-decoration: none;
  color: var(--color-text, #111);
}

.noticeItem:hover,
.postItem:hover {
  color: var(--color-primary, #2563eb);
}

.noticeTitle {
  font-weight: 500;
}

.noticeDate,
.postMeta {
  font-size: 0.8rem;
  color: var(--color-text-tertiary, #999);
}

.serviceGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.serviceCard {
  padding: 1.5rem;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 8px;
}

.serviceCard h3 {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.serviceCard p {
  font-size: 0.9rem;
  color: var(--color-text-secondary, #555);
  margin: 0;
}
```

- [ ] **Step 3: Create AboutPage**

```jsx
// frontend/src/pages/AboutPage.jsx
import styles from "./AboutPage.module.css";

export default function AboutPage() {
  return (
    <div className={styles.about}>
      <h1 className={styles.title}>회사소개</h1>

      <section className={styles.section}>
        <h2>비전</h2>
        <p>
          TwinverseAI는 인공지능 기술을 통해 기업과 개인의 디지털 전환을 가속화하는
          것을 목표로 합니다. 모든 사람이 AI의 혜택을 누릴 수 있는 세상을 만들어갑니다.
        </p>
      </section>

      <section className={styles.section}>
        <h2>미션</h2>
        <p>
          복잡한 AI 기술을 누구나 쉽게 활용할 수 있도록 직관적인 솔루션을 제공합니다.
          고객의 비즈니스 문제를 AI로 해결하여 실질적인 가치를 창출합니다.
        </p>
      </section>

      <section className={styles.section}>
        <h2>팀</h2>
        <p>
          AI 연구, 소프트웨어 엔지니어링, 비즈니스 전략 분야의 전문가들로 구성된
          팀이 최고의 솔루션을 제공합니다.
        </p>
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

- [ ] **Step 4: Create AboutPage.module.css**

```css
/* frontend/src/pages/AboutPage.module.css */
.about {
  max-width: 700px;
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 2rem;
}

.section {
  margin-bottom: 2rem;
}

.section h2 {
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
}

.section p {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--color-text-secondary, #444);
  margin: 0;
}

.timeline {
  list-style: none;
  padding: 0;
  margin: 0;
}

.timeline li {
  padding: 0.5rem 0;
  font-size: 0.95rem;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}
```

- [ ] **Step 5: Create ServicesPage**

```jsx
// frontend/src/pages/ServicesPage.jsx
import styles from "./ServicesPage.module.css";

const SERVICES = [
  {
    title: "AI 컨설팅",
    desc: "비즈니스 목표에 맞는 AI 도입 전략 수립부터 실행까지 전 과정을 지원합니다.",
    features: ["현황 분석", "ROI 예측", "실행 로드맵"],
  },
  {
    title: "커스텀 AI 개발",
    desc: "고객 데이터와 요구사항에 최적화된 AI 모델 및 애플리케이션을 개발합니다.",
    features: ["자연어 처리", "컴퓨터 비전", "예측 분석"],
  },
  {
    title: "AI 교육",
    desc: "조직의 AI 역량을 강화하는 맞춤형 교육 프로그램을 운영합니다.",
    features: ["워크숍", "핸즈온 실습", "온라인 과정"],
  },
  {
    title: "AI 인프라 구축",
    desc: "확장 가능하고 안정적인 AI 인프라를 설계하고 구축합니다.",
    features: ["클라우드 아키텍처", "MLOps 파이프라인", "모니터링"],
  },
];

export default function ServicesPage() {
  return (
    <div className={styles.services}>
      <h1 className={styles.title}>서비스</h1>
      <p className={styles.intro}>
        TwinverseAI는 AI 전략 수립부터 개발, 교육, 인프라까지 원스톱 솔루션을 제공합니다.
      </p>

      <div className={styles.grid}>
        {SERVICES.map((s) => (
          <div key={s.title} className={styles.card}>
            <h2 className={styles.cardTitle}>{s.title}</h2>
            <p className={styles.cardDesc}>{s.desc}</p>
            <ul className={styles.features}>
              {s.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create ServicesPage.module.css**

```css
/* frontend/src/pages/ServicesPage.module.css */
.services {
  max-width: 900px;
}

.title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
}

.intro {
  font-size: 1rem;
  color: var(--color-text-secondary, #555);
  margin: 0 0 2rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.card {
  padding: 1.5rem;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 8px;
}

.cardTitle {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.cardDesc {
  font-size: 0.9rem;
  color: var(--color-text-secondary, #555);
  margin: 0 0 1rem;
  line-height: 1.6;
}

.features {
  padding-left: 1.25rem;
  margin: 0;
}

.features li {
  font-size: 0.85rem;
  padding: 0.15rem 0;
  color: var(--color-text-secondary, #555);
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/HomePage.jsx frontend/src/pages/HomePage.module.css frontend/src/pages/AboutPage.jsx frontend/src/pages/AboutPage.module.css frontend/src/pages/ServicesPage.jsx frontend/src/pages/ServicesPage.module.css
git commit -m "feat: add public pages (HomePage, AboutPage, ServicesPage)"
```

---

## Task 12: Frontend Community Pages

**Files:**
- Create: `frontend/src/pages/community/BoardPage.jsx` + CSS
- Create: `frontend/src/pages/community/PostPage.jsx` + CSS

- [ ] **Step 1: Create BoardPage (universal board listing)**

```jsx
// frontend/src/pages/community/BoardPage.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import PostList from "../../components/board/PostList";
import styles from "./BoardPage.module.css";

const BOARD_LABELS = {
  notice: "공지사항",
  qna: "Q&A",
  gallery: "이미지 갤러리",
  videos: "동영상",
};

// URL path to API board_type mapping
const BOARD_TYPE_MAP = {
  notice: "notice",
  qna: "qna",
  gallery: "gallery",
  videos: "video",
};

export default function BoardPage() {
  const { boardType } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const [data, setData] = useState({ items: [], total: 0, page: 1, size: 20 });
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const apiType = BOARD_TYPE_MAP[boardType] || boardType;
  const label = BOARD_LABELS[boardType] || boardType;

  const canWrite =
    token &&
    (boardType !== "notice" || user?.role === "admin" || user?.role === "superadmin");

  useEffect(() => {
    setLoading(true);
    api
      .get(`/api/boards/${apiType}?page=${page}&size=20`)
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiType, page]);

  const totalPages = Math.ceil(data.total / data.size);

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <h1 className={styles.title}>{label}</h1>
        {canWrite && (
          <button
            onClick={() => navigate(`/community/${boardType}/new`)}
            className={styles.writeBtn}
          >
            글쓰기
          </button>
        )}
      </div>

      {loading ? (
        <p className={styles.loading}>로딩 중...</p>
      ) : data.items.length === 0 ? (
        <p className={styles.empty}>게시물이 없습니다.</p>
      ) : (
        <PostList
          posts={data.items}
          boardType={apiType}
          basePath={`/community/${boardType}`}
        />
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`${styles.pageBtn} ${p === page ? styles.pageActive : ""}`}
              onClick={() => setSearchParams({ page: p.toString() })}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create BoardPage.module.css**

```css
/* frontend/src/pages/community/BoardPage.module.css */
.board {
  max-width: 900px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.writeBtn {
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  border: none;
  background: var(--color-primary, #2563eb);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
}

.writeBtn:hover {
  opacity: 0.9;
}

.loading,
.empty {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-tertiary, #999);
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 2rem;
}

.pageBtn {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
}

.pageActive {
  background: var(--color-primary, #2563eb);
  color: #fff;
  border-color: var(--color-primary, #2563eb);
}
```

- [ ] **Step 3: Create PostPage (detail/create/edit)**

```jsx
// frontend/src/pages/community/PostPage.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import PostDetail from "../../components/board/PostDetail";
import PostForm from "../../components/board/PostForm";
import CommentSection from "../../components/board/CommentSection";
import styles from "./PostPage.module.css";

const BOARD_TYPE_MAP = {
  notice: "notice",
  qna: "qna",
  gallery: "gallery",
  videos: "video",
};

export default function PostPage() {
  const { boardType, postId } = useParams();
  const navigate = useNavigate();
  const apiType = BOARD_TYPE_MAP[boardType] || boardType;
  const isNew = postId === "new";
  const isEdit = postId === "edit";
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);

  // For edit mode, we need the actual post ID from the URL path
  // URL pattern: /community/:boardType/:postId or /community/:boardType/:postId/edit
  // This component handles: /community/:boardType/new and /community/:boardType/:postId

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .get(`/api/boards/${apiType}/${postId}`)
      .then((r) => setPost(r.data))
      .catch(() => navigate(`/community/${boardType}`))
      .finally(() => setLoading(false));
  }, [apiType, postId]);

  const handleCreate = async (data, files) => {
    setSubmitting(true);
    try {
      const res = await api.post(`/api/boards/${apiType}`, data);
      const newPostId = res.data.id;

      // Upload files
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        await api.post(`/api/files/upload?post_id=${newPostId}`, formData);
      }

      navigate(`/community/${boardType}/${newPostId}`);
    } catch (err) {
      alert(err.response?.data?.detail || "작성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (data) => {
    setSubmitting(true);
    try {
      await api.put(`/api/boards/${apiType}/${postId}`, data);
      navigate(`/community/${boardType}/${postId}`);
    } catch (err) {
      alert(err.response?.data?.detail || "수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/api/boards/${apiType}/${postId}`);
      navigate(`/community/${boardType}`);
    } catch {
      alert("삭제에 실패했습니다.");
    }
  };

  if (loading) return <p className={styles.loading}>로딩 중...</p>;

  // New post form
  if (isNew) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>새 글 작성</h1>
        <PostForm
          boardType={apiType}
          onSubmit={handleCreate}
          loading={submitting}
        />
      </div>
    );
  }

  if (!post) return null;

  // Edit form (accessed via query or dedicated route)
  const isEditing = window.location.pathname.endsWith("/edit");
  if (isEditing) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>글 수정</h1>
        <PostForm
          boardType={apiType}
          initial={post}
          onSubmit={(data) => handleUpdate(data)}
          loading={submitting}
        />
      </div>
    );
  }

  // Detail view
  const canEdit =
    user &&
    (post.author_id === user.id || user.role === "admin" || user.role === "superadmin");

  return (
    <div className={styles.page}>
      <button
        onClick={() => navigate(`/community/${boardType}`)}
        className={styles.backBtn}
      >
        목록으로
      </button>
      <PostDetail post={post} canEdit={canEdit} onDelete={handleDelete} />
      <CommentSection postId={post.id} />
    </div>
  );
}
```

- [ ] **Step 4: Create PostPage.module.css**

```css
/* frontend/src/pages/community/PostPage.module.css */
.page {
  max-width: 800px;
}

.pageTitle {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-tertiary, #999);
}

.backBtn {
  display: inline-block;
  margin-bottom: 1.25rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
  background: none;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #555);
  cursor: pointer;
  text-decoration: none;
}

.backBtn:hover {
  background: var(--color-bg-hover, #f5f5f5);
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/community/
git commit -m "feat: add community pages (BoardPage, PostPage)"
```

---

## Task 13: Frontend Admin Pages

**Files:**
- Create: `frontend/src/pages/admin/AdminDashboard.jsx` + CSS
- Create: `frontend/src/pages/admin/AdminUsers.jsx` + CSS
- Create: `frontend/src/pages/admin/AdminBoards.jsx` + CSS
- Move: existing pages to admin/ (AdminDocs, AdminSkills, AdminPlugins)

- [ ] **Step 1: Create AdminDashboard**

```jsx
// frontend/src/pages/admin/AdminDashboard.jsx
import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./AdminDashboard.module.css";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/api/admin/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) return <p>로딩 중...</p>;

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>관리자 대시보드</h1>
      <div className={styles.grid}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.total_users}</span>
          <span className={styles.statLabel}>전체 사용자</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.active_users}</span>
          <span className={styles.statLabel}>활성 사용자</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.total_posts}</span>
          <span className={styles.statLabel}>전체 게시물</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.total_comments}</span>
          <span className={styles.statLabel}>전체 댓글</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AdminDashboard.module.css**

```css
/* frontend/src/pages/admin/AdminDashboard.module.css */
.dashboard {
  max-width: 800px;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.stat {
  padding: 1.25rem;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 8px;
  text-align: center;
}

.statValue {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.statLabel {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #666);
}
```

- [ ] **Step 3: Create AdminUsers**

```jsx
// frontend/src/pages/admin/AdminUsers.jsx
import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./AdminUsers.module.css";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  const loadUsers = () => {
    api.get("/api/admin/users").then((r) => setUsers(r.data)).catch(() => {});
  };

  useEffect(loadUsers, []);

  const changeRole = async (userId, role) => {
    try {
      await api.put(`/api/admin/users/${userId}/role`, { role });
      loadUsers();
    } catch (err) {
      alert(err.response?.data?.detail || "역할 변경 실패");
    }
  };

  const toggleActive = async (userId, isActive) => {
    try {
      await api.put(`/api/admin/users/${userId}/active`, { is_active: !isActive });
      loadUsers();
    } catch {
      alert("상태 변경 실패");
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>사용자 관리</h1>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>사용자명</th>
            <th>이메일</th>
            <th>역할</th>
            <th>상태</th>
            <th>가입일</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  className={styles.select}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </td>
              <td>
                <span className={u.is_active ? styles.active : styles.inactive}>
                  {u.is_active ? "활성" : "비활성"}
                </span>
              </td>
              <td>{new Date(u.created_at).toLocaleDateString("ko-KR")}</td>
              <td>
                <button
                  onClick={() => toggleActive(u.id, u.is_active)}
                  className={styles.toggleBtn}
                >
                  {u.is_active ? "비활성화" : "활성화"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create AdminUsers.module.css**

```css
/* frontend/src/pages/admin/AdminUsers.module.css */
.page {
  max-width: 1000px;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #e5e5e5);
  font-size: 0.85rem;
}

.table th {
  font-weight: 600;
  color: var(--color-text-tertiary, #999);
  font-size: 0.8rem;
}

.select {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  font-size: 0.8rem;
}

.active {
  color: var(--color-success, #16a34a);
  font-weight: 500;
}

.inactive {
  color: var(--color-danger, #dc2626);
  font-weight: 500;
}

.toggleBtn {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  background: none;
  cursor: pointer;
  font-size: 0.8rem;
}

.toggleBtn:hover {
  background: var(--color-bg-hover, #f5f5f5);
}
```

- [ ] **Step 5: Create AdminBoards**

```jsx
// frontend/src/pages/admin/AdminBoards.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import styles from "./AdminBoards.module.css";

const BOARD_PATH_MAP = {
  notice: "notice",
  qna: "qna",
  gallery: "gallery",
  video: "videos",
};

export default function AdminBoards() {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], total: 0, page: 1, size: 20 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    api
      .get(`/api/admin/posts?page=${page}&size=20`)
      .then((r) => setData(r.data))
      .catch(() => {});
  }, [page]);

  const handleDelete = async (postId, boardType) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/api/boards/${boardType}/${postId}`);
      // Reload
      api.get(`/api/admin/posts?page=${page}&size=20`).then((r) => setData(r.data));
    } catch {
      alert("삭제 실패");
    }
  };

  const totalPages = Math.ceil(data.total / data.size);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>게시판 관리</h1>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>ID</th>
            <th>게시판</th>
            <th>제목</th>
            <th>작성자</th>
            <th>조회</th>
            <th>날짜</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.board_type}</td>
              <td>
                <a
                  href={`/community/${BOARD_PATH_MAP[p.board_type] || p.board_type}/${p.id}`}
                  className={styles.link}
                >
                  {p.title}
                </a>
              </td>
              <td>{p.author}</td>
              <td>{p.view_count}</td>
              <td>{new Date(p.created_at).toLocaleDateString("ko-KR")}</td>
              <td>
                <button
                  onClick={() => handleDelete(p.id, p.board_type)}
                  className={styles.deleteBtn}
                >
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={`${styles.pageBtn} ${p === page ? styles.pageActive : ""}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create AdminBoards.module.css**

```css
/* frontend/src/pages/admin/AdminBoards.module.css */
.page {
  max-width: 1000px;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: 0.6rem 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border, #e5e5e5);
  font-size: 0.85rem;
}

.table th {
  font-weight: 600;
  color: var(--color-text-tertiary, #999);
  font-size: 0.8rem;
}

.link {
  color: var(--color-text, #111);
  text-decoration: none;
}

.link:hover {
  color: var(--color-primary, #2563eb);
}

.deleteBtn {
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--color-danger, #dc2626);
  border-radius: 4px;
  background: none;
  color: var(--color-danger, #dc2626);
  cursor: pointer;
  font-size: 0.8rem;
}

.deleteBtn:hover {
  background: #fef2f2;
}

.pagination {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 1.5rem;
}

.pageBtn {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 4px;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
}

.pageActive {
  background: var(--color-primary, #2563eb);
  color: #fff;
  border-color: var(--color-primary, #2563eb);
}
```

- [ ] **Step 7: Create AdminDocs (move from DocViewerPage)**

Copy `frontend/src/pages/DocViewerPage.jsx` to `frontend/src/pages/admin/AdminDocs.jsx` with updated import paths:

```jsx
// frontend/src/pages/admin/AdminDocs.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../../services/api";
import styles from "./AdminDocs.module.css";

export default function AdminDocs() {
  const { docKey } = useParams();
  const [docs, setDocs] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/api/docs/list").then((r) => setDocs(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!docKey) return;
    setLoading(true);
    api
      .get(`/api/docs/${docKey}`)
      .then((r) => setContent(r.data.content))
      .catch(() => setContent("문서를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, [docKey]);

  if (!docKey) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>프로젝트 문서</h1>
        <ul className={styles.list}>
          {docs.map((d) => (
            <li key={d.key}>
              <Link to={`/admin/docs/${d.key}`} className={styles.docLink}>
                {d.filename}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/admin/docs" className={styles.backLink}>
        문서 목록
      </Link>
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <div className={styles.content}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create AdminDocs.module.css**

```css
/* frontend/src/pages/admin/AdminDocs.module.css */
.page {
  max-width: 800px;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.list {
  list-style: none;
  padding: 0;
}

.list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.docLink {
  text-decoration: none;
  color: var(--color-primary, #2563eb);
  font-weight: 500;
}

.backLink {
  display: inline-block;
  margin-bottom: 1rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #666);
  text-decoration: none;
}

.backLink:hover {
  color: var(--color-text, #111);
}

.content {
  line-height: 1.7;
}
```

- [ ] **Step 9: Create AdminSkills (move from SkillsPage)**

Copy `frontend/src/pages/SkillsPage.jsx` to `frontend/src/pages/admin/AdminSkills.jsx` — update the import path for api to `../../services/api`. Keep the same component logic and style.

```jsx
// frontend/src/pages/admin/AdminSkills.jsx
import { useState, useEffect } from "react";
import api from "../../services/api";
import ReactMarkdown from "react-markdown";
import styles from "./AdminSkills.module.css";

export default function AdminSkills() {
  const [skills, setSkills] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/api/skills/list").then((r) => setSkills(r.data)).catch(() => {});
  }, []);

  const handleSelect = async (key) => {
    if (selected === key) {
      setSelected(null);
      setDetail(null);
      return;
    }
    setSelected(key);
    try {
      const res = await api.get(`/api/skills/${key}`);
      setDetail(res.data);
    } catch {
      setDetail(null);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>AI 스킬</h1>
      <ul className={styles.list}>
        {skills.map((s) => (
          <li key={s.key} className={styles.item}>
            <button onClick={() => handleSelect(s.key)} className={styles.skillBtn}>
              <strong>{s.name}</strong>
              <span className={styles.desc}>{s.description}</span>
            </button>
            {selected === s.key && detail && (
              <div className={styles.detail}>
                <ReactMarkdown>{detail.body}</ReactMarkdown>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 10: Create AdminSkills.module.css**

```css
/* frontend/src/pages/admin/AdminSkills.module.css */
.page {
  max-width: 800px;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.list {
  list-style: none;
  padding: 0;
}

.item {
  border-bottom: 1px solid var(--color-border-light, #f0f0f0);
}

.skillBtn {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0.75rem 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.skillBtn strong {
  font-size: 0.95rem;
}

.desc {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #666);
  margin-top: 0.25rem;
}

.detail {
  padding: 1rem;
  background: var(--color-bg-subtle, #fafafa);
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.6;
}
```

- [ ] **Step 11: Create AdminPlugins (move from PluginsPage)**

Copy `frontend/src/pages/PluginsPage.jsx` to `frontend/src/pages/admin/AdminPlugins.jsx` — update the import path for api to `../../services/api`. Keep the same component logic.

```jsx
// frontend/src/pages/admin/AdminPlugins.jsx
import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./AdminPlugins.module.css";

export default function AdminPlugins() {
  const [plugins, setPlugins] = useState([]);

  useEffect(() => {
    api.get("/api/plugins/list").then((r) => setPlugins(r.data)).catch(() => {});
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>플러그인</h1>
      <div className={styles.grid}>
        {plugins.map((p) => (
          <div key={p.key} className={styles.card}>
            <h3 className={styles.cardName}>{p.display_name}</h3>
            <p className={styles.cardDesc}>{p.description}</p>
            <p className={styles.cardUsage}>{p.usage}</p>
            <span
              className={
                p.is_configured ? styles.configured : styles.notConfigured
              }
            >
              {p.is_configured ? "설정 완료" : "설정 필요"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Create AdminPlugins.module.css**

```css
/* frontend/src/pages/admin/AdminPlugins.module.css */
.page {
  max-width: 900px;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1.5rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.card {
  padding: 1.25rem;
  border: 1px solid var(--color-border, #e5e5e5);
  border-radius: 8px;
}

.cardName {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.cardDesc {
  font-size: 0.85rem;
  color: var(--color-text-secondary, #555);
  margin: 0 0 0.5rem;
  line-height: 1.5;
}

.cardUsage {
  font-size: 0.8rem;
  color: var(--color-text-tertiary, #999);
  margin: 0 0 0.75rem;
}

.configured {
  font-size: 0.8rem;
  color: var(--color-success, #16a34a);
  font-weight: 500;
}

.notConfigured {
  font-size: 0.8rem;
  color: var(--color-danger, #dc2626);
  font-weight: 500;
}
```

- [ ] **Step 13: Commit**

```bash
git add frontend/src/pages/admin/
git commit -m "feat: add admin pages (Dashboard, Users, Boards, Docs, Skills, Plugins)"
```

---

## Task 14: Rewrite App.jsx

**Files:**
- Rewrite: `frontend/src/App.jsx`

- [ ] **Step 1: Rewrite App.jsx with new routing structure**

```jsx
// frontend/src/App.jsx
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
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/boards"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminBoards />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/docs"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDocs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/docs/:docKey"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDocs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/skills"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminSkills />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/plugins"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPlugins />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd c:\WORK\TwinverseAI\frontend && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Remove old page files that are no longer needed**

Delete the old top-level files that have been moved to admin:
- `frontend/src/pages/DashboardPage.jsx` + `DashboardPage.module.css`
- `frontend/src/pages/DocViewerPage.jsx` + `DocViewerPage.module.css`
- `frontend/src/pages/SkillsPage.jsx` + `SkillsPage.module.css`
- `frontend/src/pages/PluginsPage.jsx` + `PluginsPage.module.css`

```bash
git rm frontend/src/pages/DashboardPage.jsx frontend/src/pages/DashboardPage.module.css
git rm frontend/src/pages/DocViewerPage.jsx frontend/src/pages/DocViewerPage.module.css
git rm frontend/src/pages/SkillsPage.jsx frontend/src/pages/SkillsPage.module.css
git rm frontend/src/pages/PluginsPage.jsx frontend/src/pages/PluginsPage.module.css
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: rewrite App.jsx with portal layout and new routing structure"
```

---

## Task 15: Apply Frontend Design

**Files:**
- All frontend CSS files

- [ ] **Step 1: Apply /frontend-design skill**

Invoke the `frontend-design` skill to redesign all pages with a distinctive, production-grade aesthetic. This replaces the placeholder CSS with a cohesive design system.

The frontend-design skill should be applied to:
- `frontend/src/styles/global.css` — base design system
- All `.module.css` files created in this plan

- [ ] **Step 2: Verify and commit**

Run: `cd c:\WORK\TwinverseAI\frontend && npm run build`
Expected: Build succeeds

```bash
git add -A
git commit -m "style: apply frontend design to all portal pages"
```

---

## Task 16: Integration Test & Deploy

- [ ] **Step 1: Local test**

Start both servers and verify:
1. Homepage loads with hero + notice/Q&A sections
2. Navigation works (Home, About, Services, Community)
3. Sidebar appears on Community and Admin pages
4. Login/register works
5. Board CRUD works (create, view, edit, delete posts)
6. Comments work
7. File upload works on gallery board
8. Admin dashboard shows stats
9. Admin user management works

- [ ] **Step 2: Build and commit final state**

```bash
cd c:\WORK\TwinverseAI\frontend && npm run build
git add -A
git commit -m "feat: portal redesign complete"
git push origin main
```

- [ ] **Step 3: Deploy to Orbitron**

Trigger deployment on Orbitron. Verify the portal works in production.
