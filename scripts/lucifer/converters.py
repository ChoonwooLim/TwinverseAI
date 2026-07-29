"""Lucifer 형식별 변환 함수.

모든 함수는 원본을 읽기만 하고, 실패하면 예외를 던진다.
호출자(convert.py)가 예외를 잡아 에러 로그에 남긴다.
"""
import subprocess
from pathlib import Path

# 문서 -> PDF 변환 대상 확장자
DOCUMENT_SUFFIXES = {".pptx", ".ppt", ".docx", ".doc", ".xlsx", ".xls", ".odt", ".odp", ".ods", ".txt", ".rtf"}

SOFFICE_TIMEOUT_SEC = 180


def convert_document(src: Path, dst_dir: Path) -> Path:
    """LibreOffice 헤드리스로 PDF 를 만든다. 만들어진 PDF 경로를 돌려준다."""
    dst_dir.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "soffice", "--headless", "--norestore",
            "--convert-to", "pdf",
            "--outdir", str(dst_dir),
            str(src),
        ],
        capture_output=True,
        text=True,
        timeout=SOFFICE_TIMEOUT_SEC,
    )
    produced = dst_dir / (src.stem + ".pdf")
    if not produced.exists():
        raise RuntimeError(
            f"soffice 가 PDF 를 만들지 못함 (rc={result.returncode}): "
            f"{result.stderr.strip() or result.stdout.strip()}"
        )
    return produced
