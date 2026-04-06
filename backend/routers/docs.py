import os
from pathlib import Path
from fastapi import APIRouter, HTTPException

router = APIRouter()

def _find_docs_dir() -> Path:
    """docs/ 디렉토리를 여러 경로에서 탐색"""
    # 1. 환경변수 우선
    env = os.getenv("DOCS_DIR")
    if env and Path(env).exists():
        return Path(env)
    # 2. Docker: /app/docs/
    docker_path = Path("/app/docs")
    if docker_path.exists():
        return docker_path
    # 3. 로컬 개발: 프로젝트 루트/docs/
    local_path = Path(__file__).resolve().parent.parent.parent / "docs"
    if local_path.exists():
        return local_path
    return local_path  # fallback

DOCS_DIR = _find_docs_dir()

DOC_FILES = {
    "dev-plan": "dev-plan.md",
    "bugfix-log": "bugfix-log.md",
    "upgrade-log": "upgrade-log.md",
    "work-log": "work-log.md",
}


print(f"[docs] DOCS_DIR resolved to: {DOCS_DIR} (exists={DOCS_DIR.exists()})")


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
