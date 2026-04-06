import os
import shutil
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import database
from database import create_db_and_tables
from routers import auth, admin, docs, skills, plugins, boards, comments, files


def _get_uploads_dir() -> Path:
    """업로드 디렉토리 결정: UPLOAD_DIR (Docker) > 프로젝트루트/uploads (로컬)"""
    d = Path(os.getenv("UPLOAD_DIR", ""))
    if not d.is_dir():
        d = Path(__file__).resolve().parent.parent / "uploads"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _copy_gallery_defaults():
    """Docker VOLUME 마운트로 비어있는 uploads에 갤러리 기본 이미지 복사"""
    defaults_dir = Path("/app/gallery-defaults")
    if not defaults_dir.is_dir():
        return
    uploads = _get_uploads_dir()
    for src in defaults_dir.glob("gallery-*.jpg"):
        dst = uploads / src.name
        if not dst.exists():
            shutil.copy2(src, dst)
            print(f"[gallery-defaults] Copied {src.name} → {uploads}")

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


def _seed_gallery_images():
    """갤러리 게시글에 샘플 이미지 파일 레코드 연결 (독립 실행)"""
    from sqlmodel import Session, select
    from models import Post, FileRecord

    image_map = [
        ("gallery-portal-main.jpg", "TwinverseAI 포탈 메인 페이지.jpg"),
        ("gallery-admin-dashboard.jpg", "어드민 대시보드 UI.jpg"),
        ("gallery-desk-plan.jpg", "TwinverseDesk 개발계획.jpg"),
        ("gallery-design-system.jpg", "Dark Glass Neon 디자인 시스템.jpg"),
        ("gallery-skills-page.jpg", "Claude Code AI 스킬 목록.jpg"),
    ]

    uploads_dir = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
    if not uploads_dir.is_dir():
        uploads_dir = Path(__file__).resolve().parent.parent / "uploads"

    try:
        with Session(database.engine) as session:
            gallery_posts = session.exec(
                select(Post).where(Post.board_type == "gallery").order_by(Post.id)
            ).all()

            linked = 0
            for i, post in enumerate(gallery_posts):
                if i >= len(image_map):
                    break
                stored_name, original_name = image_map[i]
                filepath = uploads_dir / stored_name
                file_size = filepath.stat().st_size if filepath.exists() else 0
                if file_size == 0:
                    continue
                existing = session.exec(
                    select(FileRecord).where(FileRecord.post_id == post.id)
                ).first()
                if existing:
                    continue
                record = FileRecord(
                    post_id=post.id,
                    original_name=original_name,
                    stored_path=f"/uploads/{stored_name}",
                    file_type="image",
                    file_size=file_size,
                )
                session.add(record)
                linked += 1
            session.commit()
            print(f"[seed_gallery] Linked {linked} images to gallery posts")
    except Exception as e:
        print(f"[seed_gallery] ERROR: {e}")


def _seed_sample_posts():
    """게시판별 샘플 게시글 생성 (최초 1회)"""
    from sqlmodel import Session, select, func
    from models import Post, User

    with Session(database.engine) as session:
        count = session.exec(select(func.count(Post.id))).one()
        if count > 0:
            return  # 이미 게시글이 있으면 건너뛰기

        admin = session.exec(select(User).where(User.role == "superadmin")).first()
        if not admin:
            return
        aid = admin.id

        posts = [
            # ── 공지사항 ──
            Post(board_type="notice", title="TwinverseAI 포탈 오픈 안내", content="안녕하세요, TwinverseAI 커뮤니티 포탈이 정식 오픈되었습니다.\n\n### 주요 기능\n- AI 컨설팅 & 커스텀 개발 서비스 안내\n- 커뮤니티 게시판 (공지, Q&A, 갤러리, 동영상)\n- 관리자 대시보드\n\n많은 이용 부탁드립니다!", author_id=aid, is_pinned=True),
            Post(board_type="notice", title="TwinverseDesk 개발 착수 공지", content="UE5 기반 가상 오피스 플랫폼 **TwinverseDesk** 개발이 시작되었습니다.\n\n### 목표\n- 동시접속 200+ 지원\n- AI NPC 코드 리뷰어\n- 실시간 협업 환경\n\n개발 현황은 관리자 메뉴 > 프로젝트 문서에서 확인하세요.", author_id=aid, is_pinned=True),
            Post(board_type="notice", title="서비스 이용약관 및 개인정보처리방침 안내", content="TwinverseAI 서비스 이용약관과 개인정보처리방침이 게시되었습니다.\n\n- 이용약관: 서비스 이용 시 준수사항\n- 개인정보처리방침: 수집 항목, 보유기간, 제3자 제공 등\n\n자세한 내용은 하단 링크를 참조해 주세요.", author_id=aid),
            Post(board_type="notice", title="시스템 정기 점검 안내 (매주 수요일 04:00~06:00)", content="서비스 안정성 향상을 위해 매주 수요일 새벽 4시~6시에 정기 점검을 실시합니다.\n\n- 점검 시간: 매주 수 04:00 ~ 06:00 (KST)\n- 영향 범위: 전체 서비스 일시 중단\n- 긴급 점검 시 별도 공지\n\n이용에 참고 부탁드립니다.", author_id=aid),
            Post(board_type="notice", title="Claude Code 기반 AI 개발 환경 소개", content="TwinverseAI는 **Claude Code**를 핵심 개발 도구로 활용합니다.\n\n### 주요 활용\n- `/start`, `/end` 스킬로 세션 자동 관리\n- `/init`으로 새 프로젝트 원클릭 생성\n- 25개 이상의 디자인/코드 품질 스킬\n- 10개 MCP 서버 연동 (GitHub, PostgreSQL, Docker 등)\n\n관리자 > Claude Code 메뉴에서 전체 목록을 확인하세요.", author_id=aid),

            # ── Q&A ──
            Post(board_type="qna", title="JWT 토큰 만료 시 자동 로그아웃 처리 방법은?", content="로그인 후 일정 시간이 지나면 자동으로 로그아웃되는데, 프론트엔드에서 토큰 갱신을 어떻게 처리하는 게 좋을까요?\n\n현재 구조:\n- 401 응답 시 localStorage 토큰 삭제 후 /login 리다이렉트\n- refresh token은 미구현\n\nrefresh token 도입이 필요한가요?", author_id=aid),
            Post(board_type="qna", title="FastAPI + SQLModel에서 마이그레이션 도구 추천", content="현재 `create_db_and_tables()`로 테이블을 생성하고 있는데, 스키마 변경 시 마이그레이션이 안 됩니다.\n\n### 고려 중인 옵션\n1. Alembic (SQLAlchemy 공식)\n2. 수동 ALTER TABLE\n\nSQLModel과 잘 맞는 마이그레이션 도구가 있나요?", author_id=aid),
            Post(board_type="qna", title="React에서 마크다운 테이블이 렌더링 안 될 때", content="ReactMarkdown으로 문서를 렌더링하는데 테이블이 표시되지 않습니다.\n\n```jsx\n<ReactMarkdown>{content}</ReactMarkdown>\n```\n\n### 해결\n`remark-gfm` 플러그인을 설치하면 GFM(GitHub Flavored Markdown) 테이블이 정상 렌더링됩니다.\n\n```bash\nnpm install remark-gfm\n```\n```jsx\n<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>\n```", author_id=aid),
            Post(board_type="qna", title="Docker 멀티스테이지 빌드에서 프론트엔드 환경변수 주입 방법", content="Vite로 빌드할 때 `VITE_API_URL`을 Docker 빌드 시점에 주입해야 하는데, 런타임에 변경이 불가능합니다.\n\n### 현재 방식\n```dockerfile\nENV VITE_API_URL=\"\"\nRUN npm run build\n```\n\n빈 문자열로 설정하면 same-origin 요청이 되어 프록시 없이도 동작합니다.\n\n다른 좋은 방법이 있나요?", author_id=aid),
            Post(board_type="qna", title="Orbitron 배포 시 Dockerfile 자동 생성 주의사항", content="Orbitron 배포 서버에서 자동 생성하는 Dockerfile이 프로젝트 구조를 잘못 파싱하는 문제가 있었습니다.\n\n### 해결책\n**반드시 프로젝트 루트에 직접 작성한 Dockerfile을 포함**하세요.\n\nOrbitron은 Dockerfile이 이미 있으면 자동 생성을 건너뜁니다.\n\n멀티스테이지 빌드(Node → Python)로 작성하는 것을 권장합니다.", author_id=aid),

            # ── 갤러리 ──
            Post(board_type="gallery", title="TwinverseAI 포탈 메인 페이지 스크린샷", content="Dark Glass Neon 디자인 시스템이 적용된 TwinverseAI 포탈의 메인 페이지입니다.\n\n### 디자인 특징\n- 다크 배경 (#0a0e27) + 네온 액센트 (#667eea, #00d4ff)\n- 글래스모피즘: backdrop-filter blur, rgba 반투명 표면\n- Noto Sans KR + Inter 폰트 조합", author_id=aid),
            Post(board_type="gallery", title="어드민 대시보드 UI", content="관리자 대시보드의 통계 카드와 차트 레이아웃입니다.\n\n### 구성\n- 상단: 사용자 수, 게시글 수, 댓글 수, 파일 수 통계 카드\n- 좌측 사이드바: Claude Code / 프로젝트 문서 서브메뉴\n- 카드 호버 시 glow shadow 효과", author_id=aid),
            Post(board_type="gallery", title="TwinverseDesk 개발계획 페이지", content="UE5 기반 가상 오피스 TwinverseDesk의 개발계획 페이지입니다.\n\n### 포함 내용\n- KPI 성능 목표 (6개 지표)\n- 5단계 로드맵 (Phase 1 진행 중)\n- DeskRPG vs TwinverseDesk 비교표 (15항목)\n- 시스템 아키텍처 (7개 레이어)\n- UE5 핵심 기술 (8개)", author_id=aid),
            Post(board_type="gallery", title="사이드바 서브메뉴 구조", content="관리자 사이드바의 메인메뉴 + 서브메뉴 구조입니다.\n\n### 메뉴 구조\n```\n관리자\n  대시보드\n  사용자 관리\n  게시판 관리\n  Claude Code\n    AI 스킬 (25개)\n    플러그인 (14개)\n  프로젝트 문서\n    개발계획\n    버그수정 로그\n    업그레이드 로그\n    작업일지\n```\n\n`children` 패턴으로 구현되어 있습니다.", author_id=aid),
            Post(board_type="gallery", title="Dark Glass Neon 디자인 토큰 팔레트", content="TwinverseAI에 적용된 디자인 시스템의 컬러 팔레트입니다.\n\n| 토큰 | 값 | 용도 |\n|------|------|------|\n| --bg-primary | #0a0e27 | 메인 배경 |\n| --neon-indigo | #667eea | 주요 액센트 |\n| --neon-cyan | #00d4ff | 보조 액센트 |\n| --glass-bg | rgba(255,255,255,0.06) | 글래스 표면 |\n| --border-subtle | rgba(255,255,255,0.06) | 미세 경계선 |", author_id=aid),

            # ── 동영상 ──
            Post(board_type="video", title="TwinverseAI 프로젝트 소개 영상", content="TwinverseAI 플랫폼의 전체 기능을 소개하는 영상입니다.\n\n### 다루는 내용\n- AI 컨설팅 & 커스텀 개발 서비스\n- 커뮤니티 포탈 기능\n- 관리자 도구\n- TwinverseDesk 비전", author_id=aid, video_url="https://www.youtube.com/watch?v=example1"),
            Post(board_type="video", title="Claude Code로 풀스택 프로젝트 10분 만에 만들기", content="/init 스킬을 사용하여 FastAPI + React 풀스택 프로젝트를 자동 생성하는 과정을 보여줍니다.\n\n### 타임라인\n- 0:00 프로젝트 이름 설정\n- 1:30 /init 실행\n- 5:00 자동 생성된 코드 확인\n- 8:00 로컬 실행 및 테스트\n- 9:30 Orbitron 배포", author_id=aid, video_url="https://www.youtube.com/watch?v=example2"),
            Post(board_type="video", title="Dark Glass Neon 디자인 시스템 적용 가이드", content="기존 프로젝트에 Dark Glass Neon 디자인 시스템을 적용하는 방법을 설명합니다.\n\n### 핵심 포인트\n- CSS 변수 기반 디자인 토큰\n- 글래스모피즘 효과 구현\n- 네온 그라디언트 버튼\n- 호버 glow shadow", author_id=aid, video_url="https://www.youtube.com/watch?v=example3"),
            Post(board_type="video", title="TwinverseDesk — UE5 가상 오피스 데모", content="Unreal Engine 5로 개발 중인 TwinverseDesk 가상 오피스의 초기 데모 영상입니다.\n\n### 시연 내용\n- 3D 오피스 환경 탐색\n- AI NPC 상호작용\n- 실시간 멀티유저 접속\n- 채널 채팅 시스템", author_id=aid, video_url="https://www.youtube.com/watch?v=example4"),
            Post(board_type="video", title="MCP 서버 설정 및 활용 튜토리얼", content="Claude Code에서 MCP 서버를 설정하고 활용하는 방법을 단계별로 설명합니다.\n\n### 다루는 MCP 서버\n- Context7: 라이브러리 문서 자동 조회\n- PostgreSQL: DB 직접 쿼리\n- Puppeteer: 브라우저 자동화\n- Docker: 컨테이너 관리", author_id=aid, video_url="https://www.youtube.com/watch?v=example5"),
        ]

        for post in posts:
            session.add(post)
        session.commit()

        print(f"[seed_posts] Created {len(posts)} sample posts")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _copy_gallery_defaults()
    create_db_and_tables()
    _seed_admin()
    _seed_docs()
    _seed_sample_posts()
    _seed_gallery_images()
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
        defaults = Path("/app/gallery-defaults")
        default_files = [f.name for f in defaults.iterdir()] if defaults.is_dir() else []
        return {
            "status": "ok",
            "db": "connected",
            "documents": doc_count,
            "posts": post_count,
            "files": file_count,
            "uploads_dir": str(uploads),
            "uploads_files": upload_files,
            "defaults_dir": str(defaults),
            "defaults_files": default_files,
        }
    except Exception as e:
        return {"status": "error", "db": str(e)}


# Serve uploaded files — 명시적 API 라우트 (StaticFiles mount 대신)
from fastapi.responses import FileResponse

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
