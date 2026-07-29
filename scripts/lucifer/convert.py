#!/usr/bin/env python3
"""Lucifer 미디어 변환 워처.

data/ 아래 파일을 훑어 data/_ai/ 에 AI 가 읽을 수 있는 파생물을 만든다.
원본은 절대 건드리지 않는다. 실패는 _common/_convert-errors.log 에 남긴다.
"""
import sys
import traceback
from datetime import datetime
from pathlib import Path

import converters

LUCIFER = Path("/media/stevenlim/TwinverseFolder/Lucifer")
AI_DIR_NAME = "_ai"
ERROR_LOG = LUCIFER / "_common" / "_convert-errors.log"


def needs_conversion(src: Path, dst: Path) -> bool:
    """목표물이 없거나 원본보다 오래됐으면 변환이 필요하다."""
    if not dst.exists():
        return True
    return src.stat().st_mtime > dst.stat().st_mtime


def target_for(src: Path, data_dir: Path) -> Path | None:
    """원본에 대응하는 _ai/ 목표 경로. 변환 대상이 아니면 None."""
    rel = src.relative_to(data_dir)
    if src.suffix.lower() in converters.DOCUMENT_SUFFIXES:
        return data_dir / AI_DIR_NAME / rel.with_suffix(".pdf")
    return None


def plan_targets(data_dir: Path) -> list[tuple[Path, Path]]:
    """(원본, 목표) 쌍 목록. _ai/ 아래 파일과 변환 불필요한 형식은 제외."""
    pairs = []
    for src in sorted(data_dir.rglob("*")):
        if not src.is_file():
            continue
        if AI_DIR_NAME in src.relative_to(data_dir).parts:
            continue
        dst = target_for(src, data_dir)
        if dst is None:
            continue
        pairs.append((src, dst))
    return pairs


def log_error(src: Path, exc: BaseException) -> None:
    ERROR_LOG.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().astimezone().isoformat(timespec="seconds")
    with ERROR_LOG.open("a", encoding="utf-8") as fh:
        fh.write(f"[{stamp}] {src}\n")
        fh.write(f"  {type(exc).__name__}: {exc}\n")


def convert_one(src: Path, dst: Path) -> None:
    """단일 파일 변환. 형식에 따라 converters 의 함수로 위임."""
    if src.suffix.lower() in converters.DOCUMENT_SUFFIXES:
        converters.convert_document(src, dst.parent)
        return
    raise RuntimeError(f"변환 규칙 없음: {src.suffix}")


def run_once() -> int:
    """등록된 모든 프로젝트의 data/ 를 한 번 훑는다. 변환한 개수를 돌려준다."""
    if not LUCIFER.is_dir():
        print(f"공유 폴더에 접근할 수 없음: {LUCIFER}", file=sys.stderr)
        return 0
    converted = 0
    for project_dir in sorted(LUCIFER.iterdir()):
        if not project_dir.is_dir() or project_dir.name.startswith("_"):
            continue
        data_dir = project_dir / "data"
        if not data_dir.is_dir():
            continue
        for src, dst in plan_targets(data_dir):
            if not needs_conversion(src, dst):
                continue
            try:
                convert_one(src, dst)
                converted += 1
                print(f"변환: {src.name} -> {dst.relative_to(LUCIFER)}")
            except Exception as exc:  # 한 파일 실패가 전체를 멈추면 안 된다
                log_error(src, exc)
                print(f"실패: {src.name} ({exc})", file=sys.stderr)
    return converted


if __name__ == "__main__":
    sys.exit(0 if run_once() >= 0 else 1)
