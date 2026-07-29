"""Lucifer 형식별 변환 함수.

모든 함수는 원본을 읽기만 하고, 실패하면 예외를 던진다.
호출자(convert.py)가 예외를 잡아 에러 로그에 남긴다.

변환 함수의 계약: convert_x(src: Path, dst: Path) -> Path
  - dst 는 만들어야 할 정확한 목적지 경로다 (디렉토리가 아니다).
  - 부모 디렉토리는 함수가 만든다.
  - 성공 시 dst 를 돌려준다.
"""
import subprocess
from pathlib import Path
from typing import Callable

# 문서 -> PDF 변환 대상 확장자
DOCUMENT_SUFFIXES = {".pptx", ".ppt", ".docx", ".doc", ".xlsx", ".xls", ".odt", ".odp", ".ods", ".txt", ".rtf"}

SOFFICE_TIMEOUT_SEC = 180


def convert_document(src: Path, dst: Path) -> Path:
    """LibreOffice 헤드리스로 PDF 를 만든다.

    soffice 는 출력 이름을 스스로 정하므로(<stem>.pdf) 만든 뒤 dst 로 옮긴다.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "soffice", "--headless", "--norestore",
            "--convert-to", "pdf",
            "--outdir", str(dst.parent),
            str(src),
        ],
        capture_output=True,
        text=True,
        timeout=SOFFICE_TIMEOUT_SEC,
    )
    produced = dst.parent / (src.stem + ".pdf")
    if not produced.exists():
        raise RuntimeError(
            f"soffice 가 PDF 를 만들지 못함 (rc={result.returncode}): "
            f"{result.stderr.strip() or result.stdout.strip()}"
        )
    if produced != dst:
        produced.replace(dst)
    return dst


def rule_for(src: Path) -> tuple[str, Callable[[Path, Path], Path]] | None:
    """(목적지에 덧붙일 접미사, 변환 함수). 변환 대상이 아니면 None.

    라우팅을 이 함수 한 곳에만 둔다. target_for 와 convert_one 이 모두 여기를
    거치므로 "경로는 A 로 잡고 변환은 B 로 하는" 어긋남이 생길 수 없다.
    Task 3·4 는 이 함수에만 분기를 추가한다.
    """
    if src.suffix.lower() in DOCUMENT_SUFFIXES:
        return (".pdf", convert_document)
    return None
