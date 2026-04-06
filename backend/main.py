import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import database
from database import create_db_and_tables
from routers import auth, admin, docs, skills, plugins, boards, comments, files

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

    # docs/ 디렉토리 탐색: /app/docs (Docker) → 프로젝트루트/docs (로컬)
    docs_dir = Path("/app/docs")
    if not docs_dir.exists():
        docs_dir = Path(__file__).resolve().parent.parent / "docs"
    if not docs_dir.exists():
        print("[seed_docs] docs/ directory not found, skipping.")
        return

    with Session(database.engine) as session:
        for key, (title, filename) in DOC_FILES.items():
            filepath = docs_dir / filename
            if not filepath.exists():
                continue
            content = filepath.read_text(encoding="utf-8")
            existing = session.exec(select(Document).where(Document.key == key)).first()
            if existing:
                existing.content = content
                existing.title = title
                session.add(existing)
            else:
                session.add(Document(key=key, title=title, content=content))
        session.commit()
        print(f"[seed_docs] Synced {len(DOC_FILES)} docs from {docs_dir}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    _seed_admin()
    _seed_docs()
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
app.include_router(boards.router, prefix="/api/boards", tags=["boards"])
app.include_router(comments.router, prefix="/api/comments", tags=["comments"])
app.include_router(files.router, prefix="/api/files", tags=["files"])

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve uploaded files
_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

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
