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


def test_parse_font_tokens_extracts_jsx_fontfamily_camelcase():
    md = '''
    fontFamily: "Copernicus, Tiempos Headline, serif",
    fontFamily: 'Inter',
    '''
    result = parse_font_tokens(md)
    assert "Copernicus" in result
    assert "Inter" in result
