"""DESIGN.md 에서 디자인 토큰을 추출하는 순수 함수들."""
import re
from collections import Counter

_HEX_RE = re.compile(r"#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])|#[0-9a-fA-F]{6}\b(?![0-9a-fA-F])")

_FONT_RE = re.compile(
    r"font[-]?family\s*:\s*['\"]?([^'\"\n,;}]+?)['\"]?(?=\s*[,;\n}]|\s*$)",
    re.MULTILINE | re.IGNORECASE,
)


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
