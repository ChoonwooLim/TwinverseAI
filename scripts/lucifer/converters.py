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
import re
import shutil
import subprocess
import time
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
OLLAMA_TIMEOUT_SEC = 60
# 영상 한 편이 워처 전체를 붙잡지 못하게 하는 총 예산.
# 프레임 설명이 이 시간을 넘기면 남은 프레임은 설명 없이 기록만 남긴다.
VIDEO_DESCRIBE_BUDGET_SEC = 600

LINKS_FILENAME = "links.md"
YTDLP_TIMEOUT_SEC = 300
# 자막 선호 순서. 앞에 있는 언어를 먼저 고른다.
SUB_LANGS = ["ko", "en"]
# 자막을 못 받은 영상을 5분마다 다시 두드리지 않기 위한 재시도 간격.
FAILED_RETRY_SEC = 24 * 3600

_YOUTUBE_ID_RE = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{11})"
)


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
    # 지난 실행의 프레임을 반드시 비운다. ffmpeg 는 이번에 쓰는 번호만 덮어쓰므로,
    # 장면 수가 줄어든 재변환에서 옛 frame_00N 이 남아 glob 에 섞이고
    # 현재 영상에 없는 장면을 설명하는 문서가 조용히 만들어진다.
    shutil.rmtree(frames_dir, ignore_errors=True)
    frames_dir.mkdir(parents=True, exist_ok=True)

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
    deadline = time.monotonic() + VIDEO_DESCRIBE_BUDGET_SEC
    for i, frame in enumerate(frames, start=1):
        if time.monotonic() >= deadline:
            # 예산 초과. 남은 프레임은 설명 없이 남기고 문서는 그대로 낸다.
            # 영상 하나가 워처 전체를 몇십 분씩 붙잡는 것을 막는다.
            desc = f"(설명 생략: 총 {VIDEO_DESCRIBE_BUDGET_SEC}초 예산 초과)"
        else:
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


def extract_youtube_ids(text: str) -> list[str]:
    """텍스트에서 유튜브 video id 를 등장 순서대로, 중복 없이 뽑는다."""
    seen = []
    for match in _YOUTUBE_ID_RE.finditer(text):
        vid = match.group(1)
        if vid not in seen:
            seen.append(vid)
    return seen


def convert_youtube_links(src: Path, dst: Path) -> Path:
    """links.md 의 유튜브 URL 마다 자막을 받아 마크다운으로 저장한다.

    dst 는 완료 표식(`_ai/links/.done`)이고, 실제 자막은 그 옆에 <id>.md 로 쌓인다.
    """
    dst_dir = dst.parent
    dst_dir.mkdir(parents=True, exist_ok=True)
    ids = extract_youtube_ids(src.read_text(encoding="utf-8", errors="replace"))
    failures = []
    for vid in ids:
        out = dst_dir / f"{vid}.md"
        if out.exists():
            continue
        # 자막이 아예 없는 영상은 흔하다. 5분마다 다시 두드리지 않도록
        # 실패를 기록해 두고 하루가 지나야 재시도한다.
        failed_marker = dst_dir / f"{vid}.failed"
        if failed_marker.exists():
            age = time.time() - failed_marker.stat().st_mtime
            if age < FAILED_RETRY_SEC:
                continue

        result = subprocess.run(
            [
                "yt-dlp",
                "--skip-download",
                "--write-auto-sub", "--write-sub",
                "--sub-lang", ",".join(SUB_LANGS),
                "--sub-format", "vtt",
                "--convert-subs", "srt",
                "-o", str(dst_dir / f"{vid}.%(ext)s"),
                f"https://www.youtube.com/watch?v={vid}",
            ],
            capture_output=True, text=True, timeout=YTDLP_TIMEOUT_SEC,
        )

        # 선호 순서대로 고른다. sorted() 에 맡기면 사전순이라 'en' 이 'ko' 를
        # 항상 이겨서, ko 를 우선 요청해놓고 en 을 쓰는 일이 벌어진다.
        chosen, chosen_lang = None, None
        for lang in SUB_LANGS:
            cand = dst_dir / f"{vid}.{lang}.srt"
            if cand.exists():
                chosen, chosen_lang = cand, lang
                break
        if chosen is None:
            other = sorted(dst_dir.glob(f"{vid}*.srt"))
            if other:
                chosen, chosen_lang = other[0], "unknown"

        # yt-dlp 가 남긴 중간 산출물(.vtt/.srt)을 모두 치운다.
        def _cleanup() -> None:
            for leftover in list(dst_dir.glob(f"{vid}*.srt")) + list(dst_dir.glob(f"{vid}*.vtt")):
                leftover.unlink(missing_ok=True)

        if chosen is None:
            failed_marker.write_text(
                f"자막 없음 (rc={result.returncode})\n", encoding="utf-8"
            )
            failures.append(f"{vid}: 자막 없음 (rc={result.returncode})")
            _cleanup()
            continue

        body = chosen.read_text(encoding="utf-8", errors="replace")
        out.write_text(
            f"# https://youtu.be/{vid}\n\n자막 언어: {chosen_lang}\n\n```\n{body}\n```\n",
            encoding="utf-8",
        )
        _cleanup()
        failed_marker.unlink(missing_ok=True)

    if failures:
        # 완료 표식을 쓰지 않는다. dst 를 쓰면 needs_conversion 이 이후 실행을
        # 전부 건너뛰어, 나중에 자동 자막이 생겨도 영원히 재시도되지 않는다.
        # 형제 변환기(문서·영상)도 성공할 때만 목적지를 쓴다.
        raise RuntimeError("; ".join(failures))

    dst.write_text(f"processed {len(ids)} links\n", encoding="utf-8")
    return dst


def rule_for(src: Path) -> tuple[str, Callable[[Path, Path], Path]] | None:
    """(목적지에 덧붙일 접미사, 변환 함수). 변환 대상이 아니면 None.

    라우팅을 이 함수 한 곳에만 둔다. target_for 와 convert_one 이 모두 여기를
    거치므로 "경로는 A 로 잡고 변환은 B 로 하는" 어긋남이 생길 수 없다.
    Task 3·4 는 이 함수에만 분기를 추가한다.
    """
    if src.name == LINKS_FILENAME:
        return ("", convert_youtube_links)
    if src.suffix.lower() in DOCUMENT_SUFFIXES:
        return (".pdf", convert_document)
    if src.suffix.lower() in VIDEO_SUFFIXES:
        return (".md", convert_video)
    return None
