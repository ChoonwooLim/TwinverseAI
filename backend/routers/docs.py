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
