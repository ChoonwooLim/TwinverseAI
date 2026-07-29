#!/usr/bin/env python3
"""Lucifer 미디어 변환 워처.

data/ 아래 파일을 훑어 data/_ai/ 에 AI 가 읽을 수 있는 파생물을 만든다.
원본은 절대 건드리지 않는다. 실패는 _common/_convert-errors.log 에 남긴다.
"""
import sys
from datetime import datetime
from pathlib import Path

import converters

LUCIFER = Path("/media/stevenlim/TwinverseFolder/Lucifer")
AI_DIR_NAME = "_ai"
ERROR_LOG = LUCIFER / "_common" / "_convert-errors.log"


def needs_conversion(src: Path, dst: Path) -> bool:
    """목표물이 없거나 원본이 더 새로우면 변환한다.

    >= 를 쓰는 이유: CIFS 는 타임스탬프를 초 단위로 자를 수 있다. 같은 초 안에
    편집이 일어나면 > 비교로는 변경을 놓쳐 stale 파생물이 남는다. 같을 때 다시
    변환하면 CPU 를 조금 더 쓸 뿐이고, 정확성은 지켜진다.
    """
    if not dst.exists():
        return True
    return src.stat().st_mtime >= dst.stat().st_mtime


def target_for(src: Path, data_dir: Path) -> Path | None:
    """원본에 대응하는 _ai/ 목표 경로. 변환 대상이 아니면 None."""
    rule = converters.rule_for(src)
    if rule is None:
        return None
    out_suffix, _ = rule
    rel = src.relative_to(data_dir)
    # 원본 확장자를 이름에 남긴다: report.pptx -> _ai/report.pptx.pdf
    # 확장자를 갈아끼우면 report.docx 와 report.pptx 가 같은 report.pdf 로
    # 충돌하고, 두 번째 파일이 "이미 최신" 으로 조용히 건너뛰어진다.
    return data_dir / AI_DIR_NAME / rel.with_name(rel.name + out_suffix)


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
    """단일 파일 변환. rule_for 가 고른 함수로 위임한다."""
    rule = converters.rule_for(src)
    if rule is None:
        raise RuntimeError(f"변환 규칙 없음: {src.name}")
    _, convert_fn = rule
    convert_fn(src, dst)


def run_once(root: Path = LUCIFER) -> int:
    """root 아래 모든 프로젝트의 data/ 를 한 번 훑는다. 변환한 개수를 돌려준다.

    사람과 AI 가 동시에 쓰는 공유 폴더라, 순회 도중 파일이 사라지거나 디렉토리
    목록이 실패할 수 있다. 그 실패가 남은 파일 전체를 멈추면 안 되므로 프로젝트
    단위와 파일 단위 양쪽에서 예외를 가둔다.

    root 를 인자로 받는 이유는 테스트에서 임시 디렉토리를 가리키기 위해서다.
    """
    if not root.is_dir():
        print(f"공유 폴더에 접근할 수 없음: {root}", file=sys.stderr)
        return 0
    converted = 0
    for project_dir in sorted(root.iterdir()):
        if not project_dir.is_dir() or project_dir.name.startswith("_"):
            continue
        data_dir = project_dir / "data"
        if not data_dir.is_dir():
            continue
        try:
            pairs = plan_targets(data_dir)
        except OSError as exc:  # 목록 실패가 다른 프로젝트까지 막으면 안 된다
            log_error(data_dir, exc)
            print(f"목록 실패: {data_dir} ({exc})", file=sys.stderr)
            continue
        for src, dst in pairs:
            try:
                # needs_conversion 도 stat() 을 부른다. 파일이 방금 사라졌다면
                # 여기서 던지므로 try 안에 있어야 한다.
                if not needs_conversion(src, dst):
                    continue
                convert_one(src, dst)
                converted += 1
                print(f"변환: {src.name} -> {dst.relative_to(root)}")
            except Exception as exc:  # 한 파일 실패가 전체를 멈추면 안 된다
                log_error(src, exc)
                print(f"실패: {src.name} ({exc})", file=sys.stderr)
    return converted


if __name__ == "__main__":
    run_once()
