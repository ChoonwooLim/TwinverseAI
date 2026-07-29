# Lucifer 미디어 변환 파이프라인 구현 계획 (계획 2/4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Lucifer/<프로젝트>/data/` 에 넣은 파일을 AI가 읽을 수 있는 형태로 자동 변환해 `data/_ai/` 에 둔다. PPT·문서는 PDF로, 영상은 장면 프레임 + 설명으로, 유튜브 링크는 자막으로.

**Architecture:** 호스트(twinverse-ai)에서 Python 스크립트가 systemd timer로 주기 실행된다. 원본은 절대 수정하지 않고 파생물만 만든다. 영상 설명은 외부 API 없이 로컬 Ollama `qwen2.5vl:7b` 로 처리한다. 스크립트는 TwinverseAI 저장소에서 관리하고 서버로 배포한다.

**Tech Stack:** Python 3.12, LibreOffice (headless), ffmpeg, yt-dlp, Ollama, systemd

## Global Constraints

- **원본 파일을 절대 수정·이동·삭제하지 않는다.** 변환 실패해도 원본은 그대로 남아야 한다.
- 변환 실패는 조용히 넘기지 않고 `Lucifer/_common/_convert-errors.log` 에 남긴다. 기록 유실을 눈에 보이게 하는 것이 목적이다.
- 영상 프레임은 **장면 전환 기준**으로만 추출하고 **최대 20장**으로 제한한다. 초당 프레임으로 뜨면 디스크와 추론 시간이 폭증한다.
- 외부 API 키를 쓰지 않는다. 이미지·영상 이해는 로컬 Ollama 로만 한다.
- 스크립트는 **호스트에서** 실행된다. 컨테이너 경로 `/shared/` 가 아니라 호스트 경로 `/media/stevenlim/TwinverseFolder/Lucifer/` 를 쓴다.
- 서버 접속: `ssh stevenlim@192.168.219.117` (무암호 sudo 가능)
- 컨테이너를 건드리는 명령이 필요하면 `docker exec -u node`.

## 경로 대응표

| 보는 위치 | 경로 |
|---|---|
| Steven (Windows) | `Z:\Lucifer\` |
| twinverse-ai 호스트 (스크립트 실행 위치) | `/media/stevenlim/TwinverseFolder/Lucifer/` |
| 컨테이너 (지니·로이) | `/shared/` |

## 확인된 환경 (2026-07-29 실측)

| 항목 | 상태 |
|---|---|
| `ffmpeg` / `ffprobe` | 있음 (`/usr/bin/`) |
| `python3` | 3.12, pip 24.0 |
| `libreoffice` | **없음 — 설치 필요** |
| `yt-dlp` | **없음 — 설치 필요** |
| Ollama `qwen2.5vl:7b` | 있음 (`localhost:11434`) |
| 무암호 sudo | 가능 |
| 디스크 여유 | 270GB |

---

## File Structure

| 파일 | 책임 |
|---|---|
| `scripts/lucifer/convert.py` | 변환 디스패처. 파일 순회, 상태 관리, 에러 로깅 |
| `scripts/lucifer/converters.py` | 형식별 변환 함수 (문서/영상/유튜브) |
| `scripts/lucifer/deploy.sh` | 스크립트를 서버로 배포하고 systemd 유닛 설치 |
| `scripts/lucifer/lucifer-convert.service` | systemd 서비스 유닛 |
| `scripts/lucifer/lucifer-convert.timer` | systemd 타이머 유닛 (5분 주기) |

스크립트를 저장소에서 관리하는 이유: 서버에만 두면 리뷰도 이력도 남지 않는다. 배포는 `deploy.sh` 가 담당한다.

---

## Task 1: 변환 도구 설치

**Files:** 없음 (서버 환경 변경)

**Interfaces:**
- Consumes: 없음
- Produces: `libreoffice`, `yt-dlp` 실행 파일 — Task 2·4 가 의존한다.

- [ ] **Step 1: 없음을 확인 (실패 검증)**

```bash
ssh stevenlim@192.168.219.117 "
for c in libreoffice soffice yt-dlp; do printf '%-12s %s\n' \$c \"\$(command -v \$c || echo MISSING)\"; done
"
```

Expected: 셋 다 `MISSING`

- [ ] **Step 2: LibreOffice 설치 (헤드리스 변환용 최소 구성)**

`--no-install-recommends` 로 GUI 의존성을 뺀다. 전체 `libreoffice` 메타패키지는 불필요하게 크다.

```bash
ssh stevenlim@192.168.219.117 "
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  libreoffice-core libreoffice-writer libreoffice-calc libreoffice-impress
echo '--- 설치 결과 ---'
command -v soffice libreoffice
"
```

Expected: `/usr/bin/soffice` 와 `/usr/bin/libreoffice` 가 출력됨

- [ ] **Step 3: yt-dlp 설치 (공식 standalone 바이너리)**

Ubuntu 24.04 는 PEP 668 로 시스템 pip 설치를 막는다. 공식 배포 바이너리를 쓰는 것이 권장 방식이다.

```bash
ssh stevenlim@192.168.219.117 "
sudo curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
yt-dlp --version
"
```

Expected: 버전 문자열 (예: `2026.07.xx`)

- [ ] **Step 4: 헤드리스 변환 스모크 테스트**

실제 변환이 되는지 확인한다. 설치만 되고 헤드리스가 안 도는 경우가 흔하다.

```bash
ssh stevenlim@192.168.219.117 '
set -e
T=$(mktemp -d)
printf "Lucifer smoke test\nsecond line\n" > "$T/smoke.txt"
cd "$T"
soffice --headless --convert-to pdf --outdir "$T" "$T/smoke.txt" 2>&1 | tail -2
ls -l "$T/smoke.pdf"
rm -rf "$T"
'
```

Expected: `smoke.pdf` 가 생성되고 크기가 0 보다 큼

첫 실행은 프로필 생성 때문에 10초 이상 걸릴 수 있다. 정상이다.

- [ ] **Step 5: 커밋**

서버 환경 변경이라 저장소에 커밋할 것이 없다. 다음 태스크로 넘어간다.

---

## Task 2: 변환 스크립트 골격 + 문서 변환

**Files:**
- Create: `scripts/lucifer/converters.py`
- Create: `scripts/lucifer/convert.py`
- Test: `scripts/lucifer/test_convert.py`

**Interfaces:**
- Consumes: Task 1 의 `soffice`
- Produces:
  - `converters.convert_document(src: Path, dst_dir: Path) -> Path` — PDF 경로 반환, 실패 시 예외
  - `convert.plan_targets(data_dir: Path) -> list[tuple[Path, Path]]` — (원본, 목표) 쌍 목록
  - `convert.needs_conversion(src: Path, dst: Path) -> bool`
  - Task 3·4 가 `converters` 에 함수를 추가한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/lucifer/test_convert.py`:

```python
"""Lucifer 변환 파이프라인 테스트. pytest 없이 표준 unittest 로 돌린다."""
import tempfile
import unittest
from pathlib import Path

import convert
import converters


class TestNeedsConversion(unittest.TestCase):
    def test_missing_target_needs_conversion(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "a.pptx"
            src.write_bytes(b"x")
            dst = Path(d) / "_ai" / "a.pdf"
            self.assertTrue(convert.needs_conversion(src, dst))

    def test_fresh_target_skipped(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "a.pptx"
            src.write_bytes(b"x")
            dst = Path(d) / "a.pdf"
            dst.write_bytes(b"y")  # src 보다 나중에 생성 -> 최신
            self.assertFalse(convert.needs_conversion(src, dst))


class TestPlanTargets(unittest.TestCase):
    def test_maps_pptx_to_pdf_under_ai(self):
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            (data / "기획").mkdir()
            src = data / "기획" / "deck.pptx"
            src.write_bytes(b"x")
            pairs = convert.plan_targets(data)
            self.assertEqual(len(pairs), 1)
            got_src, got_dst = pairs[0]
            self.assertEqual(got_src, src)
            self.assertEqual(got_dst, data / "_ai" / "기획" / "deck.pdf")

    def test_ignores_files_already_under_ai(self):
        # _ai/ 안의 pptx 를 쓴다. pdf 로 하면 "변환 대상 아님" 때문에
        # 걸러져서 _ai 제외 로직을 실제로 검증하지 못한다.
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            (data / "_ai").mkdir()
            (data / "_ai" / "stale.pptx").write_bytes(b"x")
            self.assertEqual(convert.plan_targets(data), [])

    def test_pdf_needs_no_conversion(self):
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            (data / "already.pdf").write_bytes(b"x")
            self.assertEqual(convert.plan_targets(data), [])


class TestConvertDocument(unittest.TestCase):
    def test_converts_txt_to_pdf(self):
        with tempfile.TemporaryDirectory() as d:
            src = Path(d) / "hello.txt"
            src.write_text("Lucifer\n", encoding="utf-8")
            out_dir = Path(d) / "_ai"
            result = converters.convert_document(src, out_dir)
            self.assertTrue(result.exists())
            self.assertGreater(result.stat().st_size, 0)
            self.assertEqual(result.suffix, ".pdf")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
ssh stevenlim@192.168.219.117 "cd ~/lucifer && python3 -m unittest test_convert -v 2>&1 | tail -5"
```

Expected: `ModuleNotFoundError: No module named 'convert'` (아직 배포 전이므로 로컬에서 확인해도 됨)

- [ ] **Step 3: `converters.py` 작성**

```python
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
```

- [ ] **Step 4: `convert.py` 작성**

```python
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
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

```bash
cd scripts/lucifer && python3 -m unittest test_convert -v 2>&1 | tail -8
```

Expected: `OK` — 단 `TestConvertDocument` 는 `soffice` 가 있는 서버에서만 통과한다. 로컬 Windows 에는 없으므로 서버에서 돌린다:

```bash
ssh stevenlim@192.168.219.117 "mkdir -p ~/lucifer"
scp scripts/lucifer/*.py stevenlim@192.168.219.117:~/lucifer/
ssh stevenlim@192.168.219.117 "cd ~/lucifer && python3 -m unittest test_convert -v 2>&1 | tail -8"
```

Expected: `Ran 6 tests`, `OK`

- [ ] **Step 6: 커밋**

```bash
git add scripts/lucifer/converters.py scripts/lucifer/convert.py scripts/lucifer/test_convert.py
git commit -m "feat(lucifer): 문서 -> PDF 변환 파이프라인 골격

data/ 를 훑어 _ai/ 에 파생물을 만드는 디스패처와 LibreOffice
헤드리스 문서 변환. 원본 불변, 실패는 _convert-errors.log 에 기록."
```

---

## Task 3: 영상 변환 (장면 프레임 + 로컬 비전 설명)

**Files:**
- Modify: `scripts/lucifer/converters.py`
- Modify: `scripts/lucifer/convert.py`
- Modify: `scripts/lucifer/test_convert.py`

**Interfaces:**
- Consumes: Task 2 의 `converters.DOCUMENT_SUFFIXES`, `convert.convert_one`
- Produces: `converters.convert_video(src: Path, dst_dir: Path) -> Path` — 설명 마크다운 경로 반환

- [ ] **Step 1: 실패하는 테스트 추가**

`test_convert.py` 에 추가:

```python
class TestVideoTargets(unittest.TestCase):
    def test_maps_mp4_to_markdown_under_ai(self):
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            src = data / "demo.mp4"
            src.write_bytes(b"x")
            pairs = convert.plan_targets(data)
            self.assertEqual(len(pairs), 1)
            self.assertEqual(pairs[0][1], data / "_ai" / "demo.md")

    def test_frame_cap_is_twenty(self):
        self.assertEqual(converters.MAX_FRAMES, 20)
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd scripts/lucifer && python3 -m unittest test_convert.TestVideoTargets -v 2>&1 | tail -5
```

Expected: FAIL — `plan_targets` 가 `.mp4` 를 무시하므로 `len(pairs) == 0`

- [ ] **Step 3: `converters.py` 에 영상 변환 추가**

```python
import base64
import json
import os
import urllib.request

VIDEO_SUFFIXES = {".mp4", ".mov", ".mkv", ".avi", ".webm"}

MAX_FRAMES = 20
SCENE_THRESHOLD = 0.3
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
VISION_MODEL = os.environ.get("LUCIFER_VISION_MODEL", "qwen2.5vl:7b")
FFMPEG_TIMEOUT_SEC = 600
OLLAMA_TIMEOUT_SEC = 180


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


def convert_video(src: Path, dst_dir: Path) -> Path:
    """장면 전환 프레임을 뽑고 각 프레임을 설명한 마크다운을 만든다."""
    dst_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = dst_dir / f"{src.stem}.frames"
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

    out = dst_dir / f"{src.stem}.md"
    out.write_text("\n".join(lines), encoding="utf-8")
    return out
```

- [ ] **Step 4: `convert.py` 의 디스패치에 영상 추가**

`target_for` 에 분기를 추가한다:

```python
    if src.suffix.lower() in converters.VIDEO_SUFFIXES:
        return data_dir / AI_DIR_NAME / rel.with_suffix(".md")
```

`convert_one` 에 분기를 추가한다:

```python
    if src.suffix.lower() in converters.VIDEO_SUFFIXES:
        converters.convert_video(src, dst.parent)
        return
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
scp scripts/lucifer/*.py stevenlim@192.168.219.117:~/lucifer/
ssh stevenlim@192.168.219.117 "cd ~/lucifer && python3 -m unittest test_convert -v 2>&1 | tail -8"
```

Expected: `Ran 8 tests`, `OK`

- [ ] **Step 6: 실제 영상으로 종단 확인**

ffmpeg 로 3초짜리 테스트 영상을 만들어 변환한다.

```bash
ssh stevenlim@192.168.219.117 '
set -e
D=/media/stevenlim/TwinverseFolder/Lucifer/TwinverseAI/data
ffmpeg -nostdin -y -f lavfi -i "testsrc=duration=3:size=320x240:rate=10" \
       -f lavfi -i "color=c=blue:duration=1:size=320x240:rate=10" \
       -filter_complex "[0:v][1:v]concat=n=2:v=1" "$D/_smoke.mp4" 2>&1 | tail -1
cd ~/lucifer && python3 convert.py
ls -R "$D/_ai/" | head -20
'
```

Expected: `_smoke.md` 와 `_smoke.frames/` 가 생기고, 마크다운에 프레임 설명이 한국어로 들어 있음

확인 후 정리:

```bash
ssh stevenlim@192.168.219.117 '
D=/media/stevenlim/TwinverseFolder/Lucifer/TwinverseAI/data
rm -f "$D/_smoke.mp4" "$D/_ai/_smoke.md"
rm -rf "$D/_ai/_smoke.frames"
'
```

- [ ] **Step 7: 커밋**

```bash
git add scripts/lucifer/converters.py scripts/lucifer/convert.py scripts/lucifer/test_convert.py
git commit -m "feat(lucifer): 영상 -> 장면 프레임 + 로컬 비전 설명

ffmpeg 장면 전환 검출로 최대 20장만 추출하고 Ollama qwen2.5vl 로
각 프레임을 한국어 설명. 외부 API 키 불필요."
```

---

## Task 4: 유튜브 링크 자막 추출

**Files:**
- Modify: `scripts/lucifer/converters.py`
- Modify: `scripts/lucifer/convert.py`
- Modify: `scripts/lucifer/test_convert.py`

**Interfaces:**
- Consumes: Task 1 의 `yt-dlp`, Task 2 의 디스패처
- Produces: `converters.convert_youtube_links(src: Path, dst_dir: Path) -> Path`

링크는 파일이 아니므로 규칙이 필요하다: `data/` 안의 **`links.md`** 파일에 유튜브 URL 을 한 줄에 하나씩 적으면, 각 영상의 자막을 받아 `_ai/links/<video_id>.md` 로 저장한다.

- [ ] **Step 1: 실패하는 테스트 추가**

```python
class TestYoutubeLinks(unittest.TestCase):
    def test_extracts_video_ids(self):
        text = (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"
            "메모 한 줄\n"
            "https://youtu.be/abc12345678\n"
        )
        self.assertEqual(
            converters.extract_youtube_ids(text),
            ["dQw4w9WgXcQ", "abc12345678"],
        )

    def test_ignores_non_youtube_urls(self):
        self.assertEqual(converters.extract_youtube_ids("https://example.com/x"), [])

    def test_links_md_is_a_conversion_target(self):
        with tempfile.TemporaryDirectory() as d:
            data = Path(d)
            (data / "links.md").write_text("https://youtu.be/abc12345678\n", encoding="utf-8")
            pairs = convert.plan_targets(data)
            self.assertEqual(len(pairs), 1)
            self.assertEqual(pairs[0][1], data / "_ai" / "links" / ".done")
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd scripts/lucifer && python3 -m unittest test_convert.TestYoutubeLinks -v 2>&1 | tail -5
```

Expected: FAIL — `converters` 에 `extract_youtube_ids` 가 없음

- [ ] **Step 3: `converters.py` 에 유튜브 처리 추가**

```python
import re

LINKS_FILENAME = "links.md"
YTDLP_TIMEOUT_SEC = 300

_YOUTUBE_ID_RE = re.compile(
    r"(?:youtube\.com/watch\?v=|youtu\.be/)([A-Za-z0-9_-]{11})"
)


def extract_youtube_ids(text: str) -> list[str]:
    """텍스트에서 유튜브 video id 를 등장 순서대로, 중복 없이 뽑는다."""
    seen = []
    for match in _YOUTUBE_ID_RE.finditer(text):
        vid = match.group(1)
        if vid not in seen:
            seen.append(vid)
    return seen


def convert_youtube_links(src: Path, dst_dir: Path) -> Path:
    """links.md 의 유튜브 URL 마다 자막을 받아 마크다운으로 저장한다."""
    dst_dir.mkdir(parents=True, exist_ok=True)
    ids = extract_youtube_ids(src.read_text(encoding="utf-8", errors="replace"))
    failures = []
    for vid in ids:
        out = dst_dir / f"{vid}.md"
        if out.exists():
            continue
        result = subprocess.run(
            [
                "yt-dlp",
                "--skip-download",
                "--write-auto-sub", "--write-sub",
                "--sub-lang", "ko,en",
                "--sub-format", "vtt",
                "--convert-subs", "srt",
                "-o", str(dst_dir / f"{vid}.%(ext)s"),
                f"https://www.youtube.com/watch?v={vid}",
            ],
            capture_output=True, text=True, timeout=YTDLP_TIMEOUT_SEC,
        )
        subs = sorted(dst_dir.glob(f"{vid}*.srt"))
        if not subs:
            failures.append(f"{vid}: 자막 없음 (rc={result.returncode})")
            continue
        body = subs[0].read_text(encoding="utf-8", errors="replace")
        out.write_text(f"# https://youtu.be/{vid}\n\n```\n{body}\n```\n", encoding="utf-8")
        for leftover in subs:
            leftover.unlink()

    marker = dst_dir / ".done"
    marker.write_text(
        f"processed {len(ids)} links\n" + "\n".join(failures) + "\n",
        encoding="utf-8",
    )
    if failures:
        raise RuntimeError("; ".join(failures))
    return marker
```

자막이 없는 영상이 흔하므로 실패를 모아서 마지막에 한 번만 예외로 던진다. 성공한 것은 이미 저장돼 있다.

- [ ] **Step 4: `convert.py` 디스패치에 추가**

`target_for` 에 분기를 추가한다. 이름으로 판별하므로 확장자 분기보다 **먼저** 둔다 — 지금은 `.md` 가 어느 확장자 집합에도 없어 순서가 결과를 바꾸지 않지만, 나중에 `.md` 를 변환 대상에 넣으면 순서가 곧 버그가 된다:

```python
    if src.name == converters.LINKS_FILENAME:
        return data_dir / AI_DIR_NAME / "links" / ".done"
```

`convert_one` 에 분기를 추가한다:

```python
    if src.name == converters.LINKS_FILENAME:
        converters.convert_youtube_links(src, dst.parent)
        return
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
scp scripts/lucifer/*.py stevenlim@192.168.219.117:~/lucifer/
ssh stevenlim@192.168.219.117 "cd ~/lucifer && python3 -m unittest test_convert -v 2>&1 | tail -8"
```

Expected: `Ran 11 tests`, `OK`

- [ ] **Step 6: 커밋**

```bash
git add scripts/lucifer/converters.py scripts/lucifer/convert.py scripts/lucifer/test_convert.py
git commit -m "feat(lucifer): links.md 의 유튜브 URL 자막 추출

yt-dlp 로 ko/en 자막을 받아 _ai/links/<id>.md 로 저장.
자막 없는 영상은 모아서 에러 로그에 남기고 나머지는 계속 진행."
```

---

## Task 5: systemd 타이머 배포와 종단 검증

**Files:**
- Create: `scripts/lucifer/lucifer-convert.service`
- Create: `scripts/lucifer/lucifer-convert.timer`
- Create: `scripts/lucifer/deploy.sh`

**Interfaces:**
- Consumes: Task 2~4 의 스크립트
- Produces: 5분 주기로 도는 systemd 타이머 — 계획 3(미러링)이 같은 배포 방식을 재사용한다.

- [ ] **Step 1: systemd 유닛 작성**

`scripts/lucifer/lucifer-convert.service`:

```ini
[Unit]
Description=Lucifer 미디어 변환 (data/ -> data/_ai/)
After=network-online.target

[Service]
Type=oneshot
User=stevenlim
WorkingDirectory=/home/stevenlim/lucifer
ExecStart=/usr/bin/python3 /home/stevenlim/lucifer/convert.py
# 공유 폴더가 안 붙어 있으면 조용히 아무것도 안 하고 끝난다 (convert.py 가 처리)
TimeoutStartSec=1800
```

`scripts/lucifer/lucifer-convert.timer`:

```ini
[Unit]
Description=Lucifer 미디어 변환 5분 주기

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=30s

[Install]
WantedBy=timers.target
```

- [ ] **Step 2: `deploy.sh` 작성**

```bash
#!/usr/bin/env bash
# Lucifer 변환 스크립트와 systemd 유닛을 twinverse-ai 로 배포한다.
# 사용: bash scripts/lucifer/deploy.sh
set -euo pipefail

HOST=stevenlim@192.168.219.117
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== 스크립트 전송 =="
ssh "$HOST" "mkdir -p ~/lucifer"
scp "$DIR"/convert.py "$DIR"/converters.py "$DIR"/test_convert.py "$HOST":~/lucifer/

echo "== 테스트 =="
ssh "$HOST" "cd ~/lucifer && python3 -m unittest test_convert 2>&1 | tail -3"

echo "== systemd 유닛 설치 =="
scp "$DIR"/lucifer-convert.service "$DIR"/lucifer-convert.timer "$HOST":/tmp/
ssh "$HOST" "
  sudo mv /tmp/lucifer-convert.service /tmp/lucifer-convert.timer /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now lucifer-convert.timer
  systemctl status lucifer-convert.timer --no-pager | head -5
"

echo "== 완료 =="
```

- [ ] **Step 3: 배포 실행**

```bash
bash scripts/lucifer/deploy.sh
```

Expected: 테스트 `OK`, 타이머가 `active (waiting)`

- [ ] **Step 4: 타이머 예약 확인**

```bash
ssh stevenlim@192.168.219.117 "systemctl list-timers lucifer-convert.timer --no-pager"
```

Expected: `NEXT` 컬럼에 5분 이내 시각이 표시됨

- [ ] **Step 5: 종단 검증 — 문서를 넣고 기다린다**

```bash
ssh stevenlim@192.168.219.117 '
D=/media/stevenlim/TwinverseFolder/Lucifer/TwinverseAI/data
printf "Lucifer 종단 테스트\n두 번째 줄\n" > "$D/_e2e.txt"
echo "파일 넣음. 타이머를 즉시 한 번 돌린다."
sudo systemctl start lucifer-convert.service
sleep 20
ls -l "$D/_ai/"
'
```

Expected: `_e2e.pdf` 가 생성됨

- [ ] **Step 6: 감독님 Windows 에서 확인**

```bash
ls -l /z/Lucifer/TwinverseAI/data/_ai/
```

Expected: `_e2e.pdf` 가 보임

정리:

```bash
ssh stevenlim@192.168.219.117 '
D=/media/stevenlim/TwinverseFolder/Lucifer/TwinverseAI/data
rm -f "$D/_e2e.txt" "$D/_ai/_e2e.pdf"
'
```

- [ ] **Step 7: 커밋**

```bash
git add scripts/lucifer/lucifer-convert.service scripts/lucifer/lucifer-convert.timer scripts/lucifer/deploy.sh
git commit -m "feat(lucifer): systemd 타이머 배포 스크립트

5분 주기 oneshot 서비스. deploy.sh 가 전송·테스트·유닛설치까지 처리."
```

---

## 완료 조건

1. `soffice` 와 `yt-dlp` 가 서버에 설치돼 있다
2. `python3 -m unittest test_convert` 가 11개 테스트 전부 통과한다
3. `lucifer-convert.timer` 가 `active (waiting)` 이고 5분 주기로 예약돼 있다
4. `data/` 에 `.txt`/`.pptx` 를 넣으면 몇 분 내 `data/_ai/` 에 `.pdf` 가 생긴다
5. 영상을 넣으면 `_ai/` 에 프레임 폴더와 한국어 설명 마크다운이 생긴다
6. `links.md` 에 유튜브 URL 을 적으면 `_ai/links/<id>.md` 에 자막이 저장된다
7. 변환 실패가 `_common/_convert-errors.log` 에 기록된다
8. 원본 파일이 어떤 경우에도 수정·삭제되지 않는다

## 다음 계획

- **계획 3: 텔레그램 연결** — 감독님이 봇 3개 + 슈퍼그룹(Topics) 준비 후
- **계획 4: 전역 스킬** — `/lucifer` 명령과 등록제
