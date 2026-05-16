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
