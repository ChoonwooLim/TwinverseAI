# 디자인샘플 (Design Sample Browser) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** voltagent/awesome-design-md (MIT, 71개 디자인 시스템 마크다운) 을 어드민 사이드바 Claude Code 그룹 하위 '디자인샘플' 메뉴에서 일람·미리보기·복사·다운로드할 수 있게 만든다.

**Architecture:** 백엔드 (FastAPI + SQLModel) 가 GitHub 에서 24h 주기로 sync 해 PostgreSQL 에 캐시. 프론트엔드 (React + react-router) 는 일람 페이지 + 디테일 페이지로 분리. 디테일 페이지는 좌측 DESIGN.md 마크다운 + 우측 getdesign.md iframe 의 스플릿 뷰. 마크다운 복사/다운로드 + 토큰 프리뷰 (디테일 내부 스코프에서만 CSS variables override).

**Tech Stack:** Python 3.12 / FastAPI / SQLModel / Alembic / httpx (이미 deps) / pytest (이번 feature 위해 신규 도입). React 19 / Vite / react-router / react-markdown / axios / CSS Modules.

**Spec:** [docs/superpowers/specs/2026-05-17-design-md-samples-design.md](../specs/2026-05-17-design-md-samples-design.md)

---

## File Structure

### 신규 파일
| Path | 책임 |
|---|---|
| `backend/models/design_md.py` | SQLModel 정의 (DesignMd, DesignMdSyncMeta) |
| `backend/services/design_md_tokens.py` | `parse_color_tokens()`, `parse_font_tokens()` — 순수 함수, pytest 대상 |
| `backend/services/design_md_sync.py` | GitHub 페치 + DB upsert (httpx 비동기) |
| `backend/routers/design_md.py` | 4 엔드포인트 (list, detail, sync/status, sync POST) |
| `backend/alembic/versions/2026_05_17_design_md.py` | 두 테이블 신규 |
| `backend/tests/__init__.py` | 빈 파일 |
| `backend/tests/conftest.py` | pytest 셋업 |
| `backend/tests/test_design_md_tokens.py` | parse_tokens 단위 테스트 |
| `frontend/src/pages/admin/AdminDesignMd.jsx` | 일람 페이지 |
| `frontend/src/pages/admin/AdminDesignMd.module.css` | 일람 페이지 CSS Modules |
| `frontend/src/pages/admin/AdminDesignMdDetail.jsx` | 디테일 페이지 |
| `frontend/src/pages/admin/AdminDesignMdDetail.module.css` | 디테일 페이지 CSS Modules |

### 수정 파일
| Path | 변경 |
|---|---|
| `backend/requirements.txt` | `pytest`, `pytest-asyncio` 추가 |
| `backend/main.py` | `design_md` router include + lifespan 에 sync 자동 트리거 |
| `backend/alembic/env.py` | `DesignMd, DesignMdSyncMeta` import 추가 (autogenerate 메타데이터) |
| `frontend/src/components/layout/Sidebar.jsx` | Claude Code children 배열에 '디자인샘플' 한 줄 추가 |
| `frontend/src/App.jsx` | 신규 2 라우트 + import 2개 |

---

## Task 1: pytest 인프라 + parse_color_tokens TDD

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_design_md_tokens.py`
- Create: `backend/services/design_md_tokens.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: pytest 패키지 설치 + requirements.txt 업데이트**

`backend/requirements.txt` 에 두 줄 추가 (파일 끝):
```
pytest>=8.0
pytest-asyncio>=0.23
```

설치:
```bash
python -m pip install pytest pytest-asyncio
```

- [ ] **Step 2: pytest 셋업 파일 생성**

`backend/tests/__init__.py` — 빈 파일.

`backend/tests/conftest.py`:
```python
"""Pytest 셋업 — backend/ 를 sys.path 에 추가해 import 가 작동하게."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

- [ ] **Step 3: 색상 토큰 추출 — 실패하는 테스트 먼저**

`backend/tests/test_design_md_tokens.py`:
```python
"""Tests for design_md_tokens parser."""
from services.design_md_tokens import parse_color_tokens, parse_font_tokens


def test_parse_color_tokens_extracts_hex_in_order_of_frequency():
    md = """
# Design
Primary color: #cc785c
Background: #1a1a1a
Accent: #cc785c
Border: #1a1a1a
Text: #ffffff
"""
    result = parse_color_tokens(md)
    # cc785c 와 1a1a1a 가 각각 2회, ffffff 가 1회 → 빈도 내림차순
    assert result[:3] == ["#cc785c", "#1a1a1a", "#ffffff"]


def test_parse_color_tokens_normalizes_case():
    md = "#CC785C and #cc785c should dedupe"
    result = parse_color_tokens(md)
    assert result == ["#cc785c"]


def test_parse_color_tokens_limits_to_12():
    md = " ".join(f"#{i:06x}" for i in range(20))
    result = parse_color_tokens(md)
    assert len(result) == 12


def test_parse_color_tokens_returns_empty_list_for_no_colors():
    assert parse_color_tokens("No colors here.") == []


def test_parse_color_tokens_supports_3_digit_hex():
    result = parse_color_tokens("#fff and #abc")
    assert "#fff" in result and "#abc" in result


def test_parse_color_tokens_ignores_8_digit_hex_with_alpha():
    """8-digit hex (with alpha) 는 일단 무시 — 단순화."""
    md = "#cc785c80 should not match; #cc785c should"
    result = parse_color_tokens(md)
    assert result == ["#cc785c"]
```

- [ ] **Step 4: 테스트 실행해서 실패 확인**

```bash
cd backend && python -m pytest tests/test_design_md_tokens.py -v
```

기대: `ImportError: cannot import name 'parse_color_tokens'` 또는 `ModuleNotFoundError`

- [ ] **Step 5: parse_color_tokens 최소 구현**

`backend/services/design_md_tokens.py`:
```python
"""DESIGN.md 에서 디자인 토큰을 추출하는 순수 함수들."""
import re
from collections import Counter

_HEX_RE = re.compile(r"#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|#[0-9a-fA-F]{6}\b(?![0-9a-fA-F])")


def parse_color_tokens(md: str, limit: int = 12) -> list[str]:
    """DESIGN.md 본문에서 hex 색상 (#RGB 또는 #RRGGBB) 을 빈도순으로 추출.

    - 8-digit hex (alpha 포함) 는 무시
    - 대소문자 정규화 (소문자)
    - 중복 제거 + 빈도순 정렬 (빈도 동률 시 등장 순서)
    - 최대 limit 개
    """
    matches = [m.group(0).lower() for m in _HEX_RE.finditer(md)]
    if not matches:
        return []
    counts = Counter(matches)
    return [color for color, _ in counts.most_common(limit)]


def parse_font_tokens(md: str, limit: int = 6) -> list[str]:
    """DESIGN.md 본문에서 폰트 패밀리 이름을 추출.

    매칭 패턴:
      - font-family: "Inter", sans-serif
      - font-family: Inter
      - **Font:** Inter
    빈도순 + dedup + 최대 limit 개.
    """
    # placeholder — 다음 task 에서 TDD 로 채워질 예정
    return []
```

- [ ] **Step 6: 테스트 재실행 — 색상 테스트 5개 PASS**

```bash
cd backend && python -m pytest tests/test_design_md_tokens.py -v
```

기대: `test_parse_color_tokens_*` 5개 전부 PASS. (font 관련 테스트는 아직 없음.)

- [ ] **Step 7: 커밋**

```bash
git add backend/requirements.txt backend/tests/ backend/services/design_md_tokens.py
git commit -m "feat(design-md): parse_color_tokens with pytest

- pytest + pytest-asyncio 신규 도입 (backend/tests/)
- conftest.py 로 sys.path 셋업
- parse_color_tokens: hex (#RGB/#RRGGBB) 빈도순 추출, 8-digit alpha 제외

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: parse_font_tokens TDD

**Files:**
- Modify: `backend/tests/test_design_md_tokens.py`
- Modify: `backend/services/design_md_tokens.py`

- [ ] **Step 1: 실패하는 폰트 테스트 추가**

`backend/tests/test_design_md_tokens.py` 끝에 추가:
```python
def test_parse_font_tokens_extracts_font_family_css():
    md = """
- font-family: "Inter", sans-serif
- font-family: 'Noto Sans KR', sans-serif
"""
    result = parse_font_tokens(md)
    assert "Inter" in result
    assert "Noto Sans KR" in result


def test_parse_font_tokens_extracts_unquoted_family():
    md = "font-family: Helvetica Neue"
    result = parse_font_tokens(md)
    assert "Helvetica Neue" in result


def test_parse_font_tokens_dedupes():
    md = """
font-family: "Inter", sans-serif
font-family: 'Inter'
"""
    result = parse_font_tokens(md)
    assert result.count("Inter") == 1


def test_parse_font_tokens_returns_empty_when_no_fonts():
    assert parse_font_tokens("just text") == []


def test_parse_font_tokens_limits_results():
    md = "\n".join(f"font-family: 'Font{i}'" for i in range(10))
    result = parse_font_tokens(md, limit=3)
    assert len(result) == 3
```

- [ ] **Step 2: 실행해서 실패 확인**

```bash
cd backend && python -m pytest tests/test_design_md_tokens.py -v -k font
```

기대: `test_parse_font_tokens_*` 5개 FAIL (parse_font_tokens 가 빈 리스트 반환 중).

- [ ] **Step 3: parse_font_tokens 구현**

`backend/services/design_md_tokens.py` 의 `parse_font_tokens` 함수 본문 교체:
```python
_FONT_RE = re.compile(
    r"font-family\s*:\s*['\"]?([^'\"\n,;]+?)['\"]?(?=\s*[,;\n]|\s*$)",
    re.MULTILINE | re.IGNORECASE,
)


def parse_font_tokens(md: str, limit: int = 6) -> list[str]:
    """DESIGN.md 본문에서 'font-family: <Name>' 패턴의 첫 패밀리 이름 추출.

    - 따옴표 유무 모두 지원
    - 첫 패밀리만 (fallback 패밀리는 제외)
    - 빈도순 + 등장순 + dedup + 최대 limit 개
    """
    matches = []
    for raw in _FONT_RE.findall(md):
        name = raw.strip()
        if name and name.lower() not in {"sans-serif", "serif", "monospace", "system-ui", "inherit"}:
            matches.append(name)
    if not matches:
        return []
    counts = Counter(matches)
    return [name for name, _ in counts.most_common(limit)]
```

`_FONT_RE` 정의는 `_HEX_RE` 정의 바로 아래 한 번만 두기 (모듈 상단).

- [ ] **Step 4: 테스트 재실행 — 폰트 테스트 5개 + 색상 5개 모두 PASS**

```bash
cd backend && python -m pytest tests/test_design_md_tokens.py -v
```

기대: 10개 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add backend/tests/test_design_md_tokens.py backend/services/design_md_tokens.py
git commit -m "feat(design-md): parse_font_tokens (font-family CSS pattern)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: DesignMd / DesignMdSyncMeta 모델

**Files:**
- Create: `backend/models/design_md.py`

- [ ] **Step 1: 모델 작성**

`backend/models/design_md.py`:
```python
"""DesignMd: voltagent/awesome-design-md 의 캐시된 디자인 샘플.
DesignMdSyncMeta: sync 작업 메타 정보 (싱글톤 행, id=1)."""
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field, Column, JSON


class DesignMd(SQLModel, table=True):
    __tablename__ = "design_md"

    slug: str = Field(primary_key=True)                      # "claude", "airbnb"
    name: str
    category: str = Field(default="", index=True)            # "AI & LLM Platforms"
    tagline: str = Field(default="")
    design_md: str                                            # DESIGN.md 원문
    getdesign_url: str                                        # https://getdesign.md/<slug>/design-md
    github_url: str                                           # GitHub blob URL
    color_tokens: Optional[list] = Field(default=None, sa_column=Column(JSON))
    font_tokens: Optional[list] = Field(default=None, sa_column=Column(JSON))
    last_synced_at: datetime = Field(default_factory=datetime.utcnow)


class DesignMdSyncMeta(SQLModel, table=True):
    __tablename__ = "design_md_sync_meta"

    id: int = Field(default=1, primary_key=True)
    last_sync_started: Optional[datetime] = None
    last_sync_finished: Optional[datetime] = None
    last_sync_status: str = Field(default="never")           # never | running | ok | failed
    last_sync_error: Optional[str] = None
    samples_count: int = Field(default=0)
```

- [ ] **Step 2: import 검증**

```bash
cd backend && python -c "from models.design_md import DesignMd, DesignMdSyncMeta; print('OK')"
```

기대: `OK`

- [ ] **Step 3: 커밋**

```bash
git add backend/models/design_md.py
git commit -m "feat(design-md): DesignMd + DesignMdSyncMeta SQLModel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Alembic 마이그레이션

**Files:**
- Create: `backend/alembic/versions/2026_05_17_design_md.py`
- Modify: `backend/alembic/env.py`

- [ ] **Step 1: alembic env.py 에 모델 import 추가**

`backend/alembic/env.py` 의 모델 import 섹션 (`from models.openclaw_chat import ...` 다음 줄):
```python
from models.design_md import DesignMd, DesignMdSyncMeta  # noqa: F401
```

- [ ] **Step 2: 신규 리비전 파일 작성**

`backend/alembic/versions/2026_05_17_design_md.py`:
```python
"""design_md and design_md_sync_meta tables

Revision ID: 2026_05_17_design_md
Revises: f1a2b3c4d5e6
Create Date: 2026-05-17 00:00:00.000000

voltagent/awesome-design-md 캐시 + sync 메타.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '2026_05_17_design_md'
down_revision: Union[str, Sequence[str], None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'design_md',
        sa.Column('slug', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False, server_default=''),
        sa.Column('tagline', sa.String(), nullable=False, server_default=''),
        sa.Column('design_md', sa.Text(), nullable=False),
        sa.Column('getdesign_url', sa.String(), nullable=False),
        sa.Column('github_url', sa.String(), nullable=False),
        sa.Column('color_tokens', sa.JSON(), nullable=True),
        sa.Column('font_tokens', sa.JSON(), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index('ix_design_md_category', 'design_md', ['category'])

    op.create_table(
        'design_md_sync_meta',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('last_sync_started', sa.DateTime(), nullable=True),
        sa.Column('last_sync_finished', sa.DateTime(), nullable=True),
        sa.Column('last_sync_status', sa.String(), nullable=False, server_default='never'),
        sa.Column('last_sync_error', sa.String(), nullable=True),
        sa.Column('samples_count', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('design_md_sync_meta')
    op.drop_index('ix_design_md_category', table_name='design_md')
    op.drop_table('design_md')
```

- [ ] **Step 3: 마이그레이션 적용**

```bash
cd backend && alembic upgrade head
```

기대 출력:
```
INFO  [alembic.runtime.migration] Running upgrade f1a2b3c4d5e6 -> 2026_05_17_design_md, design_md and design_md_sync_meta tables
```

- [ ] **Step 4: 테이블 생성 확인**

```bash
cd backend && python -c "
from database import engine
from sqlalchemy import inspect
i = inspect(engine)
tbls = i.get_table_names()
print('design_md:', 'design_md' in tbls)
print('design_md_sync_meta:', 'design_md_sync_meta' in tbls)
"
```

기대: 두 줄 모두 `True`.

- [ ] **Step 5: 커밋**

```bash
git add backend/alembic/
git commit -m "feat(design-md): alembic migration for design_md tables

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Sync 서비스

**Files:**
- Create: `backend/services/design_md_sync.py`

- [ ] **Step 1: README 파서 + sync 메인 함수 작성**

`backend/services/design_md_sync.py`:
```python
"""voltagent/awesome-design-md 의 디자인 샘플을 GitHub 에서 페치해 DB 에 캐시.

흐름:
1. README.md → 카테고리 + tagline 맵 (slug -> {category, tagline})
2. git tree → design-md/<slug>/DESIGN.md 경로 목록
3. raw.githubusercontent.com 에서 각 DESIGN.md 병렬 페치 (동시 10)
4. parse_color_tokens, parse_font_tokens 로 토큰 추출
5. session.merge 로 upsert. 사라진 slug 는 삭제.
6. design_md_sync_meta 갱신.
"""
import asyncio
import logging
import re
from datetime import datetime
from typing import Optional

import httpx
from sqlmodel import Session, select

from database import engine
from models.design_md import DesignMd, DesignMdSyncMeta
from services.design_md_tokens import parse_color_tokens, parse_font_tokens

logger = logging.getLogger("design_md_sync")

GITHUB_OWNER = "VoltAgent"
GITHUB_REPO = "awesome-design-md"
GITHUB_BRANCH = "main"
README_RAW = f"https://raw.githubusercontent.com/{GITHUB_OWNER}/{GITHUB_REPO}/{GITHUB_BRANCH}/README.md"
TREE_API = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/git/trees/{GITHUB_BRANCH}?recursive=1"

_CATEGORY_HEADER_RE = re.compile(r"^###\s+(.+)$", re.MULTILINE)
_LINK_LINE_RE = re.compile(r"^\s*-\s*\[\*\*(.+?)\*\*\]\((https://getdesign\.md/([^/]+)/design-md)\)\s*-\s*(.+)$", re.MULTILINE)


def _parse_readme(text: str) -> dict[str, dict]:
    """README.md 의 '### Category' 헤더와 그 아래 링크 라인을 파싱.

    반환: {slug: {"name": str, "category": str, "tagline": str, "getdesign_url": str}}
    """
    result: dict[str, dict] = {}
    # 카테고리 헤더 위치별로 본문을 자르고 그 안의 링크 라인 수집
    sections = re.split(_CATEGORY_HEADER_RE, text)
    # sections = [pre_text, cat1, body1, cat2, body2, ...]
    for i in range(1, len(sections), 2):
        category = sections[i].strip()
        body = sections[i + 1] if i + 1 < len(sections) else ""
        for m in _LINK_LINE_RE.finditer(body):
            name, getdesign_url, slug, tagline = m.group(1), m.group(2), m.group(3), m.group(4).strip()
            result[slug] = {
                "name": name,
                "category": category,
                "tagline": tagline,
                "getdesign_url": getdesign_url,
            }
    return result


async def _fetch_design_md(client: httpx.AsyncClient, slug: str) -> Optional[str]:
    """단일 brand 의 DESIGN.md raw 내용 페치. 실패 시 None."""
    url = f"https://raw.githubusercontent.com/{GITHUB_OWNER}/{GITHUB_REPO}/{GITHUB_BRANCH}/design-md/{slug}/DESIGN.md"
    try:
        r = await client.get(url, timeout=15)
        r.raise_for_status()
        return r.text
    except Exception as e:
        logger.warning(f"[design_md_sync] fetch failed for {slug}: {e}")
        return None


async def _fetch_all_design_md(slugs: list[str]) -> dict[str, str]:
    """모든 slug 의 DESIGN.md 를 동시 10개씩 페치."""
    limits = httpx.Limits(max_connections=10)
    async with httpx.AsyncClient(limits=limits) as client:
        coros = [_fetch_design_md(client, slug) for slug in slugs]
        results = await asyncio.gather(*coros)
    return {slug: text for slug, text in zip(slugs, results) if text is not None}


def _get_meta(session: Session) -> DesignMdSyncMeta:
    meta = session.get(DesignMdSyncMeta, 1)
    if meta is None:
        meta = DesignMdSyncMeta(id=1)
        session.add(meta)
        session.commit()
        session.refresh(meta)
    return meta


async def sync_from_github() -> dict:
    """전체 sync 흐름. 결과 dict 반환 (status, count, error)."""
    started_at = datetime.utcnow()
    with Session(engine) as session:
        meta = _get_meta(session)
        meta.last_sync_started = started_at
        meta.last_sync_status = "running"
        meta.last_sync_error = None
        session.add(meta)
        session.commit()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # 1) README + tree 병렬 페치
            readme_resp, tree_resp = await asyncio.gather(
                client.get(README_RAW),
                client.get(TREE_API),
            )
            readme_resp.raise_for_status()
            tree_resp.raise_for_status()

        readme_map = _parse_readme(readme_resp.text)
        tree = tree_resp.json().get("tree", [])
        slugs_from_tree = []
        for entry in tree:
            path = entry.get("path", "")
            m = re.match(r"^design-md/([^/]+)/DESIGN\.md$", path)
            if m and entry.get("type") == "blob":
                slugs_from_tree.append(m.group(1))

        # 2) DESIGN.md 페치
        md_map = await _fetch_all_design_md(slugs_from_tree)

        # 3) DB upsert
        with Session(engine) as session:
            seen_slugs = set()
            for slug, md_text in md_map.items():
                meta_entry = readme_map.get(slug, {})
                row = session.get(DesignMd, slug) or DesignMd(slug=slug, name=slug, design_md="", getdesign_url="", github_url="")
                row.name = meta_entry.get("name") or slug
                row.category = meta_entry.get("category") or "Other"
                row.tagline = meta_entry.get("tagline") or ""
                row.design_md = md_text
                row.getdesign_url = meta_entry.get("getdesign_url") or f"https://getdesign.md/{slug}/design-md"
                row.github_url = f"https://github.com/{GITHUB_OWNER}/{GITHUB_REPO}/blob/{GITHUB_BRANCH}/design-md/{slug}/DESIGN.md"
                row.color_tokens = parse_color_tokens(md_text)
                row.font_tokens = parse_font_tokens(md_text)
                row.last_synced_at = datetime.utcnow()
                session.add(row)
                seen_slugs.add(slug)

            # 4) 사라진 slug 삭제
            existing = session.exec(select(DesignMd)).all()
            for row in existing:
                if row.slug not in seen_slugs:
                    session.delete(row)

            session.commit()

            # 5) 메타 업데이트
            meta = _get_meta(session)
            meta.last_sync_finished = datetime.utcnow()
            meta.last_sync_status = "ok"
            meta.last_sync_error = None
            meta.samples_count = len(seen_slugs)
            session.add(meta)
            session.commit()

        logger.info(f"[design_md_sync] OK: {len(seen_slugs)} samples")
        return {"status": "ok", "count": len(seen_slugs)}

    except Exception as e:
        logger.exception(f"[design_md_sync] FAILED: {e}")
        with Session(engine) as session:
            meta = _get_meta(session)
            meta.last_sync_finished = datetime.utcnow()
            meta.last_sync_status = "failed"
            meta.last_sync_error = str(e)[:500]
            session.add(meta)
            session.commit()
        return {"status": "failed", "error": str(e)}
```

- [ ] **Step 2: import smoke test**

```bash
cd backend && python -c "from services.design_md_sync import sync_from_github, _parse_readme; print('OK')"
```

기대: `OK`

- [ ] **Step 3: README 파서 단위 검증 (수동)**

```bash
cd backend && python -c "
import asyncio, httpx
from services.design_md_sync import _parse_readme, README_RAW

async def main():
    async with httpx.AsyncClient() as c:
        r = await c.get(README_RAW)
        m = _parse_readme(r.text)
        print(f'parsed {len(m)} entries')
        print('claude:', m.get('claude'))
        print('cursor:', m.get('cursor'))

asyncio.run(main())
"
```

기대: 50개 이상 엔트리. `claude` 와 `cursor` 가 `name/category/tagline/getdesign_url` 채워져 있음.

만약 0개 또는 매우 적게 나오면 README 포맷이 spec 가정과 다름 — `_LINK_LINE_RE` 정규식을 실제 README 라인에 맞춰 수정 후 재시도.

- [ ] **Step 4: 전체 sync 라이브 테스트**

```bash
cd backend && python -c "
import asyncio
from services.design_md_sync import sync_from_github
print(asyncio.run(sync_from_github()))
"
```

기대 출력: `{'status': 'ok', 'count': 70}` 근처 (정확한 수는 voltagent 가 최근 추가한 디자인 수에 따라 변동).

DB 검증:
```bash
cd backend && python -c "
from sqlmodel import Session, select
from database import engine
from models.design_md import DesignMd, DesignMdSyncMeta
with Session(engine) as s:
    samples = s.exec(select(DesignMd)).all()
    print(f'samples: {len(samples)}')
    if samples:
        c = samples[0]
        print(f'first: slug={c.slug} name={c.name} category={c.category}')
        print(f'  color_tokens(top5)={c.color_tokens[:5] if c.color_tokens else None}')
        print(f'  font_tokens={c.font_tokens}')
    meta = s.get(DesignMdSyncMeta, 1)
    print(f'meta: status={meta.last_sync_status} count={meta.samples_count}')
"
```

기대: samples 50+ 개, 첫 행이 합리적인 데이터, meta status = ok.

- [ ] **Step 5: 커밋**

```bash
git add backend/services/design_md_sync.py
git commit -m "feat(design-md): sync service (GitHub README + raw DESIGN.md)

- README 의 '### Category\n- [**Name**](url) - tagline' 파싱
- git tree 로 design-md/<slug>/DESIGN.md 경로 수집
- raw.githubusercontent.com 에서 병렬 페치 (동시 10)
- DB upsert + 사라진 slug 삭제 + sync meta 갱신

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: 라우터 (4 엔드포인트)

**Files:**
- Create: `backend/routers/design_md.py`

- [ ] **Step 1: 라우터 작성**

`backend/routers/design_md.py`:
```python
"""디자인샘플 (voltagent/awesome-design-md) API — admin only."""
import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from deps import require_admin
from models.design_md import DesignMd, DesignMdSyncMeta
from services.design_md_sync import sync_from_github, _get_meta

router = APIRouter()
logger = logging.getLogger("design_md_api")


def _serialize_list(d: DesignMd) -> dict:
    return {
        "slug": d.slug,
        "name": d.name,
        "category": d.category,
        "tagline": d.tagline,
        "color_tokens": (d.color_tokens or [])[:5],
        "last_synced_at": d.last_synced_at.isoformat() if d.last_synced_at else None,
    }


def _serialize_detail(d: DesignMd) -> dict:
    return {
        "slug": d.slug,
        "name": d.name,
        "category": d.category,
        "tagline": d.tagline,
        "design_md": d.design_md,
        "getdesign_url": d.getdesign_url,
        "github_url": d.github_url,
        "color_tokens": d.color_tokens or [],
        "font_tokens": d.font_tokens or [],
        "last_synced_at": d.last_synced_at.isoformat() if d.last_synced_at else None,
    }


def _serialize_meta(m: DesignMdSyncMeta) -> dict:
    return {
        "last_sync_started": m.last_sync_started.isoformat() if m.last_sync_started else None,
        "last_sync_finished": m.last_sync_finished.isoformat() if m.last_sync_finished else None,
        "last_sync_status": m.last_sync_status,
        "last_sync_error": m.last_sync_error,
        "samples_count": m.samples_count,
    }


@router.get("")
def list_design_md(
    session: Session = Depends(get_session),
    _: object = Depends(require_admin),
):
    """전체 디자인 샘플 목록 (슬림 페이로드)."""
    rows = session.exec(select(DesignMd).order_by(DesignMd.name)).all()
    return [_serialize_list(d) for d in rows]


@router.get("/sync/status")
def sync_status(
    session: Session = Depends(get_session),
    _: object = Depends(require_admin),
):
    """동기화 메타 조회."""
    meta = _get_meta(session)
    return _serialize_meta(meta)


@router.post("/sync")
def trigger_sync(
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
    _: object = Depends(require_admin),
):
    """수동 sync 트리거. 이미 running 이면 409."""
    meta = _get_meta(session)
    if meta.last_sync_status == "running":
        raise HTTPException(status_code=409, detail="동기화가 이미 진행 중입니다")
    background_tasks.add_task(sync_from_github)  # FastAPI 가 async 함수 그대로 처리
    return {"status": "started"}


@router.get("/{slug}")
def get_design_md(
    slug: str,
    session: Session = Depends(get_session),
    _: object = Depends(require_admin),
):
    """단일 디자인 샘플 디테일."""
    row = session.get(DesignMd, slug)
    if row is None:
        raise HTTPException(status_code=404, detail="디자인 샘플을 찾을 수 없습니다")
    return _serialize_detail(row)
```

라우트 순서 주의: `/sync/status` 와 `/sync` 가 `/{slug}` 보다 위에 와야 함 (FastAPI 매칭 순서).

- [ ] **Step 2: main.py 에 라우터 등록**

`backend/main.py` 의 `app.include_router(...)` 블록 (line ~495-508) 끝에 추가:
```python
from routers import design_md  # 상단 import 블록에도 추가
# ...
app.include_router(design_md.router, prefix="/api/design-md", tags=["design-md"])
```

상단 import 줄 (line ~21) 의 `from routers import ...` 끝에 `design_md` 추가.

- [ ] **Step 3: backend 재시작 후 엔드포인트 라이브 테스트**

backend 가 dev 서버에서 자동 reload 되는지 확인. preview_start 로 backend 가 켜져 있으면 변경 즉시 반영.

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin1234"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
echo "Token: ${TOKEN:0:20}..."

echo "--- GET /api/design-md ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/design-md | python -m json.tool | head -30

echo "--- GET /api/design-md/sync/status ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/design-md/sync/status | python -m json.tool

echo "--- GET /api/design-md/claude ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/design-md/claude | python -c "import sys,json; d=json.load(sys.stdin); print('name:', d['name']); print('design_md len:', len(d['design_md']))"
```

기대:
- 첫 번째: JSON 배열, 각 원소에 slug/name/category/tagline/color_tokens
- 두 번째: `{last_sync_status: "ok", samples_count: 70}` 근처
- 세 번째: `name: Claude`, `design_md len: <수천>`

권한 검증:
```bash
echo "--- 비인증 호출 (401 기대) ---"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/api/design-md
```
기대: `401`

- [ ] **Step 4: 커밋**

```bash
git add backend/routers/design_md.py backend/main.py
git commit -m "feat(design-md): 4 admin endpoints + main.py wiring

GET /api/design-md (list)
GET /api/design-md/{slug} (detail)
GET /api/design-md/sync/status
POST /api/design-md/sync (BackgroundTasks)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: lifespan 에 24h 자동 sync 트리거

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: lifespan 의 post-yield 직전에 sync 트리거 추가**

`backend/main.py` 의 lifespan 함수 (line ~436-471) 의 `yield` 줄 바로 위에 추가:
```python
    # Auto-sync design_md if last sync > 24h ago (or never)
    try:
        import asyncio as _asyncio
        from datetime import datetime as _dt
        from sqlmodel import Session as _Session
        from models.design_md import DesignMdSyncMeta as _Meta
        with _Session(database.engine) as _s:
            _meta = _s.get(_Meta, 1)
            _needs_sync = (
                _meta is None
                or _meta.last_sync_finished is None
                or (_dt.utcnow() - _meta.last_sync_finished).total_seconds() > 86400
            )
            _is_running = _meta is not None and _meta.last_sync_status == "running"
        if _needs_sync and not _is_running:
            from services.design_md_sync import sync_from_github as _sync
            _asyncio.create_task(_sync())
            print("[startup:design_md_sync] triggered background sync")
    except Exception as e:
        print(f"[startup:design_md_sync] ERROR (non-fatal): {e}")
```

- [ ] **Step 2: backend 재시작 + 로그 확인**

backend reload 후 로그에 `[startup:design_md_sync]` 한 줄 확인. last_sync_finished 가 24h 이내라면 트리거 안 됨 (정상). 처음이라면 트리거.

```bash
sleep 3 && curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/design-md/sync/status | python -m json.tool
```

기대: `last_sync_status: "ok"` 또는 `"running"`.

- [ ] **Step 3: 커밋**

```bash
git add backend/main.py
git commit -m "feat(design-md): startup lifespan triggers 24h sync

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Sidebar + Routing

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Sidebar 메뉴 추가**

`frontend/src/components/layout/Sidebar.jsx` 의 Claude Code 그룹 children 배열 (line ~40-44) 에 4번째 항목 삽입:

변경 전:
```js
children: [
  { label: "AI 스킬", path: "/admin/skills" },
  { label: "플러그인", path: "/admin/plugins" },
  { label: "최근정보", path: "/admin/news" },
  { label: "Claw Code 분석", path: "/admin/claw-code" },
  { label: "공식 레포 분석", path: "/admin/claude-code-repo" },
],
```

변경 후:
```js
children: [
  { label: "AI 스킬", path: "/admin/skills" },
  { label: "플러그인", path: "/admin/plugins" },
  { label: "최근정보", path: "/admin/news" },
  { label: "디자인샘플", path: "/admin/design-md" },
  { label: "Claw Code 분석", path: "/admin/claw-code" },
  { label: "공식 레포 분석", path: "/admin/claude-code-repo" },
],
```

- [ ] **Step 2: App.jsx 에 라우트 + import 추가**

`frontend/src/App.jsx` 에서:

기존 `AdminClawCode` / `AdminClaudeCodeRepo` import 줄 근처에 추가:
```jsx
import AdminDesignMd from "./pages/admin/AdminDesignMd";
import AdminDesignMdDetail from "./pages/admin/AdminDesignMdDetail";
```

기존 admin 라우트 (`/admin/claude-code-repo`) 근처에 추가:
```jsx
<Route path="/admin/design-md" element={<ProtectedRoute requiredRole="admin"><AdminDesignMd /></ProtectedRoute>} />
<Route path="/admin/design-md/:slug" element={<ProtectedRoute requiredRole="admin"><AdminDesignMdDetail /></ProtectedRoute>} />
```

- [ ] **Step 3: 사이드바 시각 확인**

브라우저에서 `/admin` 진입 → 사이드바 Claude Code 그룹 펼치기 → '디자인샘플' 메뉴가 4번째에 보이는지 확인. 클릭하면 404 또는 빈 화면 (다음 task 에서 페이지 생성). 라우트 매칭은 되어야 함 (콘솔 에러 없음).

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/layout/Sidebar.jsx frontend/src/App.jsx
git commit -m "feat(design-md): sidebar menu + routes

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: 일람 페이지 — AdminDesignMd

**Files:**
- Create: `frontend/src/pages/admin/AdminDesignMd.jsx`
- Create: `frontend/src/pages/admin/AdminDesignMd.module.css`

- [ ] **Step 1: CSS Modules 파일 작성**

`frontend/src/pages/admin/AdminDesignMd.module.css`:
```css
.page {
  padding: 24px;
  color: #fff;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.headerRight {
  display: flex;
  align-items: center;
  gap: 12px;
}

.syncBadge {
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.syncBadge.ok { color: #00d4ff; }
.syncBadge.failed { color: #f59e0b; }
.syncBadge.running { color: #a78bfa; }
.syncBadge.never { color: rgba(255,255,255,0.5); }

.syncBtn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid rgba(102, 126, 234, 0.5);
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.syncBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.filterBar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 24px;
}

.search {
  flex: 1;
  min-width: 240px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
}

.chips { display: flex; gap: 6px; flex-wrap: wrap; }

.chip {
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  cursor: pointer;
}

.chip.active {
  background: rgba(102, 126, 234, 0.2);
  border-color: #667eea;
  color: #fff;
}

.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 15px;
  backdrop-filter: blur(10px);
  transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  text-decoration: none;
  color: inherit;
  display: block;
}

.card:hover {
  transform: translateY(-2px);
  border-color: rgba(102, 126, 234, 0.5);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.15);
}

.cardName {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 8px;
}

.cardChip {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(102, 126, 234, 0.15);
  color: #00d4ff;
  font-size: 11px;
  margin-bottom: 8px;
}

.cardTagline {
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
  min-height: 40px;
}

.swatch { display: flex; gap: 4px; }
.swatch span {
  width: 24px;
  height: 12px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.empty {
  padding: 60px 24px;
  text-align: center;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 15px;
}

.empty p { color: rgba(255,255,255,0.6); margin-bottom: 16px; }

.footer {
  margin-top: 48px;
  padding-top: 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.4);
  font-size: 12px;
  text-align: center;
}

.footer a { color: rgba(255,255,255,0.6); }
```

- [ ] **Step 2: AdminDesignMd 컴포넌트 작성**

`frontend/src/pages/admin/AdminDesignMd.jsx`:
```jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import styles from "./AdminDesignMd.module.css";

function formatRelTime(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function SyncBadge({ status }) {
  if (!status) return null;
  const s = status.last_sync_status;
  if (s === "running") {
    return <span className={`${styles.syncBadge} ${styles.running}`}>🔄 동기화 진행 중...</span>;
  }
  if (s === "ok") {
    return (
      <span className={`${styles.syncBadge} ${styles.ok}`}>
        ✅ {status.samples_count}개 · {formatRelTime(status.last_sync_finished)}
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span
        className={`${styles.syncBadge} ${styles.failed}`}
        title={status.last_sync_error || ""}
      >
        ⚠️ 동기화 실패 · {formatRelTime(status.last_sync_finished)}
      </span>
    );
  }
  return <span className={`${styles.syncBadge} ${styles.never}`}>○ 아직 동기화 안 됨</span>;
}

export default function AdminDesignMd() {
  const [samples, setSamples] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const pollRef = useRef(null);

  const fetchAll = async () => {
    const [list, status] = await Promise.all([
      api.get("/api/design-md").then((r) => r.data),
      api.get("/api/design-md/sync/status").then((r) => r.data),
    ]);
    setSamples(list);
    setSyncStatus(status);
    return status;
  };

  useEffect(() => {
    fetchAll().catch((e) => console.error("[AdminDesignMd] load error", e));
    return () => clearInterval(pollRef.current);
  }, []);

  const triggerSync = async () => {
    setSyncing(true);
    try {
      await api.post("/api/design-md/sync");
    } catch (e) {
      if (e.response?.status !== 409) {
        alert("동기화 시작 실패: " + (e.response?.data?.detail || e.message));
        setSyncing(false);
        return;
      }
    }
    // 3초마다 status 폴링
    pollRef.current = setInterval(async () => {
      const status = await fetchAll();
      if (status.last_sync_status !== "running") {
        clearInterval(pollRef.current);
        setSyncing(false);
      }
    }, 3000);
  };

  const categories = useMemo(() => {
    const set = new Set(samples.map((s) => s.category).filter(Boolean));
    return Array.from(set).sort();
  }, [samples]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return samples.filter((s) => {
      if (activeCategory && s.category !== activeCategory) return false;
      if (q) {
        const hay = `${s.name} ${s.tagline}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [samples, query, activeCategory]);

  const isEmpty = samples.length === 0 && syncStatus?.last_sync_status === "never";

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>디자인샘플</h1>
        <div className={styles.headerRight}>
          <SyncBadge status={syncStatus} />
          <button
            className={styles.syncBtn}
            onClick={triggerSync}
            disabled={syncing || syncStatus?.last_sync_status === "running"}
          >
            🔄 지금 동기화
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className={styles.empty}>
          <p>디자인 샘플이 아직 동기화되지 않았습니다.</p>
          <button className={styles.syncBtn} onClick={triggerSync} disabled={syncing}>
            지금 동기화
          </button>
        </div>
      ) : (
        <>
          <div className={styles.filterBar}>
            <input
              className={styles.search}
              type="text"
              placeholder="이름 또는 설명으로 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className={styles.chips}>
              <span
                className={`${styles.chip} ${!activeCategory ? styles.active : ""}`}
                onClick={() => setActiveCategory(null)}
              >
                전체 ({samples.length})
              </span>
              {categories.map((c) => (
                <span
                  key={c}
                  className={`${styles.chip} ${activeCategory === c ? styles.active : ""}`}
                  onClick={() => setActiveCategory(c)}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.grid}>
            {filtered.map((s) => (
              <Link key={s.slug} to={`/admin/design-md/${s.slug}`} className={styles.card}>
                <h3 className={styles.cardName}>{s.name}</h3>
                {s.category && <span className={styles.cardChip}>{s.category}</span>}
                <p className={styles.cardTagline}>{s.tagline}</p>
                <div className={styles.swatch} aria-label="대표 색상">
                  {(s.color_tokens || []).map((c, i) => (
                    <span key={i} style={{ background: c }} title={c} />
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <div className={styles.footer}>
        Source:{" "}
        <a
          href="https://github.com/voltagent/awesome-design-md"
          target="_blank"
          rel="noreferrer"
        >
          voltagent/awesome-design-md
        </a>{" "}
        (MIT)
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 브라우저 검증**

vite HMR 로 자동 반영. 브라우저에서 `/admin/design-md` 진입.

기대 표시:
- 상단: 제목 + 동기화 배지 + [지금 동기화] 버튼
- 카드 그리드: 50+ 개 카드 (브랜드명/카테고리/tagline/swatch)
- 검색창에 "claude" 입력 → 카드 필터링 확인
- "AI & LLM Platforms" 칩 클릭 → 해당 카테고리만 표시
- 푸터: voltagent/awesome-design-md (MIT) 링크

만약 빈 그리드면:
- F12 콘솔에서 네트워크 에러 확인
- backend 로그에서 sync 완료 여부 확인 (`[design_md_sync] OK: N samples`)
- [지금 동기화] 버튼 클릭

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/admin/AdminDesignMd.jsx frontend/src/pages/admin/AdminDesignMd.module.css
git commit -m "feat(design-md): admin list page with grid + filter + sync badge

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: 디테일 페이지 — AdminDesignMdDetail

**Files:**
- Create: `frontend/src/pages/admin/AdminDesignMdDetail.jsx`
- Create: `frontend/src/pages/admin/AdminDesignMdDetail.module.css`

- [ ] **Step 1: CSS Modules**

`frontend/src/pages/admin/AdminDesignMdDetail.module.css`:
```css
.page {
  padding: 24px;
  color: #fff;
  max-width: 100%;
}

.breadcrumb {
  color: rgba(255,255,255,0.5);
  font-size: 13px;
  margin-bottom: 12px;
}

.breadcrumb a {
  color: rgba(255,255,255,0.7);
  text-decoration: none;
}

.breadcrumb a:hover { color: #00d4ff; }

.headRow {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}

.chip {
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(102, 126, 234, 0.15);
  color: #00d4ff;
  font-size: 12px;
}

.tagline {
  color: rgba(255,255,255,0.65);
  font-size: 14px;
  margin: 0 0 16px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.actions button, .actions a {
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-decoration: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  transition: background 0.2s;
}

.actions button:hover, .actions a:hover {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.mdPane {
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.05);
  overflow-y: auto;
  max-height: calc(100vh - 250px);
  line-height: 1.6;
}

.mdPane h1, .mdPane h2, .mdPane h3 { margin-top: 1.2em; }
.mdPane code {
  background: rgba(255,255,255,0.08);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}
.mdPane pre {
  background: rgba(0,0,0,0.4);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
}

.iframeWrap {
  position: sticky;
  top: 16px;
  height: calc(100vh - 250px);
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  overflow: hidden;
}

.iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.iframeFallback {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255,255,255,0.7);
  padding: 24px;
  text-align: center;
}

.previewDemo {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--preview-bg, rgba(255,255,255,0.04));
  color: var(--preview-text, #fff);
  border-radius: 12px;
  border: 1px solid var(--preview-accent, rgba(255,255,255,0.1));
}

.previewDemo h4 {
  color: var(--preview-primary, #667eea);
  margin: 0 0 8px;
  font-size: 18px;
}

.previewDemoBtn {
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--preview-primary, #667eea);
  color: var(--preview-text, #fff);
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 20px;
  background: rgba(0, 212, 255, 0.15);
  border: 1px solid #00d4ff;
  border-radius: 8px;
  color: #fff;
  z-index: 1000;
}

.notFound {
  padding: 48px;
  text-align: center;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
}

@media (max-width: 1024px) {
  .split { grid-template-columns: 1fr; }
  .iframeWrap { position: static; height: 70vh; }
}
```

- [ ] **Step 2: 디테일 컴포넌트 작성**

`frontend/src/pages/admin/AdminDesignMdDetail.jsx`:
```jsx
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../services/api";
import styles from "./AdminDesignMdDetail.module.css";

function PreviewDemo({ sample }) {
  return (
    <div className={styles.previewDemo}>
      <h4>{sample.name} 디자인 미리보기</h4>
      <p style={{ margin: 0 }}>
        이 컬러/폰트 토큰을 우리 데모 영역에 적용했습니다. 좌측 패널 안에서만 보입니다.
      </p>
      <button className={styles.previewDemoBtn}>샘플 버튼</button>
    </div>
  );
}

export default function AdminDesignMdDetail() {
  const { slug } = useParams();
  const [sample, setSample] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [tokenPreview, setTokenPreview] = useState(false);
  const [toast, setToast] = useState(null);
  const iframeTimeoutRef = useRef(null);

  useEffect(() => {
    setSample(null);
    setLoadError(null);
    setIframeError(false);
    api
      .get(`/api/design-md/${slug}`)
      .then((r) => setSample(r.data))
      .catch((e) => setLoadError(e.response?.status === 404 ? "not_found" : "error"));
  }, [slug]);

  // iframe 5초 타임아웃
  useEffect(() => {
    if (!sample || iframeError) return;
    iframeTimeoutRef.current = setTimeout(() => {
      // onLoad 가 5초 안에 안 불리면 에러로 간주
      setIframeError(true);
    }, 8000);
    return () => clearTimeout(iframeTimeoutRef.current);
  }, [sample, iframeError]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(sample.design_md);
      showToast("DESIGN.md 가 클립보드에 복사되었습니다");
    } catch (e) {
      showToast("복사 실패: " + e.message);
    }
  };

  const downloadMd = () => {
    const blob = new Blob([sample.design_md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DESIGN-${sample.slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loadError === "not_found") {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <h2>디자인 샘플을 찾을 수 없습니다</h2>
          <p>
            <Link to="/admin/design-md">← 목록으로</Link>
          </p>
        </div>
      </div>
    );
  }

  if (loadError === "error") {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <h2>디자인 샘플 로드 중 오류가 발생했습니다</h2>
          <p>
            <Link to="/admin/design-md">← 목록으로</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!sample) {
    return (
      <div className={styles.page}>
        <p style={{ color: "rgba(255,255,255,0.5)" }}>로딩 중...</p>
      </div>
    );
  }

  const hasColorTokens = (sample.color_tokens || []).length > 0;

  const tokenPreviewStyle = tokenPreview
    ? {
        "--preview-primary": sample.color_tokens?.[0],
        "--preview-bg": sample.color_tokens?.[1],
        "--preview-accent": sample.color_tokens?.[2],
        "--preview-text": sample.color_tokens?.[3] || "#fff",
        fontFamily: sample.font_tokens?.[0] || "inherit",
      }
    : {};

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link to="/admin/design-md">디자인샘플</Link> / {sample.name}
      </div>
      <div className={styles.headRow}>
        <h1 className={styles.title}>{sample.name}</h1>
        {sample.category && <span className={styles.chip}>{sample.category}</span>}
      </div>
      <p className={styles.tagline}>{sample.tagline}</p>
      <div className={styles.actions}>
        <button onClick={copyMd}>📋 마크다운 복사</button>
        <button onClick={downloadMd}>⬇️ DESIGN.md 다운로드</button>
        <button
          onClick={() => setTokenPreview((v) => !v)}
          disabled={!hasColorTokens}
          title={!hasColorTokens ? "이 디자인의 색상 토큰을 자동 추출하지 못했습니다" : ""}
        >
          🎨 토큰 프리뷰 {tokenPreview ? "ON" : "OFF"}
        </button>
        <a href={sample.getdesign_url} target="_blank" rel="noreferrer">
          getdesign.md ↗
        </a>
        <a href={sample.github_url} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </div>

      <div className={styles.split}>
        <div className={styles.mdPane} style={tokenPreviewStyle}>
          {tokenPreview && <PreviewDemo sample={sample} />}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{sample.design_md}</ReactMarkdown>
        </div>

        <div className={styles.iframeWrap}>
          {iframeError ? (
            <div className={styles.iframeFallback}>
              <p>외부 사이트를 임베드할 수 없습니다.</p>
              <a href={sample.getdesign_url} target="_blank" rel="noreferrer">
                새 창에서 열기 ↗
              </a>
            </div>
          ) : (
            <iframe
              className={styles.iframe}
              src={sample.getdesign_url}
              title={`${sample.name} on getdesign.md`}
              sandbox="allow-scripts allow-same-origin allow-popups"
              loading="lazy"
              onLoad={() => clearTimeout(iframeTimeoutRef.current)}
              onError={() => setIframeError(true)}
            />
          )}
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
```

- [ ] **Step 3: 디테일 페이지 시각 검증**

브라우저에서 일람 페이지의 카드 클릭 → 디테일 페이지 진입.

체크리스트:
- [ ] 상단 빵부스러기 + 제목 + 카테고리 chip + tagline
- [ ] 액션 버튼 5개 표시
- [ ] 좌측 패널: DESIGN.md 마크다운 렌더링 (h1/h2/list/code 정상)
- [ ] 우측 패널: iframe 안에 getdesign.md 페이지 표시
- [ ] [📋 마크다운 복사] 클릭 → 토스트 표시 + 클립보드에 텍스트 들어감 (다른 곳에 붙여넣기 테스트)
- [ ] [⬇️ 다운로드] 클릭 → DESIGN-claude.md 파일 다운로드
- [ ] [🎨 토큰 프리뷰 ON] 클릭 → 좌측 패널 상단에 데모 카드 등장, 색상이 해당 디자인으로 바뀜. **사이드바·탑바는 영향 받지 않음** 확인.
- [ ] 토큰 추출 실패한 디자인 (color_tokens 빈 배열) 의 경우: 버튼 disabled + hover 시 안내 tooltip
- [ ] 잘못된 slug `/admin/design-md/foobar` → 404 카드 + 목록 링크

만약 iframe 이 안 보이고 폴백 카드가 뜬다면 8초 타임아웃이 너무 짧을 수 있음 — `setTimeout(() => setIframeError(true), 8000)` 의 8000 을 더 늘리거나 (예: 15000), iframe 의 onLoad 가 실제로 발화하는지 console.log 로 확인.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/pages/admin/AdminDesignMdDetail.jsx frontend/src/pages/admin/AdminDesignMdDetail.module.css
git commit -m "feat(design-md): admin detail page with split view + token preview

좌: DESIGN.md (ReactMarkdown + remark-gfm)
우: getdesign.md iframe (sandbox + 8s onLoad timeout fallback)
액션: 복사 / 다운로드 / 토큰 프리뷰 토글 / 외부 링크
토큰 프리뷰: .mdPane 스코프 안에서만 CSS variables 적용

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: 종합 검증 + 마무리

**Files:** 없음 — 검증만

- [ ] **Step 1: 종합 시나리오**

브라우저에서 처음부터 끝까지 시나리오 실행:

1. `/admin` 진입 (admin 로그인 상태)
2. 사이드바 Claude Code 펼치기 → '디자인샘플' 클릭
3. 일람 페이지: 50+ 카드 그리드 표시. 검색·필터 동작 확인.
4. 첫 카드 (예: Airbnb) 클릭 → 디테일 진입
5. 좌측 마크다운 + 우측 iframe 모두 로드
6. [복사] / [다운로드] / [토큰 프리뷰] 모두 동작
7. [getdesign.md ↗] / [GitHub ↗] 새 창에서 열림
8. ← 디자인샘플 링크로 일람 복귀, 다른 카드 클릭 — 재진입 후 상태 reset 확인
9. 잘못된 URL `/admin/design-md/zzz` → 404 카드
10. 일반 user 계정으로 로그인 후 `/admin/design-md` 진입 시도 → ProtectedRoute 가 차단

- [ ] **Step 2: 백엔드 모든 테스트 재실행**

```bash
cd backend && python -m pytest tests/ -v
```

기대: parse_color_tokens 5개 + parse_font_tokens 5개 = 10 PASS.

- [ ] **Step 3: 빌드 확인**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

기대: 빌드 성공, 새 청크 2개 (AdminDesignMd-*.js, AdminDesignMdDetail-*.js) 생성. 경고 없음 또는 무관한 경고만.

- [ ] **Step 4: 푸시 + 종료**

```bash
git status
git log --oneline | head -10
git push origin HEAD
```

기대: 9개 커밋이 푸시됨. Orbitron 자동 재배포 트리거.

---

## Self-Review (저자)

스펙 vs 플랜 매핑:

| 스펙 섹션 | 플랜 Task |
|---|---|
| 사이드바 1줄 변경 | 8 |
| 라우팅 2개 | 8 |
| DesignMd 모델 | 3 |
| DesignMdSyncMeta 모델 | 3 |
| Alembic 마이그레이션 | 4 |
| sync_from_github 서비스 | 5 |
| parse_color_tokens | 1 |
| parse_font_tokens | 2 |
| 4 라우터 엔드포인트 | 6 |
| main.py 라우터 등록 | 6 |
| 부팅 24h 자동 sync | 7 |
| AdminDesignMd 일람 페이지 | 9 |
| 검색 + 카테고리 필터 | 9 |
| sync 배지 + polling | 9 |
| 빈 상태 카드 | 9 |
| AdminDesignMdDetail 디테일 페이지 | 10 |
| 스플릿 뷰 (마크다운 + iframe) | 10 |
| 마크다운 복사 / 다운로드 | 10 |
| 토큰 프리뷰 | 10 |
| iframe 폴백 | 10 |
| 404 처리 | 10 |
| CSS Modules (admin-design-md.css → .module.css) | 9, 10 |
| MIT 어트리뷰션 푸터 | 9 |

타입/식별자 일관성:
- `parse_color_tokens`, `parse_font_tokens` — 모든 task 에서 동일 이름 사용
- `DesignMd`, `DesignMdSyncMeta` — task 3/5/6/7 일관
- API path: `/api/design-md`, `/api/design-md/{slug}`, `/api/design-md/sync`, `/api/design-md/sync/status` — task 6 에서 정의, task 9/10 에서 호출
- `last_sync_status` 값들: `never/running/ok/failed` — 모델/서비스/UI 일관
- CSS class 이름: 디테일 페이지의 `.mdPane`, `.iframeWrap`, `.split` 등 — Step 1 (CSS) 과 Step 2 (JSX) 일관 확인됨

Placeholder 검색: TBD / TODO / "implement later" / "Add appropriate error handling" / "similar to Task N" 없음. 모든 단계에 실제 코드/명령/기대 출력 포함.

---

## Execution Handoff

플랜 완료, 저장됨: `docs/superpowers/plans/2026-05-17-design-md-samples.md`

다음 단계 선택:
1. **Subagent-Driven (recommended)** — task 마다 fresh subagent 디스패치, task 사이 리뷰, 빠른 반복
2. **Inline Execution** — 이 세션에서 직접 task 순서대로 실행, 체크포인트마다 사용자 리뷰

어느 쪽으로 진행할까요?
