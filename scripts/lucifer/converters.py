"""Lucifer 형식별 변환 함수.

모든 함수는 원본을 읽기만 하고, 실패하면 예외를 던진다.
호출자(convert.py)가 예외를 잡아 에러 로그에 남긴다.

변환 함수의 계약: convert_x(src: Path, dst: Path) -> Path
  - dst 는 만들어야 할 정확한 목적지 경로다 (디렉토리가 아니다).
  - 부모 디렉토리는 함수가 만든다.
  - 성공 시 dst 를 돌려준다.
"""
import base64
import json
import os
import subprocess
import urllib.request
from pathlib import Path
from typing import Callable

# 문서 -> PDF 변환 대상 확장자
DOCUMENT_SUFFIXES = {".pptx", ".ppt", ".docx", ".doc", ".xlsx", ".xls", ".odt", ".odp", ".ods", ".txt", ".rtf"}

SOFFICE_TIMEOUT_SEC = 180

VIDEO_SUFFIXES = {".mp4", ".mov", ".mkv", ".avi", ".webm"}

MAX_FRAMES = 20
SCENE_THRESHOLD = 0.3
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
VISION_MODEL = os.environ.get("LUCIFER_VISION_MODEL", "qwen2.5vl:7b")
FFMPEG_TIMEOUT_SEC = 600
OLLAMA_TIMEOUT_SEC = 180


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


def _describe_image(path: Path) -> str:
    """로컬 Ollama 비전 모델로 이미지 한 장을 설명한다."""
    payload = json.dumps({
        "model": VISION_MODEL,
        "prompt": "이 이미지를 한국어로 2~3문장으로 설명해줘. 화면에 보이는 텍스트가 있으면 그대로 옮겨줘.",
        "images": [base64.b64encode(path.read_bytes()).decode("ascii")],
        "stream": False,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT_SEC) as resp:
        return json.loads(resp.read()).get("response", "").strip()


def convert_video(src: Path, dst: Path) -> Path:
    """장면 전환 프레임을 뽑고 각 프레임을 설명한 마크다운을 만든다."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    frames_dir = dst.parent / f"{src.name}.frames"
    frames_dir.mkdir(exist_ok=True)

    # 장면 전환 기준으로만 추출하고 개수를 제한한다.
    result = subprocess.run(
        [
            "ffmpeg", "-nostdin", "-y", "-i", str(src),
            "-vf", f"select='gt(scene,{SCENE_THRESHOLD})'",
            "-vsync", "vfr",
            "-frames:v", str(MAX_FRAMES),
            str(frames_dir / "frame_%03d.jpg"),
        ],
        capture_output=True, text=True, timeout=FFMPEG_TIMEOUT_SEC,
    )
    frames = sorted(frames_dir.glob("frame_*.jpg"))
    if not frames:
        raise RuntimeError(
            f"ffmpeg 가 프레임을 뽑지 못함 (rc={result.returncode}): "
            f"{result.stderr.strip()[-300:]}"
        )

    lines = [f"# {src.name}", "", f"장면 전환 프레임 {len(frames)}장 (최대 {MAX_FRAMES}장).", ""]
    for i, frame in enumerate(frames, start=1):
        try:
            desc = _describe_image(frame)
        except Exception as exc:
            desc = f"(설명 실패: {type(exc).__name__}: {exc})"
        lines.append(f"## 프레임 {i} — `{frame.name}`")
        lines.append("")
        lines.append(desc)
        lines.append("")

    dst.write_text("\n".join(lines), encoding="utf-8")
    return dst


def rule_for(src: Path) -> tuple[str, Callable[[Path, Path], Path]] | None:
    """(목적지에 덧붙일 접미사, 변환 함수). 변환 대상이 아니면 None.

    라우팅을 이 함수 한 곳에만 둔다. target_for 와 convert_one 이 모두 여기를
    거치므로 "경로는 A 로 잡고 변환은 B 로 하는" 어긋남이 생길 수 없다.
    Task 3·4 는 이 함수에만 분기를 추가한다.
    """
    if src.suffix.lower() in DOCUMENT_SUFFIXES:
        return (".pdf", convert_document)
    if src.suffix.lower() in VIDEO_SUFFIXES:
        return (".md", convert_video)
    return None
